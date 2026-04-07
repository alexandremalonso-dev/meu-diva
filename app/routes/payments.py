import os
import stripe
import json
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.config import settings
from app.core.pricing_config import get_plan_price_cents, get_plan_name

from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.wallet import Wallet, Payment, Ledger
from app.models.appointment import Appointment
from app.models.therapist_profile import TherapistProfile

from app.core.appointment_status import AppointmentStatus

from app.schemas.payment import (
    CreateCheckoutRequest,
    CreateCheckoutResponse,
    PaymentStatusResponse
)

# 🔥 IMPORTAR SERVIÇO DO GOOGLE MEET
from app.core.google_meet import google_meet_service
from app.services.email_service import email_service

# ============================================
# CONFIG STRIPE
# ============================================

STRIPE_SECRET_KEY = settings.stripe_secret_key or os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = settings.stripe_webhook_secret or os.getenv("STRIPE_WEBHOOK_SECRET", "")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
    print("✅ Stripe configurado com chave real")
else:
    print("⚠️ Stripe em modo MOCK - sem chave configurada")

# ============================================
# ROUTER
# ============================================

router = APIRouter(prefix="/payments", tags=["payments"])

# ============================================
# HELPERS
# ============================================

def get_patient_id_from_user(db: Session, user_id: int) -> int:
    patient = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    ).scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")

    return patient.id


def get_patient_wallet(db: Session, patient_id: int) -> Wallet:
    wallet = db.execute(
        select(Wallet).where(Wallet.patient_id == patient_id)
    ).scalar_one_or_none()

    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")

    return wallet


# 🔥 FUNÇÃO PARA GERAR MEET, ENVIAR EMAILS E NOTIFICAÇÕES
def generate_meet_and_send_emails_and_notifications(appointment: Appointment, db: Session):
    """Gera link do Google Meet, envia e-mails e cria notificações no dashboard"""
    meet_url = None
    try:
        if google_meet_service:
            meet_url = google_meet_service.create_meet_link(appointment)
            if meet_url:
                appointment.video_call_url = meet_url
                db.commit()
                print(f"✅ [WEBHOOK] Meet gerado com sucesso: {meet_url}")
            else:
                print(f"⚠️ [WEBHOOK] create_meet_link retornou None")
        else:
            print(f"⚠️ [WEBHOOK] google_meet_service não disponível")
    except Exception as e:
        print(f"❌ [WEBHOOK] Erro ao gerar Meet: {e}")
        import traceback
        traceback.print_exc()
    
    # Enviar e-mails de confirmação
    try:
        patient = db.get(User, appointment.patient_user_id)
        therapist = db.get(User, appointment.therapist_user_id)
        if patient and therapist:
            email_service.send_appointment_confirmation(
                appointment, patient.email, therapist.email, meet_url
            )
            print(f"📧 [WEBHOOK] E-mails de confirmação enviados")
        else:
            print(f"⚠️ [WEBHOOK] Paciente ou terapeuta não encontrados")
    except Exception as e:
        print(f"⚠️ [WEBHOOK] Erro ao enviar e-mails: {e}")
    
    # 🔥 CRIAR NOTIFICAÇÕES NO DASHBOARD
    try:
        from app.services.notification_service import NotificationService
        patient = db.get(User, appointment.patient_user_id)
        therapist = db.get(User, appointment.therapist_user_id)
        
        if patient and therapist:
            notification_service = NotificationService(db)
            notification_service.notify_appointment_confirmed(
                appointment, patient, therapist, meet_url
            )
            print(f"🔔 [WEBHOOK] Notificações de confirmação criadas")
    except Exception as e:
        print(f"⚠️ [WEBHOOK] Erro ao criar notificações: {e}")


# 🔥 FUNÇÃO PARA REGISTRAR COMISSÃO
def get_therapist_commission_rate(therapist_user_id: int, db: Session) -> float:
    """Retorna a taxa de comissão baseada no plano ativo do terapeuta"""
    from app.models.subscription import Subscription
    
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == therapist_user_id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        return 20.0
    
    subscription = db.execute(
        select(Subscription).where(
            Subscription.therapist_id == therapist_profile.id,
            Subscription.status == "active"
        )
    ).scalar_one_or_none()
    
    if not subscription:
        return 20.0
    if subscription.plan == "essencial":
        return 20.0
    if subscription.plan == "profissional":
        return 10.0
    if subscription.plan == "premium":
        return 3.0
    
    return 20.0


def register_commission(
    appointment_id: int,
    therapist_user_id: int,
    patient_user_id: int,
    session_price: float,
    commission_rate: float,
    db: Session,
    is_refund: bool = False,
    refunded_from_id: int = None
):
    """Registra uma comissão (ou estorno de comissão) no banco"""
    from app.models.commission import Commission
    from app.models.patient_profile import PatientProfile
    from app.models.therapist_profile import TherapistProfile
    
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == therapist_user_id)
    ).scalar_one_or_none()
    
    patient_profile = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == patient_user_id)
    ).scalar_one_or_none()
    
    if not therapist_profile or not patient_profile:
        print(f"⚠️ Perfis não encontrados para comissão: therapist={therapist_user_id}, patient={patient_user_id}")
        return
    
    commission_amount = (session_price * commission_rate) / 100
    net_amount = session_price - commission_amount
    
    if is_refund:
        commission_amount = -commission_amount
        net_amount = -net_amount
    
    commission = Commission(
        appointment_id=appointment_id,
        therapist_id=therapist_profile.id,
        patient_id=patient_profile.id,
        session_price=session_price,
        commission_rate=commission_rate,
        commission_amount=commission_amount,
        net_amount=net_amount,
        is_refund=is_refund,
        refunded_from_id=refunded_from_id
    )
    db.add(commission)
    print(f"✅ Comissão registrada: taxa={commission_rate}%, valor={commission_amount}, líquido={net_amount}")


# ============================================
# FUNÇÕES PARA ASSINATURAS (PLANOS)
# ============================================

def handle_subscription_created(subscription_data: dict, db: Session):
    """Cria assinatura no banco quando criada no Stripe e notifica terapeuta"""
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    
    stripe_subscription_id = subscription_data.get("id")
    customer_id = subscription_data.get("customer")
    plan_id = subscription_data.get("items", {}).get("data", [{}])[0].get("price", {}).get("id")
    current_period_start = datetime.fromtimestamp(subscription_data.get("current_period_start", 0))
    current_period_end = datetime.fromtimestamp(subscription_data.get("current_period_end", 0))
    status = subscription_data.get("status", "active")
    
    # Mapear price_id para plano
    plan_map = {
        "price_essencial": "essencial",
        "price_profissional": "profissional", 
        "price_premium": "premium"
    }
    plan = plan_map.get(plan_id, "essencial")
    
    # Buscar terapeuta pelo customer_id
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.stripe_customer_id == customer_id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        print(f"⚠️ Terapeuta não encontrado para customer {customer_id}")
        return
    
    # Mapear plano para nome amigável
    plan_display_name = get_plan_name(plan)
    
    # Verificar se já existe assinatura
    existing = db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    ).scalar_one_or_none()
    
    if existing:
        existing.status = status
        existing.plan = plan
        existing.current_period_start = current_period_start
        existing.current_period_end = current_period_end
        existing.updated_at = datetime.now()
    else:
        subscription = Subscription(
            therapist_id=therapist_profile.id,
            plan=plan,
            status=status,
            stripe_subscription_id=stripe_subscription_id,
            stripe_customer_id=customer_id,
            current_period_start=current_period_start,
            current_period_end=current_period_end
        )
        db.add(subscription)
    
    db.commit()
    print(f"✅ Assinatura {stripe_subscription_id} - Plano: {plan} - Status: {status}")
    
    # 🔥 Notificar terapeuta sobre ativação da assinatura
    try:
        therapist_user = db.get(User, therapist_profile.user_id)
        if therapist_user and status == "active":
            notification_service = NotificationService(db)
            notification_service.notify_subscription_activated(therapist_user, plan_display_name)
            print(f"🔔 Notificação de assinatura ativada enviada para terapeuta {therapist_user.id}")
    except Exception as e:
        print(f"⚠️ Erro ao enviar notificação de ativação: {e}")


def handle_subscription_updated(subscription_data: dict, db: Session):
    """Atualiza status da assinatura (incluindo downgrade automático) e notifica terapeuta"""
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    
    stripe_subscription_id = subscription_data.get("id")
    status = subscription_data.get("status")
    current_period_start = datetime.fromtimestamp(subscription_data.get("current_period_start", 0))
    current_period_end = datetime.fromtimestamp(subscription_data.get("current_period_end", 0))
    cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)
    
    subscription = db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    ).scalar_one_or_none()
    
    if not subscription:
        print(f"⚠️ Assinatura não encontrada: {stripe_subscription_id}")
        return
    
    old_plan = subscription.plan
    subscription.status = status
    subscription.current_period_start = current_period_start
    subscription.current_period_end = current_period_end
    subscription.cancel_at_period_end = cancel_at_period_end
    subscription.updated_at = datetime.now()
    
    if status in ["canceled", "expired", "incomplete_expired", "past_due"]:
        subscription.plan = "essencial"
        print(f"🔄 Downgrade automático para plano essencial - Terapeuta {subscription.therapist_id}")
    
    db.commit()
    print(f"✅ Assinatura atualizada: {stripe_subscription_id} - Status: {status} - Plano: {subscription.plan}")
    
    # 🔥 Notificar terapeuta sobre cancelamento da assinatura
    if status in ["canceled", "expired", "incomplete_expired"]:
        try:
            therapist_user = db.get(User, subscription.therapist_profile.user_id)
            if therapist_user:
                plan_display_name = get_plan_name(old_plan)
                notification_service = NotificationService(db)
                notification_service.notify_subscription_cancelled(therapist_user, plan_display_name)
                print(f"🔔 Notificação de assinatura cancelada enviada para terapeuta {therapist_user.id}")
        except Exception as e:
            print(f"⚠️ Erro ao enviar notificação de cancelamento: {e}")


def handle_subscription_deleted(subscription_data: dict, db: Session):
    """Remove ou marca como cancelada a assinatura e notifica terapeuta"""
    from app.models.subscription import Subscription
    from app.services.notification_service import NotificationService
    
    stripe_subscription_id = subscription_data.get("id")
    
    subscription = db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    ).scalar_one_or_none()
    
    if subscription:
        old_plan = subscription.plan
        subscription.status = "cancelled"
        subscription.plan = "essencial"
        subscription.updated_at = datetime.now()
        db.commit()
        print(f"✅ Assinatura cancelada e downgrade para essencial: {stripe_subscription_id}")
        
        # 🔥 Notificar terapeuta sobre cancelamento
        try:
            therapist_user = db.get(User, subscription.therapist_profile.user_id)
            if therapist_user:
                plan_display_name = get_plan_name(old_plan)
                notification_service = NotificationService(db)
                notification_service.notify_subscription_cancelled(therapist_user, plan_display_name)
                print(f"🔔 Notificação de assinatura cancelada enviada para terapeuta {therapist_user.id}")
        except Exception as e:
            print(f"⚠️ Erro ao enviar notificação de cancelamento: {e}")


def handle_invoice_payment_failed(invoice_data: dict, db: Session):
    """Notifica sobre falha no pagamento da assinatura"""
    from app.services.notification_service import NotificationService
    
    subscription_id = invoice_data.get("subscription")
    customer_id = invoice_data.get("customer")
    
    print(f"⚠️ Falha no pagamento da assinatura: {subscription_id}")
    print(f"   Cliente: {customer_id}")
    
    # 🔥 Notificar terapeuta sobre falha no pagamento
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.stripe_customer_id == customer_id)
        ).scalar_one_or_none()
        
        if therapist_profile:
            therapist_user = db.get(User, therapist_profile.user_id)
            if therapist_user:
                notification_service = NotificationService(db)
                notification_service.create_notification(
                    user_id=therapist_user.id,
                    notification_type="subscription_payment_failed",
                    title="Falha no pagamento da assinatura",
                    message=f"O pagamento da sua assinatura falhou. Verifique seus dados de pagamento para não perder os benefícios.",
                    data={"subscription_id": subscription_id},
                    action_link="/therapist/subscription"
                )
                print(f"🔔 Notificação de falha no pagamento enviada para terapeuta {therapist_user.id}")
    except Exception as e:
        print(f"⚠️ Erro ao enviar notificação de falha no pagamento: {e}")


# ============================================
# CREATE CHECKOUT (PARA SESSÕES)
# ============================================

@router.post("/create-checkout", response_model=CreateCheckoutResponse)
async def create_checkout(
    payload: CreateCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    print(f"\n💳 Checkout - User {current_user.id} - Appointment {payload.appointment_id}")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Valor inválido")

    appointment = db.get(Appointment, payload.appointment_id)

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment não encontrado")

    if appointment.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if appointment.status not in [AppointmentStatus.scheduled, AppointmentStatus.proposed]:
        print(f"❌ Status inválido: {appointment.status}")
        raise HTTPException(
            status_code=400, 
            detail=f"Appointment inválido para pagamento. Status atual: {appointment.status}"
        )

    print(f"✅ Appointment status válido: {appointment.status}")

    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet(db, patient_id)

    payment = Payment(
        patient_id=patient_id,
        wallet_id=wallet.id,
        appointment_id=appointment.id,
        amount=Decimal(payload.amount),
        currency="BRL",
        status="pending",
        description=f"Pagamento sessão #{appointment.id}"
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    if not STRIPE_SECRET_KEY:
        print("⚠️ Stripe não configurado - usando modo MOCK")
        return CreateCheckoutResponse(
            checkout_url=f"http://localhost:3000/mock-payment/{payment.id}",
            session_id=f"mock_{payment.id}"
        )

    try:
        if appointment.status == AppointmentStatus.proposed:
            product_description = f"Convite para sessão em {appointment.starts_at.strftime('%d/%m/%Y %H:%M')}"
        else:
            product_description = f"Sessão agendada para {appointment.starts_at.strftime('%d/%m/%Y %H:%M')}"

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "brl",
                    "unit_amount": int(payload.amount * 100),
                    "product_data": {
                        "name": "Sessão de terapia - Meu Divã",
                        "description": product_description,
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            metadata={
                "payment_id": str(payment.id),
                "appointment_id": str(appointment.id),
                "type": "appointment_payment",
                "appointment_status": appointment.status.value,
                "already_debited": str(getattr(payload, 'already_debited', 0))
            }
        )

        payment.stripe_session_id = session.id
        db.commit()

        print(f"✅ Checkout Stripe criado: {session.url}")
        
        return CreateCheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )
        
    except Exception as e:
        print(f"❌ Erro ao criar checkout Stripe: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar checkout: {str(e)}")


# ============================================
# CREATE CHECKOUT PARA ASSINATURA (PLANO)
# ============================================

@router.post("/create-subscription-checkout")
async def create_subscription_checkout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Cria checkout para assinatura de plano (Profissional ou Premium)"""
    body = await request.json()
    plan = body.get("plan", "profissional")
    
    # 🔥 Preços em centavos
    prices = {
        "profissional": 7900,
        "premium": 14900
    }
    
    price = prices.get(plan)
    if not price:
        raise HTTPException(status_code=400, detail="Plano inválido")
    
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    customer_id = therapist_profile.stripe_customer_id
    
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.full_name or current_user.email,
            metadata={"user_id": str(current_user.id)}
        )
        customer_id = customer.id
        therapist_profile.stripe_customer_id = customer_id
        db.commit()
    
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "brl",
                "product_data": {
                    "name": f"Plano {plan.capitalize()} - Meu Divã",
                    "description": f"Assinatura mensal do plano {plan.capitalize()} com comissão reduzida"
                },
                "unit_amount": price,
                "recurring": {"interval": "month"}
            },
            "quantity": 1,
        }],
        customer=customer_id,
        success_url=f"{settings.FRONTEND_URL}/therapist/subscription?success=true",
        cancel_url=f"{settings.FRONTEND_URL}/therapist/subscription?canceled=true",
        metadata={
            "type": "subscription",
            "plan": plan,
            "therapist_id": str(therapist_profile.id)
        }
    )
    
    return {"checkout_url": session.url}


# ============================================
# WEBHOOK - CORRIGIDO (Meet gerado APÓS pagamento total)
# ============================================

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    print("\n" + "="*70)
    print("🔔 WEBHOOK RECEBIDO")
    print("="*70)

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                STRIPE_WEBHOOK_SECRET
            )
        else:
            event = json.loads(payload)

    except Exception as e:
        print("❌ Erro validação webhook:", e)
        raise HTTPException(status_code=400, detail="Webhook inválido")

    event_type = event.get("type")
    print(f"📦 Evento: {event_type}")

    # ========================================
    # PAGAMENTO DE SESSÃO
    # ========================================
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {}) or {}

        if metadata.get("type") == "subscription":
            print("📋 É assinatura - ignorado neste handler")
            return {"status": "ignored"}
        
        payment_id = metadata.get("payment_id")
        appointment_id = metadata.get("appointment_id")
        already_debited = float(metadata.get("already_debited", 0))

        print(f"📋 payment_id: {payment_id}")
        print(f"📋 appointment_id: {appointment_id}")
        print(f"📋 already_debited: R$ {already_debited}")

        if not payment_id:
            print("⚠️ payment_id ausente")
            return {"status": "ignored"}

        payment = db.get(Payment, int(payment_id))

        if not payment:
            print("⚠️ payment não encontrado")
            return {"status": "ignored"}

        if payment.status == "paid":
            print("⚠️ pagamento já processado")
            return {"status": "already_processed"}

        wallet = db.get(Wallet, payment.wallet_id)

        if not wallet:
            raise Exception("Wallet não encontrada")

        # CRÉDITO DO PAGAMENTO STRIPE
        old_balance = wallet.balance
        wallet.balance += payment.amount

        credit = Ledger(
            wallet_id=wallet.id,
            transaction_type="credit_purchase",
            amount=payment.amount,
            balance_after=wallet.balance,
            description="Recarga via Stripe",
            meta_data={"payment_id": payment.id}
        )
        db.add(credit)

        payment.status = "paid"
        payment.paid_at = datetime.now()

        # 🔥 CONFIRMAR APPOINTMENT
        if appointment_id:
            appointment = db.get(Appointment, int(appointment_id))

            if appointment:
                print(f"\n📋 Processando sessão {appointment.id}")
                
                # ATUALIZAR STATUS
                old_status = appointment.status
                if appointment.status == AppointmentStatus.proposed:
                    appointment.status = AppointmentStatus.confirmed
                elif appointment.status == AppointmentStatus.scheduled:
                    appointment.status = AppointmentStatus.confirmed
                print(f"✅ Status atualizado: {old_status} → {appointment.status}")

                # 🔥 DÉBITO DA SESSÃO (valor total)
                existing_debit = db.execute(
                    select(Ledger).where(
                        Ledger.appointment_id == appointment.id,
                        Ledger.transaction_type == "session_debit"
                    )
                ).scalar_one_or_none()
                
                if not existing_debit:
                    wallet.balance -= appointment.session_price
                    debit = Ledger(
                        wallet_id=wallet.id,
                        appointment_id=appointment.id,
                        transaction_type="session_debit",
                        amount=appointment.session_price,
                        balance_after=wallet.balance,
                        description=f"Sessão {appointment.id} - Pagamento confirmado"
                    )
                    db.add(debit)
                    print(f"💰 Débito realizado: R$ {appointment.session_price}")
                
                # 🔥 GERAR MEET, ENVIAR EMAILS E NOTIFICAÇÕES (SÓ DEPOIS DO PAGAMENTO TOTAL)
                generate_meet_and_send_emails_and_notifications(appointment, db)
                
                # 🔥 REGISTRAR COMISSÃO
                commission_rate = get_therapist_commission_rate(appointment.therapist_user_id, db)
                register_commission(
                    appointment_id=appointment.id,
                    therapist_user_id=appointment.therapist_user_id,
                    patient_user_id=appointment.patient_user_id,
                    session_price=float(appointment.session_price),
                    commission_rate=commission_rate,
                    db=db
                )

        db.commit()
        print(f"💰 Webhook concluído! Saldo final: R$ {wallet.balance}")

    # ========================================
    # ASSINATURAS (PLANOS)
    # ========================================
    elif event_type == "customer.subscription.created":
        handle_subscription_created(event["data"]["object"], db)
    
    elif event_type == "customer.subscription.updated":
        handle_subscription_updated(event["data"]["object"], db)
    
    elif event_type == "customer.subscription.deleted":
        handle_subscription_deleted(event["data"]["object"], db)
    
    elif event_type == "invoice.payment_failed":
        handle_invoice_payment_failed(event["data"]["object"], db)

    return {"status": "success"}


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
        paid_at=payment.paid_at
    )