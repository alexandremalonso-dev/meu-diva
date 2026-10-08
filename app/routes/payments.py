import os
import json
import hashlib
import hmac
import mercadopago
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.config import settings
from app.core.pricing_config import get_plan_name

from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.wallet import Wallet, Ledger
from app.models.payment import Payment
from app.models.appointment import Appointment
from app.models.therapist_profile import TherapistProfile

from app.core.appointment_status import AppointmentStatus

from app.schemas.payment import (
    CreatePaymentIntentRequest,
    PaymentStatusResponse,
)

from app.services.jitsi_service import jitsi_service
from app.services.email_service import email_service

MP_ACCESS_TOKEN = getattr(settings, "mp_access_token", None) or os.getenv("MP_ACCESS_TOKEN", "")
MP_PUBLIC_KEY   = os.getenv("MP_PUBLIC_KEY", "")
MP_WEBHOOK_SECRET = os.getenv("MP_WEBHOOK_SECRET", "")

# IDs dos planos de assinatura criados no painel do Mercado Pago
MP_PLAN_IDS = {
    "essencial":    "60118896981a4238b52fdebb02e72769",
    "profissional": "d2ec35a8800f454c8e4e9472c635e767",
    "premium":      "c02a3c222900447181af9b10314af05f",
}

if MP_ACCESS_TOKEN:
    sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
    print("✅ Mercado Pago configurado")
else:
    sdk = None
    print("⚠️ Mercado Pago em modo MOCK - sem chave configurada")

BR_TZ = timezone(timedelta(hours=-3))
router = APIRouter(prefix="/payments", tags=["payments"])


def D(value) -> Decimal:
    """Converte qualquer valor numérico para Decimal com segurança."""
    return Decimal(str(value))


def get_patient_id_from_user(db, user_id):
    patient = db.execute(select(PatientProfile).where(PatientProfile.user_id == user_id)).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")
    return patient.id


def get_patient_wallet(db, patient_id):
    wallet = db.execute(select(Wallet).where(Wallet.patient_id == patient_id)).scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")
    return wallet


def _verify_mp_signature(request_body, x_signature, x_request_id):
    if not MP_WEBHOOK_SECRET:
        return True
    try:
        parts = dict(p.split("=", 1) for p in x_signature.split(","))
        ts = parts.get("ts", "")
        v1 = parts.get("v1", "")
        manifest = f"id:{json.loads(request_body).get('data', {}).get('id', '')};request-id:{x_request_id};ts:{ts};"
        expected = hmac.new(MP_WEBHOOK_SECRET.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, v1)
    except Exception as e:
        print(f"⚠️ Erro assinatura MP: {e}")
        return False


def generate_meet_and_send_emails_and_notifications(appointment, db):
    meet_url = None
    try:
        if jitsi_service:
            therapist = db.get(User, appointment.therapist_user_id)
            if therapist:
                meet_url = jitsi_service.get_meet_url(
                    appointment_id=appointment.id, user_id=therapist.id,
                    user_name=therapist.full_name or therapist.email.split('@')[0], is_moderator=True
                )
                if meet_url:
                    appointment.video_call_url = meet_url
                    db.commit()
                    print(f"✅ [MP] Jitsi Meet: {meet_url}")
    except Exception as e:
        print(f"❌ [MP] Erro Jitsi: {e}")
    try:
        patient = db.get(User, appointment.patient_user_id)
        therapist = db.get(User, appointment.therapist_user_id)
        if patient and therapist:
            email_service.send_appointment_confirmation(appointment, patient.email, therapist.email, meet_url)
    except Exception as e:
        print(f"⚠️ [MP] Erro e-mails: {e}")
    try:
        from app.services.notification_service import NotificationService
        patient = db.get(User, appointment.patient_user_id)
        therapist = db.get(User, appointment.therapist_user_id)
        if patient and therapist:
            NotificationService(db).notify_appointment_confirmed(appointment, patient, therapist, meet_url)
    except Exception as e:
        print(f"⚠️ [MP] Erro notificações: {e}")


def get_therapist_commission_rate(therapist_user_id, db):
    from app.models.subscription import Subscription
    therapist_profile = db.execute(select(TherapistProfile).where(TherapistProfile.user_id == therapist_user_id)).scalar_one_or_none()
    if not therapist_profile:
        return 20.0
    subscription = db.execute(select(Subscription).where(
        Subscription.therapist_id == therapist_profile.id, Subscription.status == "active"
    )).scalar_one_or_none()
    if not subscription:
        return 20.0
    if subscription.plan == "profissional":
        return 10.0
    if subscription.plan == "premium":
        return 3.0
    return 20.0


def register_commission(appointment_id, therapist_user_id, patient_user_id, session_price, commission_rate, db, is_refund=False):
    from app.models.commission import Commission
    therapist_profile = db.execute(select(TherapistProfile).where(TherapistProfile.user_id == therapist_user_id)).scalar_one_or_none()
    if not therapist_profile:
        return
    commission_amount = (session_price * commission_rate) / 100
    net_amount = session_price - commission_amount
    if is_refund:
        commission_amount = -commission_amount
        net_amount = -net_amount
    db.add(Commission(
        appointment_id=appointment_id,
        therapist_id=therapist_profile.id,
        session_price=session_price,
        commission_rate=commission_rate,
        commission_amount=commission_amount,
        net_amount=net_amount,
        is_refund=is_refund,
    ))

    # 🔥 Creditar net_amount na wallet real do terapeuta
    therapist_wallet = db.execute(
        select(Wallet).where(Wallet.therapist_id == therapist_profile.id)
    ).scalar_one_or_none()
    if not therapist_wallet:
        therapist_wallet = Wallet(therapist_id=therapist_profile.id, balance=0, currency="BRL")
        db.add(therapist_wallet)
        db.flush()
    therapist_wallet.balance = D(therapist_wallet.balance) + D(str(net_amount))
    db.add(Ledger(
        wallet_id=therapist_wallet.id,
        appointment_id=appointment_id,
        transaction_type="credit_purchase" if not is_refund else "refund",
        amount=D(str(abs(net_amount))),
        balance_after=therapist_wallet.balance,
        description=f"Sessão #{appointment_id} - {'Estorno' if is_refund else 'Recebimento'} líquido"
    ))


def _build_therapist_summary(appointment, db):
    therapist_profile = db.execute(select(TherapistProfile).where(TherapistProfile.user_id == appointment.therapist_user_id)).scalar_one_or_none()
    therapist_user = db.get(User, appointment.therapist_user_id)
    if not therapist_profile or not therapist_user:
        return {"name": "Terapeuta", "crp": "", "specialties": [], "photo_url": None, "session_price": float(appointment.session_price), "session_duration_minutes": 50}
    specialties = []
    if hasattr(therapist_profile, "specialties") and therapist_profile.specialties:
        raw = therapist_profile.specialties
        if isinstance(raw, list):
            specialties = raw
        elif isinstance(raw, str):
            try:
                specialties = json.loads(raw)
            except Exception:
                specialties = [raw]
    return {
        "name": therapist_user.full_name or therapist_user.email,
        "crp": getattr(therapist_profile, "crp", "") or "",
        "specialties": specialties,
        "photo_url": getattr(therapist_profile, "foto_url", None),
        "session_price": float(appointment.session_price),
        "session_duration_minutes": getattr(therapist_profile, "session_duration_minutes", 50) or 50,
    }


def _confirm_appointment_after_payment(payment, wallet, mp_payment_id, source_label, db):
    """Confirma o agendamento após pagamento aprovado — usado por cartão e Pix."""
    payment_amount = D(payment.amount)
    wallet.balance = D(wallet.balance) + payment_amount
    db.add(Ledger(
        wallet_id=wallet.id, transaction_type="credit_purchase",
        amount=payment_amount, balance_after=wallet.balance,
        description=f"Recarga via {source_label}",
        meta_data={"payment_id": payment.id, "mp_payment_id": str(mp_payment_id)}
    ))
    payment.status = "paid"
    payment.paid_at = datetime.now()

    if payment.appointment_id:
        appointment = db.get(Appointment, int(payment.appointment_id))
        if appointment and appointment.status in [AppointmentStatus.scheduled, AppointmentStatus.proposed]:
            session_price = D(appointment.session_price)
            appointment.status = AppointmentStatus.confirmed
            wallet.balance = D(wallet.balance) - session_price
            db.add(Ledger(
                wallet_id=wallet.id, appointment_id=appointment.id,
                transaction_type="session_debit", amount=session_price,
                balance_after=wallet.balance,
                description=f"Sessão {appointment.id} - Confirmada ({source_label})"
            ))
            generate_meet_and_send_emails_and_notifications(appointment, db)
            commission_rate = get_therapist_commission_rate(appointment.therapist_user_id, db)
            register_commission(
                appointment_id=appointment.id, therapist_user_id=appointment.therapist_user_id,
                patient_user_id=appointment.patient_user_id, session_price=float(session_price),
                commission_rate=commission_rate, db=db,
            )

    db.commit()
    print(f"✅ [{source_label}] Pagamento confirmado. Saldo final: R$ {float(wallet.balance):.2f}")


# ============================================
# ASSINATURAS — Stripe (mantido para quem já tem)
# ============================================

def handle_subscription_created(subscription_data, db):
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    stripe_subscription_id = subscription_data.get("id")
    customer_id = subscription_data.get("customer")
    plan_id = subscription_data.get("items", {}).get("data", [{}])[0].get("price", {}).get("id")
    current_period_start = datetime.fromtimestamp(subscription_data.get("current_period_start", 0))
    current_period_end = datetime.fromtimestamp(subscription_data.get("current_period_end", 0))
    status = subscription_data.get("status", "active")
    plan_map = {"price_essencial": "essencial", "price_profissional": "profissional", "price_premium": "premium"}
    plan = plan_map.get(plan_id, "essencial")
    therapist_profile = db.execute(select(TherapistProfile).where(TherapistProfile.stripe_customer_id == customer_id)).scalar_one_or_none()
    if not therapist_profile:
        return
    existing = db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)).scalar_one_or_none()
    if existing:
        existing.status = status; existing.plan = plan
        existing.current_period_start = current_period_start; existing.current_period_end = current_period_end
        existing.updated_at = datetime.now()
    else:
        db.add(Subscription(therapist_id=therapist_profile.id, plan=plan, status=status,
            stripe_subscription_id=stripe_subscription_id, stripe_customer_id=customer_id,
            current_period_start=current_period_start, current_period_end=current_period_end))
    db.commit()
    try:
        therapist_user = db.get(User, therapist_profile.user_id)
        if therapist_user and status == "active":
            NotificationService(db).notify_subscription_activated(therapist_user, get_plan_name(plan))
    except Exception as e:
        print(f"⚠️ {e}")


def handle_subscription_updated(subscription_data, db):
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    stripe_subscription_id = subscription_data.get("id")
    status = subscription_data.get("status")
    subscription = db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)).scalar_one_or_none()
    if not subscription:
        return
    old_plan = subscription.plan
    subscription.status = status
    subscription.current_period_start = datetime.fromtimestamp(subscription_data.get("current_period_start", 0))
    subscription.current_period_end = datetime.fromtimestamp(subscription_data.get("current_period_end", 0))
    subscription.cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)
    subscription.updated_at = datetime.now()
    if status in ["canceled", "expired", "incomplete_expired", "past_due"]:
        subscription.plan = "basico"
    db.commit()
    if status in ["canceled", "expired", "incomplete_expired"]:
        try:
            therapist_user = db.get(User, subscription.therapist_profile.user_id)
            if therapist_user:
                NotificationService(db).notify_subscription_cancelled(therapist_user, get_plan_name(old_plan))
        except Exception as e:
            print(f"⚠️ {e}")


def handle_subscription_deleted(subscription_data, db):
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    stripe_subscription_id = subscription_data.get("id")
    subscription = db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)).scalar_one_or_none()
    if not subscription:
        return
    old_plan = subscription.plan
    subscription.status = "cancelled"; subscription.plan = "basico"; subscription.updated_at = datetime.now()
    db.commit()
    try:
        therapist_user = db.get(User, subscription.therapist_profile.user_id)
        if therapist_user:
            NotificationService(db).notify_subscription_cancelled(therapist_user, get_plan_name(old_plan))
    except Exception as e:
        print(f"⚠️ {e}")


# ============================================
# ASSINATURAS — Mercado Pago (novo)
# ============================================

@router.post("/create-subscription-checkout")
async def create_subscription_checkout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Compatibilidade: retorna checkout_url do MP para o fluxo antigo (redirect).
    Mantido para não quebrar UpgradeCard e TherapistSubscriptionPage existentes.
    """
    body = await request.json()
    plan = body.get("plan", "").lower()

    if plan not in MP_PLAN_IDS:
        raise HTTPException(status_code=400, detail=f"Plano inválido: {plan}. Use 'profissional' ou 'premium'.")

    plan_id = MP_PLAN_IDS[plan]
    checkout_url = f"https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id={plan_id}"
    print(f"📦 Subscription checkout (redirect) - User {current_user.id} - Plano {plan}")
    return {"checkout_url": checkout_url}


def _period_end_from_mp(mp_data, now):
    """
    Fim do período = próxima cobrança informada pelo Mercado Pago (já considera
    o teste grátis). Fallback: 30 dias. A conta antiga com replace(month=...)
    quebrava nos dias 29 a 31 (ex.: 31/10 + 1 mês = 31/11, que não existe).
    """
    raw = (mp_data or {}).get("next_payment_date")
    try:
        if raw:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        pass
    return now + timedelta(days=30)


@router.post("/create-subscription")
async def create_subscription(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Cria uma assinatura MP diretamente via API com card_token_id.
    Usado pelo checkout personalizado /therapist/subscription/checkout.
    """
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService

    body = await request.json()
    plan = body.get("plan", "").lower()
    card_token_id = body.get("card_token_id", "")
    # 🔥 O e-mail do pagador SEMPRE vem do usuário logado (servidor). Antes vinha
    # do navegador e podia chegar vazio se a chamada a /api/users/me falhasse.
    payer_email = (current_user.email or "").strip()
    # 🔥 Device ID gerado pelo script de segurança do Mercado Pago no navegador.
    import re as _re
    device_id = str(body.get("device_id", "") or "").strip()
    if device_id and not _re.fullmatch(r"[A-Za-z0-9_.\-]{1,200}", device_id):
        device_id = ""
    payer_cpf = body.get("payer_cpf", "").replace(".", "").replace("-", "")

    if plan not in MP_PLAN_IDS:
        raise HTTPException(status_code=400, detail=f"Plano inválido: {plan}.")
    if not card_token_id:
        raise HTTPException(status_code=400, detail="card_token_id é obrigatório.")
    if not payer_cpf or len(payer_cpf) < 11:
        raise HTTPException(status_code=400, detail="CPF inválido.")
    if not sdk:
        raise HTTPException(status_code=503, detail="Mercado Pago não configurado.")

    plan_id = MP_PLAN_IDS[plan]
    plan_prices = {"essencial": 19.90, "profissional": 79.00, "premium": 149.00}
    plan_names = {"essencial": "Plano Essencial — Meu Divã", "profissional": "Plano Profissional — Meu Divã", "premium": "Plano Premium — Meu Divã"}

    mp_payload = {
        "preapproval_plan_id": plan_id,
        "reason": plan_names[plan],
        "external_reference": f"therapist_{current_user.id}_plan_{plan}",
        "payer_email": payer_email,
        "card_token_id": card_token_id,
        "back_url": f"{os.getenv('FRONTEND_URL', 'https://app.meudivaonline.com')}/therapist/dashboard?subscription=success",
        "status": "authorized",
    }

    print(f"📦 Criando assinatura MP - User {current_user.id} - Plano {plan} - device_id={'sim' if device_id else 'nao'} - email={'sim' if payer_email else 'nao'}")

    # 🔥 Registra a tentativa de checkout: reinicia a contagem da limpeza de cadastros sem plano
    try:
        from sqlalchemy import text as _t
        db.execute(
            _t("INSERT INTO onboarding_cleanup (user_id, last_attempt_at) VALUES (:u, :t) ON CONFLICT (user_id) DO UPDATE SET last_attempt_at = :t"),
            {"u": current_user.id, "t": datetime.utcnow()},
        )
        db.commit()
    except Exception as _e:
        db.rollback()
        print(f"⚠️ nao foi possivel registrar a tentativa de checkout: {_e}")

    try:
        mp_token = os.getenv("MP_ACCESS_TOKEN", "")
        if not mp_token:
            raise HTTPException(status_code=503, detail="Mercado Pago não configurado.")

        # 🔥 Chamada direta à API (em vez do SDK) para poder enviar o header
        # X-meli-session-id (Device ID), recomendado pela documentação do
        # Mercado Pago. Não está confirmado que o endpoint de assinaturas use
        # esse header; ele é inofensivo se for ignorado.
        import requests as _requests
        mp_headers = {
            "Authorization": f"Bearer {mp_token}",
            "Content-Type": "application/json",
        }
        if device_id:
            mp_headers["X-meli-session-id"] = device_id
        mp_resp = _requests.post(
            "https://api.mercadopago.com/preapproval",
            headers=mp_headers, json=mp_payload, timeout=30,
        )
        try:
            mp_data = mp_resp.json()
        except ValueError:
            mp_data = {}
        if not mp_resp.ok:
            print(f"📦 MP erro HTTP {mp_resp.status_code}: {json.dumps(mp_data, ensure_ascii=False)[:600]}")
        mp_status = mp_data.get("status")
        mp_id = mp_data.get("id")
        mp_error = mp_data.get("message", "")

        print(f"📦 MP Subscription: status={mp_status} | id={mp_id} | error={mp_error}")

        if mp_status not in ("authorized", "pending"):
            raise HTTPException(status_code=400, detail=f"Assinatura não aprovada: {mp_error or mp_status}")

        # Salva no banco
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        if not therapist_profile:
            raise HTTPException(status_code=404, detail="Perfil do terapeuta não encontrado")

        now = datetime.now()
        from app.models.subscription import Subscription
        existing = db.execute(
            select(Subscription).where(Subscription.therapist_id == therapist_profile.id)
        ).scalar_one_or_none()

        if existing:
            # 🔥 Troca de plano: cancela a assinatura ANTERIOR no Mercado Pago. Sem isso
            # ela continua cobrando em paralelo (o ID antigo é sobrescrito logo abaixo).
            _old_mp_id = existing.stripe_subscription_id
            if (
                _old_mp_id
                and _old_mp_id != str(mp_id)
                and (getattr(existing, "payment_provider", None) or "mercadopago") == "mercadopago"
                and existing.status in ("active", "paused", "pending")
            ):
                try:
                    import requests as _rq
                    _r = _rq.put(
                        f"https://api.mercadopago.com/preapproval/{_old_mp_id}",
                        headers={"Authorization": f"Bearer {mp_token}", "Content-Type": "application/json"},
                        json={"status": "cancelled"}, timeout=20,
                    )
                    print(f"🔁 Troca de plano: assinatura anterior {_old_mp_id} cancelada (HTTP {_r.status_code})")
                except Exception as e:
                    print(f"⚠️ Erro ao cancelar assinatura anterior {_old_mp_id}: {e}")
            existing.plan = plan
            existing.status = "active" if mp_status == "authorized" else "pending"
            existing.stripe_subscription_id = str(mp_id)
            existing.payment_provider = "mercadopago"
            existing.current_period_start = now
            existing.current_period_end = _period_end_from_mp(mp_data, now)
            existing.cancel_at_period_end = False
            existing.updated_at = now
        else:
            period_end = _period_end_from_mp(mp_data, now)
            db.add(Subscription(
                therapist_id=therapist_profile.id,
                plan=plan,
                status="active" if mp_status == "authorized" else "pending",
                stripe_subscription_id=str(mp_id),
                current_period_start=now,
                current_period_end=period_end,
                cancel_at_period_end=False,
            ))
        db.commit()

        try:
            NotificationService(db).notify_subscription_activated(current_user, get_plan_name(plan))
        except Exception as e:
            print(f"⚠️ Erro notificação: {e}")

        print(f"✅ Assinatura MP criada: {mp_id} - {plan}")
        return {"status": mp_status, "mp_subscription_id": mp_id, "plan": plan}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao criar assinatura MP: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar assinatura: {str(e)}")


# Dedupe simples (em memória) para não repetir o mesmo alerta de cobrança recusada
_ALERTED_CHARGES: set = set()


def _mp_get(path: str):
    """GET direto na API do Mercado Pago. Retorna (status_http, json)."""
    import requests as _requests
    token = os.getenv("MP_ACCESS_TOKEN", "")
    try:
        r = _requests.get(
            f"https://api.mercadopago.com{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, {}
    except Exception as e:
        print(f"⚠️ Erro GET MP {path}: {e}")
        return 0, {}


def _alert_failed_charge(user, plan_name, ap):
    """Avisa por e-mail quando uma cobrança de assinatura é recusada."""
    key = f"pay:{(ap.get('payment') or {}).get('id') or ap.get('id')}"
    if key in _ALERTED_CHARGES:
        return
    _ALERTED_CHARGES.add(key)
    try:
        import html as _html
        from app.services.email_service import email_service
        to_email = os.getenv("PAYMENT_ALERT_EMAIL", "contato@meudivaonline.com")
        nome = _html.escape(getattr(user, "full_name", None) or f"usuário {user.id}")
        codigo = ap.get("rejection_code") or (ap.get("payment") or {}).get("status_detail") or "desconhecido"
        texto = _html.escape(_mp_rejection_message(codigo))
        corpo = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#E03673;margin:0 0 16px;">Cobrança de assinatura recusada</h2>
          <p><strong>Terapeuta:</strong> {nome} (usuário {user.id})</p>
          <p><strong>Plano:</strong> {plan_name}</p>
          <p><strong>Valor:</strong> R$ {ap.get('transaction_amount')}</p>
          <p><strong>Motivo:</strong> {texto} ({_html.escape(str(codigo))})</p>
          {('<p><strong>Tentativa:</strong> ' + str(ap.get('retry_attempt')) + '</p>') if ap.get('retry_attempt') else ''}
          <p style="color:#888;font-size:13px;">O Mercado Pago tenta cobrar de novo automaticamente. Depois de 3 parcelas recusadas a assinatura é cancelada.</p>
        </div>
        """
        email_service._send_email(
            to_email=to_email,
            subject=f"⚠️ Cobrança de assinatura recusada — plano {plan_name}",
            html_content=corpo,
        )
    except Exception as e:
        print(f"⚠️ Erro ao enviar alerta de cobrança recusada: {e}")


@router.post("/webhook/mp/subscription")
async def mp_subscription_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook do MP para assinaturas.
    - subscription_preapproval: mudança de status da assinatura (autorizada, pausada, cancelada)
    - subscription_authorized_payment: cobrança (aprovada ou recusada) de uma assinatura
    """
    try:
        raw_body = await request.body()
        body = json.loads(raw_body)

        print(f"\n🔔 MP SUBSCRIPTION WEBHOOK: {json.dumps(body)[:300]}")

        event_type = body.get("type")
        resource_id = body.get("data", {}).get("id")

        if event_type not in ("subscription_preapproval", "subscription_authorized_payment") or not resource_id:
            return {"status": "ignored"}

        if not sdk:
            return {"status": "ignored"}

        import re as _re
        charge = None

        # 🔥 Evento de COBRANÇA: o id do evento é o da cobrança, não o da assinatura.
        if event_type == "subscription_authorized_payment":
            http_status, charge = _mp_get(f"/authorized_payments/{resource_id}")
            if http_status != 200 or not charge.get("preapproval_id"):
                print(f"⚠️ Cobrança {resource_id} sem preapproval_id (HTTP {http_status})")
                return {"status": "ignored"}
            resource_id = charge["preapproval_id"]

        # Busca os detalhes da assinatura no MP
        preapproval_response = sdk.preapproval().get(resource_id)
        preapproval = preapproval_response.get("response", {})

        mp_status = preapproval.get("status")
        plan_id = preapproval.get("preapproval_plan_id", "")
        payer_email = preapproval.get("payer_email", "") or ""
        external_reference = preapproval.get("external_reference", "") or ""
        next_payment_date = preapproval.get("next_payment_date")
        date_created = preapproval.get("date_created")

        print(f"📦 MP Subscription: status={mp_status} | plan_id={plan_id} | ref={external_reference}")

        # Descobre qual plano pelo preapproval_plan_id
        plan_name = next((k for k, v in MP_PLAN_IDS.items() if v == plan_id), None)
        if not plan_name:
            # 🔥 Plano de PACIENTE (pacotes de sessões): tratado em services/patient_packages.py.
            # Só chega aqui quando o plano não é de terapeuta, então o fluxo dos terapeutas não muda.
            try:
                from app.services.patient_packages import handle_patient_package_event
                if handle_patient_package_event(db, preapproval, charge, str(resource_id)):
                    return {"status": "success"}
            except Exception as _e:
                db.rollback()
                print(f"❌ [PACOTE] erro ao processar evento de plano de paciente: {_e}")
                import traceback as _tb
                _tb.print_exc()
                # 500 para o Mercado Pago reenviar o evento (o crédito não pode se perder)
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=500, content={"status": "error"})
            print(f"⚠️ plan_id não reconhecido: {plan_id}")
            return {"status": "ignored"}

        from app.models.subscription import Subscription
        from app.services.notification_service import NotificationService

        # Assinatura já salva com esse ID do MP (correspondência exata)
        existing = db.execute(
            select(Subscription).where(Subscription.stripe_subscription_id == str(resource_id))
        ).scalar_one_or_none()

        # 🔥 Identifica o terapeuta: 1) pela assinatura salva, 2) pelo
        # external_reference (therapist_<id>_plan_...), 3) pelo e-mail (a API
        # do MP devolve payer_email vazio, então este é só o último recurso).
        user = None
        therapist_profile = None
        if existing:
            therapist_profile = db.get(TherapistProfile, existing.therapist_id)
            if therapist_profile:
                user = db.get(User, therapist_profile.user_id)
        if not user:
            m = _re.match(r"^therapist_(\d+)_plan_", external_reference)
            if m:
                user = db.get(User, int(m.group(1)))
        if not user and payer_email:
            user = db.execute(select(User).where(User.email == payer_email)).scalar_one_or_none()
        if not user:
            print(f"⚠️ Usuário não identificado (ref={external_reference!r})")
            return {"status": "ignored"}

        if not therapist_profile:
            therapist_profile = db.execute(
                select(TherapistProfile).where(TherapistProfile.user_id == user.id)
            ).scalar_one_or_none()
        if not therapist_profile:
            print(f"⚠️ Perfil de terapeuta não encontrado para user: {user.id}")
            return {"status": "ignored"}

        # Cobrança: registra e avisa se foi recusada
        if charge is not None:
            pay = charge.get("payment") or {}
            print(
                f"💳 Cobrança {charge.get('id')}: status={charge.get('status')} | "
                f"pagamento={pay.get('status')} | codigo={charge.get('rejection_code')} | "
                f"tentativa={charge.get('retry_attempt')} | valor={charge.get('transaction_amount')}"
            )
            if charge.get("rejection_code") or pay.get("status") == "rejected":
                _alert_failed_charge(user, plan_name, charge)

        def _parse_dt(s, default):
            try:
                return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None) if s else default
            except Exception:
                return default

        now = datetime.now()
        period_start = _parse_dt(date_created, now)
        period_end = _parse_dt(next_payment_date, now + timedelta(days=30))

        if mp_status == "authorized":
            sub = existing
            if sub is None:
                # Uma linha por terapeuta (como em create_subscription)
                sub = db.execute(
                    select(Subscription).where(Subscription.therapist_id == therapist_profile.id)
                ).scalars().first()
                if sub is not None and getattr(sub, "payment_provider", "mercadopago") == "apple_iap":
                    sub = None

            was_active = bool(sub and sub.status == "active" and sub.plan == plan_name)

            if sub:
                sub.status = "active"
                sub.plan = plan_name
                sub.stripe_subscription_id = str(resource_id)
                sub.payment_provider = "mercadopago"
                sub.current_period_start = period_start
                sub.current_period_end = period_end
                sub.updated_at = now
            else:
                db.add(Subscription(
                    therapist_id=therapist_profile.id,
                    plan=plan_name,
                    status="active",
                    stripe_subscription_id=str(resource_id),  # reutiliza campo para ID do MP
                    current_period_start=period_start,
                    current_period_end=period_end,
                ))
            db.commit()
            print(f"✅ Assinatura MP ativada: terapeuta {user.id} - plano {plan_name}")
            if not was_active:
                try:
                    NotificationService(db).notify_subscription_activated(user, get_plan_name(plan_name))
                except Exception as e:
                    print(f"⚠️ Erro notificação: {e}")

        elif mp_status in ("cancelled", "paused", "pending"):
            # Só altera a linha cujo ID de assinatura bate exatamente
            if existing:
                # 🔥 Cancelamento agendado pelo terapeuta: o plano vale até o fim do período pago
                if (mp_status == "cancelled" and existing.cancel_at_period_end
                        and existing.current_period_end and existing.current_period_end > now):
                    print(f"ℹ️ Cancelamento agendado mantido até {existing.current_period_end}: terapeuta {user.id}")
                    return {"status": "success"}
                novo_status = "cancelled" if mp_status == "cancelled" else mp_status
                ja_estava = existing.status == novo_status
                existing.status = novo_status
                existing.plan = "basico" if mp_status == "cancelled" else existing.plan
                existing.updated_at = now
                db.commit()
                print(f"⚠️ Assinatura MP {mp_status}: terapeuta {user.id}")
                if mp_status == "cancelled" and not ja_estava:
                    try:
                        NotificationService(db).notify_subscription_cancelled(user, get_plan_name(plan_name))
                    except Exception as e:
                        print(f"⚠️ Erro notificação: {e}")

        return {"status": "success"}

    except Exception as e:
        print(f"❌ ERRO MP SUBSCRIPTION WEBHOOK: {e}")
        import traceback; traceback.print_exc()
        return {"status": "error", "detail": str(e)}


@router.post("/therapist/subscription/cancel")
async def cancel_mp_subscription(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Cancela a assinatura MP do terapeuta."""
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService

    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    subscription = db.execute(
        select(Subscription).where(
            Subscription.therapist_id == therapist_profile.id,
            Subscription.status == "active"
        )
    ).scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=404, detail="Assinatura ativa não encontrada")

    # 🔥 Cancelamento já agendado: não cancela de novo no Mercado Pago
    if getattr(subscription, "cancel_at_period_end", False):
        _ate = subscription.current_period_end
        _txt = _ate.strftime("%d/%m/%Y") if _ate else ""
        return {
            "message": ("Cancelamento já agendado. Seu plano continua ativo até " + _txt + ".") if _txt else "Cancelamento já agendado.",
            "ends_at": _ate.isoformat() if _ate else None,
        }

    # Cancela no MP se tiver SDK
    if sdk and subscription.stripe_subscription_id:
        try:
            _resp = sdk.preapproval().update(subscription.stripe_subscription_id, {"status": "cancelled"})
            _st = _resp.get("status") if isinstance(_resp, dict) else None
            print(f"✅ Assinatura MP cancelada: {subscription.stripe_subscription_id} (resposta do MP: {_st})")
            if _st is not None and int(_st) >= 400:
                print(f"⚠️ O Mercado Pago NAO confirmou o cancelamento: {str(_resp)[:300]}")
        except Exception as e:
            print(f"⚠️ Erro ao cancelar no MP: {e}")

    old_plan = subscription.plan
    agora = datetime.now()
    fim = subscription.current_period_end

    if fim and fim > agora:
        # 🔥 Já pagou o ciclo atual: mantém o plano até o fim do período (a cobrança futura
        # já foi cancelada no Mercado Pago acima). Um job horário rebaixa para o Básico depois.
        subscription.cancel_at_period_end = True
        subscription.updated_at = agora
        db.commit()
        fim_txt = fim.strftime("%d/%m/%Y")
        try:
            NotificationService(db).create_notification(
                user_id=current_user.id,
                notification_type="subscription_cancelled",
                title="Cancelamento agendado",
                message=f"Sua assinatura {get_plan_name(old_plan)} foi cancelada e continua ativa até {fim_txt}. Depois dessa data, você volta ao plano gratuito.",
                data={"plan": old_plan, "ends_at": fim.isoformat()},
                action_link="/therapist/subscription",
            )
        except Exception as e:
            print(f"⚠️ {e}")
        print(f"🗓️ Cancelamento agendado: usuario {current_user.id} plano {old_plan} ate {fim}")
        return {"message": f"Assinatura cancelada. Seu plano continua ativo até {fim_txt}.", "ends_at": fim.isoformat()}

    # Sem período futuro conhecido: volta ao Básico na hora
    subscription.status = "cancelled"
    subscription.plan = "basico"
    subscription.cancel_at_period_end = False
    subscription.updated_at = agora
    db.commit()

    try:
        NotificationService(db).notify_subscription_cancelled(current_user, get_plan_name(old_plan))
    except Exception as e:
        print(f"⚠️ {e}")

    return {"message": "Assinatura cancelada com sucesso"}


# ============================================
# CREATE PAYMENT INTENT (sessões)
# ============================================

@router.post("/create-payment-intent")
async def create_payment_intent(
    payload: CreatePaymentIntentRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    print(f"\n💳 MP Intent - User {current_user.id} - Appointment {payload.appointment_id}")

    appointment = db.get(Appointment, payload.appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    if appointment.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if appointment.status not in [AppointmentStatus.scheduled, AppointmentStatus.proposed]:
        raise HTTPException(status_code=400, detail=f"Agendamento inválido. Status: {appointment.status}")

    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet(db, patient_id)

    total_amount = D(appointment.session_price)
    wallet_balance = D(wallet.balance)

    if wallet_balance >= total_amount:
        wallet.balance = wallet_balance - total_amount
        db.add(Ledger(
            wallet_id=wallet.id, appointment_id=appointment.id,
            transaction_type="session_debit", amount=total_amount,
            balance_after=wallet.balance,
            description=f"Sessão {appointment.id} - Paga com saldo da carteira"
        ))
        appointment.status = AppointmentStatus.confirmed
        db.commit()
        generate_meet_and_send_emails_and_notifications(appointment, db)
        commission_rate = get_therapist_commission_rate(appointment.therapist_user_id, db)
        register_commission(
            appointment_id=appointment.id, therapist_user_id=appointment.therapist_user_id,
            patient_user_id=appointment.patient_user_id, session_price=float(total_amount),
            commission_rate=commission_rate, db=db,
        )
        db.commit()
        return {
            "mp_public_key": MP_PUBLIC_KEY, "already_paid": True,
            "payment_id": None, "appointment_id": appointment.id,
            "amount": 0, "total_amount": float(total_amount), "wallet_balance": float(wallet_balance),
            "message": "Sessão paga com saldo da carteira",
            "therapist": _build_therapist_summary(appointment, db),
            "appointment_date": appointment.starts_at.astimezone(BR_TZ).isoformat(),
            "appointment_time": appointment.starts_at.astimezone(BR_TZ).strftime("%H:%M"),
        }

    amount_to_pay = total_amount - wallet_balance

    if wallet_balance > D(0):
        wallet.balance = D(0)
        db.add(Ledger(
            wallet_id=wallet.id, appointment_id=appointment.id,
            transaction_type="session_debit", amount=wallet_balance,
            balance_after=D(0),
            description=f"Sessão {appointment.id} - Débito parcial (saldo: R$ {float(wallet_balance):.2f})"
        ))
        print(f"💰 Débito parcial: R$ {float(wallet_balance):.2f}")

    payment = db.execute(
        select(Payment).where(Payment.appointment_id == appointment.id, Payment.status == "pending")
    ).scalar_one_or_none()

    if not payment:
        payment = Payment(
            user_id=current_user.id, patient_id=patient_id, wallet_id=wallet.id,
            appointment_id=appointment.id, amount=amount_to_pay,
            currency="BRL", status="pending", description=f"Sessão #{appointment.id}",
        )
        db.add(payment)
    db.commit()
    db.refresh(payment)

    starts_br = appointment.starts_at.astimezone(BR_TZ)
    return {
        "mp_public_key": MP_PUBLIC_KEY, "already_paid": False,
        "payment_id": payment.id, "appointment_id": appointment.id,
        "amount": float(amount_to_pay), "total_amount": float(total_amount),
        "wallet_balance": float(wallet_balance),
        "therapist": _build_therapist_summary(appointment, db),
        "appointment_date": starts_br.isoformat(),
        "appointment_time": starts_br.strftime("%H:%M"),
    }


# ============================================
# CREATE PIX
# ============================================

@router.post("/create-pix")
async def create_pix(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    body = await request.json()
    payment_id = body.get("payment_id")
    payer_email = body.get("payer_email", current_user.email)
    payer_cpf = body.get("payer_cpf", "")

    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id é obrigatório")
    if not payer_cpf:
        raise HTTPException(status_code=400, detail="CPF é obrigatório para pagamento via Pix")

    payment = db.get(Payment, int(payment_id))
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if payment.status == "paid":
        return {"status": "approved", "detail": "Pagamento já processado"}

    if not sdk:
        return {
            "status": "pending", "mp_payment_id": "mock_pix_123",
            "qr_code": "00020126580014br.gov.bcb.pix0136mock-pix-key5204000053039865802BR5925Meu Diva6009SAO PAULO62070503***6304ABCD",
            "qr_code_base64": "",
            "expires_at": (datetime.now() + timedelta(minutes=30)).isoformat(),
        }

    payment_amount = D(payment.amount)
    mp_payload = {
        "transaction_amount": float(payment_amount),
        "description": f"Sessão de terapia #{payment.appointment_id} — Meu Divã",
        "payment_method_id": "pix",
        "payer": {
            "email": payer_email,
            "identification": {"type": "CPF", "number": payer_cpf.replace(".", "").replace("-", "")},
        },
        "external_reference": str(payment.id),
        "notification_url": f"{os.getenv('BACKEND_URL', 'https://api.meudivaonline.com')}/api/payments/webhook/mp",
        "metadata": {"payment_id": str(payment.id), "appointment_id": str(payment.appointment_id)},
        "date_of_expiration": (datetime.now(BR_TZ) + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S.000-03:00"),
    }

    try:
        response = sdk.payment().create(mp_payload)
        mp_data = response.get("response", {})
        mp_status = mp_data.get("status")
        mp_id = mp_data.get("id")

        if mp_status not in ("pending", "approved"):
            raise HTTPException(status_code=400, detail=f"Erro MP: {mp_data.get('status_detail', 'Erro ao gerar Pix')}")

        payment.meta_data = {**(payment.meta_data or {}), 'mp_payment_id': str(mp_id)}
        db.commit()

        pix_data = mp_data.get("point_of_interaction", {}).get("transaction_data", {})
        return {
            "status": "pending", "mp_payment_id": mp_id, "payment_id": payment.id,
            "qr_code": pix_data.get("qr_code", ""),
            "qr_code_base64": pix_data.get("qr_code_base64", ""),
            "amount": float(payment_amount),
            "expires_at": (datetime.now(BR_TZ) + timedelta(minutes=30)).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro MP Pix: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao gerar Pix: {str(e)}")


# ============================================
# PROCESS PAYMENT (Cartão)
# ============================================

@router.post("/process-payment")
async def process_payment(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    body = await request.json()
    payment_id = body.get("payment_id")

    if not payment_id:
        appointment_id = body.get("appointment_id")
        if appointment_id:
            appointment = db.get(Appointment, int(appointment_id))
            if appointment and appointment.status == AppointmentStatus.confirmed:
                return {"status": "approved", "detail": "Pago com saldo da carteira"}
        raise HTTPException(status_code=400, detail="payment_id é obrigatório")

    card_token      = body.get("card_token")
    payment_method_id = body.get("payment_method_id")
    issuer_id       = body.get("issuer_id")
    payer_email     = body.get("payer_email", current_user.email)
    payer_cpf       = body.get("payer_cpf", "")

    if not card_token:
        raise HTTPException(status_code=400, detail="card_token é obrigatório")

    payment = db.get(Payment, int(payment_id))
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if payment.status == "paid":
        return {"status": "approved", "detail": "Pagamento já processado"}

    wallet = db.get(Wallet, payment.wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")

    payment_amount = D(payment.amount)

    if not sdk:
        _confirm_appointment_after_payment(payment, wallet, "mock", "MP Mock", db)
        return {"status": "approved"}

    mp_payload = {
        "transaction_amount": float(payment_amount),
        "token": card_token,
        "description": f"Sessão #{payment.appointment_id} — Meu Divã",
        "installments": 1,
        "payment_method_id": payment_method_id,
        "issuer_id": issuer_id,
        "payer": {
            "email": payer_email,
            **({"identification": {"type": "CPF", "number": payer_cpf}} if payer_cpf else {}),
        },
        "external_reference": str(payment.id),
        "notification_url": f"{os.getenv('BACKEND_URL', 'https://api.meudivaonline.com')}/api/payments/webhook/mp",
        "metadata": {"payment_id": str(payment.id), "appointment_id": str(payment.appointment_id)},
    }

    try:
        response = sdk.payment().create(mp_payload)
        mp_data = response.get("response", {})
        mp_status = mp_data.get("status")
        mp_id = mp_data.get("id")
        status_detail = mp_data.get("status_detail", "")

        print(f"📦 MP Cartão: status={mp_status} | detail={status_detail} | id={mp_id}")

        payment.meta_data = {**(payment.meta_data or {}), 'mp_payment_id': str(mp_id)}
        db.commit()

        if mp_status == "approved":
            _confirm_appointment_after_payment(payment, wallet, str(mp_id), "Mercado Pago", db)
            return {"status": "approved", "mp_payment_id": mp_id}
        elif mp_status in ("in_process", "pending"):
            return {"status": "pending", "mp_payment_id": mp_id}
        else:
            return {"status": "rejected", "status_detail": status_detail, "detail": _mp_rejection_message(status_detail)}

    except Exception as e:
        print(f"❌ Erro MP: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao processar pagamento: {str(e)}")


def _mp_rejection_message(status_detail):
    messages = {
        "cc_rejected_insufficient_amount": "Saldo insuficiente no cartão.",
        "cc_rejected_bad_filled_card_number": "Número do cartão incorreto.",
        "cc_rejected_bad_filled_date": "Data de validade incorreta.",
        "cc_rejected_bad_filled_security_code": "Código de segurança incorreto.",
        "cc_rejected_bad_filled_other": "Dados do cartão incorretos.",
        "cc_rejected_call_for_authorize": "Ligue para seu banco para autorizar o pagamento.",
        "cc_rejected_card_disabled": "Cartão desabilitado. Entre em contato com seu banco.",
        "cc_rejected_duplicated_payment": "Pagamento duplicado. Aguarde alguns minutos.",
        "cc_rejected_high_risk": "Pagamento recusado por segurança.",
        "cc_rejected_max_attempts": "Limite de tentativas atingido. Tente outro cartão.",
        "cc_rejected_other_reason": "Cartão recusado. Tente outro cartão.",
    }
    return messages.get(status_detail, "Pagamento não aprovado. Verifique os dados e tente novamente.")


# ============================================
# WEBHOOK MERCADO PAGO (pagamentos)
# ============================================

def _handle_subscription_payment(db, mp_payment_id, mp_data) -> bool:
    """
    Pagamentos de ASSINATURA (cobrança e retentativas) trazem external_reference
    no formato "therapist_<id>_plan_<plano>", não o id de um Payment de sessão.
    Antes isso caía em int() e gerava erro no log. Aqui só alertamos recusas;
    o status da assinatura é tratado pelo webhook de assinatura.
    Retorna True se o pagamento era de assinatura (já tratado).
    """
    import re as _re
    # 🔥 Cobrança de pacote de PACIENTE: o crédito é tratado pelo webhook de assinatura
    if _re.match(r"^patient_\d+_plan_\w+$", str(mp_data.get("external_reference") or "")):
        return True
    m = _re.match(r"^therapist_(\d+)_plan_(\w+)$", str(mp_data.get("external_reference") or ""))
    if not m:
        return False
    if mp_data.get("status") == "rejected":
        try:
            sub_user = db.get(User, int(m.group(1)))
            if sub_user:
                _alert_failed_charge(sub_user, m.group(2), {
                    "id": mp_payment_id,
                    "retry_attempt": (mp_data.get("metadata") or {}).get("retry_attempt"),
                    "rejection_code": mp_data.get("status_detail"),
                    "transaction_amount": mp_data.get("transaction_amount"),
                    "payment": {
                        "id": mp_payment_id,
                        "status": mp_data.get("status"),
                        "status_detail": mp_data.get("status_detail"),
                    },
                })
        except Exception as e:
            print(f"⚠️ Erro ao tratar recusa de assinatura: {e}")
    return True


@router.post("/webhook/mp")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        raw_body = await request.body()
        x_signature = request.headers.get("x-signature", "")
        x_request_id = request.headers.get("x-request-id", "")

        if MP_WEBHOOK_SECRET and not _verify_mp_signature(raw_body, x_signature, x_request_id):
            raise HTTPException(status_code=400, detail="Assinatura inválida")

        body = json.loads(raw_body)

        # Redireciona assinaturas para o handler correto
        if body.get("type") in ("subscription_preapproval", "subscription_authorized_payment"):
            return await mp_subscription_webhook(request, db)

        if body.get("type") != "payment":
            return {"status": "ignored"}

        mp_payment_id = body.get("data", {}).get("id")
        if not mp_payment_id or not sdk:
            return {"status": "ignored"}

        mp_response = sdk.payment().get(mp_payment_id)
        mp_data = mp_response.get("response", {})
        mp_status = mp_data.get("status")
        external_reference = mp_data.get("external_reference")

        print(f"📦 MP Webhook: status={mp_status} | ref={external_reference}")

        if _handle_subscription_payment(db, mp_payment_id, mp_data):
            return {"status": "subscription_payment"}

        if mp_status != "approved" or not external_reference:
            return {"status": "ignored"}

        payment = db.get(Payment, int(external_reference))
        if not payment:
            return {"status": "ignored"}
        if payment.status == "paid":
            return {"status": "already_processed"}

        wallet = db.get(Wallet, payment.wallet_id)
        if not wallet:
            return {"status": "error", "detail": "Wallet not found"}

        _confirm_appointment_after_payment(payment, wallet, str(mp_payment_id), "MP Webhook", db)
        return {"status": "success"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERRO MP WEBHOOK: {e}")
        import traceback; traceback.print_exc()
        return {"status": "error", "detail": str(e)}


# ============================================
# STATUS DO PAGAMENTO
# ============================================

@router.get("/status/{payment_id}", response_model=PaymentStatusResponse)
def get_payment_status(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    patient_id = get_patient_id_from_user(db, current_user.id)
    if payment.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return PaymentStatusResponse(
        payment_id=payment.id,
        appointment_id=payment.appointment_id,
        amount=payment.amount,
        status=payment.status,
        created_at=payment.created_at,
        paid_at=payment.paid_at,
    )


# ============================================
# ASSINATURAS — Apple In-App Purchase (StoreKit)
# ============================================

def _activate_apple_subscription(therapist_profile, plan, transaction_info, db):
    """
    Cria ou atualiza a Subscription do terapeuta com base numa transacao Apple
    ja verificada. Reaproveita o mesmo model usado por MP/Stripe, mas marca
    payment_provider='apple_iap' e guarda o original_transaction_id da Apple.
    """
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    from datetime import datetime as dt

    now = dt.now()
    expires_at = None
    if transaction_info.expires_date_ms:
        expires_at = dt.fromtimestamp(transaction_info.expires_date_ms / 1000)

    existing = db.execute(
        select(Subscription).where(Subscription.therapist_id == therapist_profile.id)
    ).scalar_one_or_none()

    is_new_activation = True

    if existing:
        is_new_activation = existing.status != "active" or existing.plan != plan
        existing.plan = plan
        existing.status = "active"
        existing.payment_provider = "apple_iap"
        existing.apple_original_transaction_id = transaction_info.original_transaction_id
        existing.stripe_subscription_id = transaction_info.transaction_id
        existing.current_period_start = now
        existing.current_period_end = expires_at
        existing.cancel_at_period_end = False
        existing.updated_at = now
    else:
        db.add(Subscription(
            therapist_id=therapist_profile.id,
            plan=plan,
            status="active",
            payment_provider="apple_iap",
            apple_original_transaction_id=transaction_info.original_transaction_id,
            stripe_subscription_id=transaction_info.transaction_id,
            current_period_start=now,
            current_period_end=expires_at,
            cancel_at_period_end=False,
        ))

    db.commit()

    if is_new_activation:
        try:
            therapist_user = db.get(User, therapist_profile.user_id)
            if therapist_user:
                NotificationService(db).notify_subscription_activated(therapist_user, get_plan_name(plan))
        except Exception as e:
            print(f"⚠️ Erro notificação Apple IAP: {e}")


@router.post("/apple/validate")
async def validate_apple_purchase(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Recebe o signedTransaction (JWS) retornado pelo StoreKit apos uma compra
    no app iOS, valida com a Apple, e ativa o plano correspondente.

    Body esperado: { "signed_transaction": "ey..." }
    """
    from app.services.apple_iap_service import verify_transaction
    from appstoreserverlibrary.signed_data_verifier import VerificationException

    body = await request.json()
    signed_transaction = body.get("signed_transaction")

    if not signed_transaction:
        raise HTTPException(status_code=400, detail="signed_transaction é obrigatório")

    try:
        transaction_info = verify_transaction(signed_transaction)
    except VerificationException as e:
        print(f"❌ Falha na verificação da transação Apple: {e}")
        raise HTTPException(status_code=400, detail=f"Transação inválida: {e}")
    except Exception as e:
        print(f"❌ Erro inesperado ao verificar transação Apple: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro ao validar compra com a Apple")

    plan = transaction_info.plan
    if not plan:
        raise HTTPException(
            status_code=400,
            detail=f"Product ID não reconhecido: {transaction_info.product_id}"
        )

    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil do terapeuta não encontrado")

    _activate_apple_subscription(therapist_profile, plan, transaction_info, db)

    print(f"✅ Assinatura Apple IAP ativada: terapeuta {current_user.id} - plano {plan} - tx {transaction_info.transaction_id}")

    return {
        "status": "active",
        "plan": plan,
        "transaction_id": transaction_info.transaction_id,
        "original_transaction_id": transaction_info.original_transaction_id,
    }


@router.post("/apple/notifications")
async def apple_server_notifications(request: Request, db: Session = Depends(get_db)):
    """
    Webhook que recebe App Store Server Notifications V2.
    Configurado em App Store Connect > App Information > App Store Server Notifications.

    Body esperado: { "signedPayload": "ey..." }
    """
    from app.services.apple_iap_service import verify_notification, APPLE_PRODUCT_TO_PLAN
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    from appstoreserverlibrary.signed_data_verifier import VerificationException
    from datetime import datetime as dt

    try:
        body = await request.json()
        signed_payload = body.get("signedPayload")

        if not signed_payload:
            return {"status": "ignored", "detail": "signedPayload ausente"}

        try:
            notification = verify_notification(signed_payload)
        except VerificationException as e:
            print(f"❌ Falha na verificação da notificação Apple: {e}")
            return {"status": "ignored", "detail": "assinatura inválida"}

        notification_type = str(notification.notificationType)
        subtype = str(notification.subtype) if notification.subtype else None

        print(f"🔔 Apple Server Notification: type={notification_type} | subtype={subtype}")

        transaction_data = None
        if notification.data and notification.data.signedTransactionInfo:
            from app.services.apple_iap_service import get_signed_data_verifier
            verifier = get_signed_data_verifier()
            transaction_data = verifier.verify_and_decode_signed_transaction(
                notification.data.signedTransactionInfo
            )

        if not transaction_data:
            return {"status": "ignored", "detail": "sem dados de transação"}

        original_transaction_id = transaction_data.originalTransactionId
        product_id = transaction_data.productId
        plan = APPLE_PRODUCT_TO_PLAN.get(product_id)

        subscription = db.execute(
            select(Subscription).where(
                Subscription.apple_original_transaction_id == original_transaction_id
            )
        ).scalar_one_or_none()

        if not subscription:
            print(f"⚠️ Subscription não encontrada para original_transaction_id={original_transaction_id}")
            return {"status": "ignored", "detail": "assinatura não encontrada"}

        now = dt.now()

        # Eventos que renovam/mantêm a assinatura ativa
        if notification_type in ("DID_RENEW", "SUBSCRIBED", "DID_CHANGE_RENEWAL_STATUS"):
            expires_at = None
            if getattr(transaction_data, "expiresDate", None):
                expires_at = dt.fromtimestamp(transaction_data.expiresDate / 1000)
            subscription.status = "active"
            if plan:
                subscription.plan = plan
            subscription.current_period_end = expires_at
            subscription.updated_at = now
            db.commit()
            print(f"✅ Apple IAP renovado/atualizado: original_tx={original_transaction_id}")

        # Eventos de cancelamento/expiração/reembolso
        elif notification_type in ("EXPIRED", "REFUND", "REVOKE", "GRACE_PERIOD_EXPIRED"):
            old_plan = subscription.plan
            subscription.status = "cancelled"
            subscription.plan = "basico"
            subscription.updated_at = now
            db.commit()
            try:
                therapist_user = db.get(User, subscription.therapist.user_id)
                if therapist_user:
                    NotificationService(db).notify_subscription_cancelled(therapist_user, get_plan_name(old_plan))
            except Exception as e:
                print(f"⚠️ Erro notificação cancelamento Apple: {e}")
            print(f"⚠️ Apple IAP cancelado/expirado: original_tx={original_transaction_id} | type={notification_type}")

        # DID_FAIL_TO_RENEW — mantem o status atual, Apple vai tentar de novo (grace period)
        elif notification_type == "DID_FAIL_TO_RENEW":
            subscription.status = "past_due"
            subscription.updated_at = now
            db.commit()
            print(f"⚠️ Apple IAP falhou ao renovar: original_tx={original_transaction_id}")

        return {"status": "success"}

    except Exception as e:
        print(f"❌ ERRO APPLE NOTIFICATIONS WEBHOOK: {e}")
        import traceback; traceback.print_exc()
        return {"status": "error", "detail": str(e)}


@router.post("/therapist/subscription/apple/cancel-info")
async def apple_subscription_cancel_info(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Assinaturas Apple IAP nao podem ser canceladas via API do backend —
    o cancelamento e sempre feito pelo usuario nas configuracoes do iOS.
    Este endpoint apenas retorna a URL de gerenciamento para o frontend abrir.
    """
    from app.models.subscription import Subscription

    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    subscription = db.execute(
        select(Subscription).where(
            Subscription.therapist_id == therapist_profile.id,
            Subscription.payment_provider == "apple_iap",
        )
    ).scalar_one_or_none()

    return {
        "manage_url": "itms-apps://apps.apple.com/account/subscriptions",
        "has_apple_subscription": subscription is not None and subscription.status == "active",
    }
# ==========================
# 🔥 GET ASSINATURA DO TERAPEUTA
# ==========================
@router.get("/therapist/subscription", response_model=dict)
async def get_therapist_subscription(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Retorna assinatura atual do terapeuta com detalhes completos"""
    from app.models.therapist_profile import TherapistProfile
    from app.models.subscription import Subscription
    from app.models.commission import Commission
    from app.models.appointment import Appointment
    import mercadopago
    import os

    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()

    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    subscription = db.query(Subscription).filter(
        Subscription.therapist_id == therapist.id,
        Subscription.status.in_(["active", "past_due", "paused"])
    ).first()

    # Histórico de cobranças via MP (últimas 12)
    billing_history = []
    if subscription and subscription.stripe_subscription_id:
        try:
            mp_access_token = os.getenv("MP_ACCESS_TOKEN", "")
            if mp_access_token:
                sdk = mercadopago.SDK(mp_access_token)
                result = sdk.preapproval().search({
                    "id": subscription.stripe_subscription_id
                })
                if result.get("status") == 200:
                    payments_result = sdk.authorized_payments().search({
                        "preapproval_id": subscription.stripe_subscription_id,
                        "limit": 12
                    })
                    if payments_result.get("status") == 200:
                        for p in payments_result["response"].get("results", []):
                            billing_history.append({
                                "id": p.get("id"),
                                "date": p.get("date_approved") or p.get("date_created"),
                                "amount": p.get("transaction_amount"),
                                "status": p.get("status"),
                                "description": f"Assinatura {subscription.plan.title()} - Meu Divã"
                            })
        except Exception as e:
            print(f"⚠️ Erro ao buscar histórico MP: {e}")

    # Histórico de comissões (ganhos)
    commissions = db.query(Commission).filter(
        Commission.therapist_id == therapist.id,
        Commission.is_refund == False
    ).order_by(Commission.created_at.desc()).limit(12).all()

    plan_names = {
        "basico": "Básico",
        "essencial": "Essencial",
        "profissional": "Profissional",
        "premium": "Premium"
    }
    plan_commissions = {
        "basico": 20,
        "essencial": 20,
        "profissional": 10,
        "premium": 3
    }

    current_plan = subscription.plan if subscription else "basico"

    return {
        "subscription": {
            "id": subscription.id if subscription else None,
            "plan": current_plan,
            "plan_name": plan_names.get(current_plan, current_plan.title()),
            "status": subscription.status if subscription else "active",
            "commission_rate": plan_commissions.get(current_plan, 20),
            "payment_provider": subscription.payment_provider if subscription else None,
            "mp_subscription_id": subscription.stripe_subscription_id if subscription else None,
            "current_period_start": subscription.current_period_start.isoformat() if subscription and subscription.current_period_start else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription and subscription.current_period_end else None,
            "cancel_at_period_end": subscription.cancel_at_period_end if subscription else False,
            "created_at": subscription.created_at.isoformat() if subscription and subscription.created_at else None,
        },
        "billing_history": billing_history,
        "earnings_summary": {
            "total_sessions": len(commissions),
            "total_earned": float(sum(c.net_amount for c in commissions)),
            "total_commission_paid": float(sum(c.commission_amount for c in commissions)),
            "recent": [
                {
                    "date": c.created_at.isoformat(),
                    "session_price": float(c.session_price),
                    "commission_rate": float(c.commission_rate),
                    "commission_amount": float(c.commission_amount),
                    "net_amount": float(c.net_amount),
                }
                for c in commissions[:6]
            ]
        }
    }


# ==========================
# 🔥 PAUSAR ASSINATURA MP
# ==========================
@router.post("/therapist/subscription/pause", response_model=dict)
async def pause_mp_subscription(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Pausa a assinatura do terapeuta no Mercado Pago"""
    from app.models.therapist_profile import TherapistProfile
    from app.models.subscription import Subscription
    import mercadopago
    import os

    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()

    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    subscription = db.query(Subscription).filter(
        Subscription.therapist_id == therapist.id,
        Subscription.status == "active"
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada")

    if subscription.payment_provider == "apple_iap":
        raise HTTPException(status_code=400, detail="Assinaturas Apple não podem ser pausadas aqui. Gerencie pelo app da Apple.")

    mp_access_token = os.getenv("MP_ACCESS_TOKEN", "")
    if mp_access_token and subscription.stripe_subscription_id:
        try:
            sdk = mercadopago.SDK(mp_access_token)
            sdk.preapproval().update(
                subscription.stripe_subscription_id,
                {"status": "paused"}
            )
        except Exception as e:
            print(f"⚠️ Erro ao pausar no MP: {e}")

    subscription.status = "paused"
    subscription.updated_at = datetime.now()
    db.commit()

    return {"success": True, "message": "Assinatura pausada. Você pode reativar a qualquer momento."}


# ==========================
# 🔥 REATIVAR ASSINATURA MP
# ==========================
@router.post("/therapist/subscription/resume", response_model=dict)
async def resume_mp_subscription(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Reativa uma assinatura pausada"""
    from app.models.therapist_profile import TherapistProfile
    from app.models.subscription import Subscription
    import mercadopago
    import os

    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()

    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    subscription = db.query(Subscription).filter(
        Subscription.therapist_id == therapist.id,
        Subscription.status == "paused"
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura pausada encontrada")

    mp_access_token = os.getenv("MP_ACCESS_TOKEN", "")
    if mp_access_token and subscription.stripe_subscription_id:
        try:
            sdk = mercadopago.SDK(mp_access_token)
            sdk.preapproval().update(
                subscription.stripe_subscription_id,
                {"status": "authorized"}
            )
        except Exception as e:
            print(f"⚠️ Erro ao reativar no MP: {e}")

    subscription.status = "active"
    subscription.updated_at = datetime.now()
    db.commit()

    return {"success": True, "message": "Assinatura reativada com sucesso!"}


@router.get("/therapist/commissions")
async def get_therapist_commissions(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Retorna histórico de comissões/recebimentos do terapeuta"""
    from app.models.commission import Commission
    from app.models.appointment import Appointment

    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    commissions = db.execute(
        select(Commission)
        .where(Commission.therapist_id == therapist_profile.id)
        .order_by(Commission.created_at.desc())
    ).scalars().all()

    result = []
    for c in commissions:
        appointment = db.get(Appointment, c.appointment_id)
        result.append({
            "id": c.id,
            "appointment_id": c.appointment_id,
            "session_price": float(c.session_price),
            "commission_rate": float(c.commission_rate),
            "commission_amount": float(c.commission_amount),
            "net_amount": float(c.net_amount),
            "is_refund": c.is_refund,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "appointment": {
                "id": appointment.id,
                "starts_at": appointment.starts_at.isoformat() if appointment else None,
            } if appointment else None,
        })

    return result
