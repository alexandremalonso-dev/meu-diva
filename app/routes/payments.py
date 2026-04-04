import os
import stripe
import json
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.config import settings

from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.wallet import Wallet, Payment, Ledger
from app.models.appointment import Appointment

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

# Usar configuração do settings
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

    # 🔥 CORREÇÃO: Permitir pagamento para appointments com status 'scheduled' OU 'proposed'
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

    # =========================
    # MOCK (SE STRIPE NÃO CONFIGURADO)
    # =========================
    if not STRIPE_SECRET_KEY:
        print("⚠️ Stripe não configurado - usando modo MOCK")
        return CreateCheckoutResponse(
            checkout_url=f"http://localhost:3000/mock-payment/{payment.id}",
            session_id=f"mock_{payment.id}"
        )

    # =========================
    # STRIPE REAL
    # =========================
    try:
        # Determinar descrição do produto baseada no status
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
                "appointment_status": appointment.status.value
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
# WEBHOOK (PROFISSIONAL) - CORRIGIDO COM MEET
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
            # fallback mock
            event = json.loads(payload)

    except Exception as e:
        print("❌ Erro validação webhook:", e)
        raise HTTPException(status_code=400, detail="Webhook inválido")

    event_type = event.get("type")
    print(f"📦 Evento: {event_type}")

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {}) or {}

        payment_id = metadata.get("payment_id")
        appointment_id = metadata.get("appointment_id")
        appointment_status = metadata.get("appointment_status", "scheduled")

        print(f"📋 payment_id: {payment_id}")
        print(f"📋 appointment_id: {appointment_id}")
        print(f"📋 appointment_status: {appointment_status}")

        if not payment_id:
            print("⚠️ payment_id ausente")
            return {"status": "ignored"}

        payment = db.get(Payment, int(payment_id))

        if not payment:
            print("⚠️ payment não encontrado")
            return {"status": "ignored"}

        # IDEMPOTÊNCIA
        if payment.status == "paid":
            print("⚠️ pagamento já processado")
            return {"status": "already_processed"}

        wallet = db.get(Wallet, payment.wallet_id)

        if not wallet:
            raise Exception("Wallet não encontrada")

        # CRÉDITO
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

        # ATUALIZA PAYMENT
        payment.status = "paid"
        payment.paid_at = datetime.now()

        # 🔥 CONFIRMAR APPOINTMENT E GERAR MEET
        if appointment_id:
            appointment = db.get(Appointment, int(appointment_id))

            if appointment:
                print(f"\n📋 Processando sessão {appointment.id}")
                print(f"   Status atual: {appointment.status}")
                
                # 🔥 ATUALIZAR STATUS DA SESSÃO
                if appointment.status == AppointmentStatus.proposed:
                    appointment.status = AppointmentStatus.confirmed
                    print(f"✅ Convite {appointment.id} confirmado após pagamento")
                elif appointment.status == AppointmentStatus.scheduled:
                    appointment.status = AppointmentStatus.confirmed
                    print(f"✅ Sessão {appointment.id} confirmada após pagamento")

                # 🔥 GERAR LINK DO GOOGLE MEET AUTOMATICAMENTE
                print(f"\n🔗 [WEBHOOK] Gerando Meet para sessão {appointment.id}...")
                
                meet_url = None
                try:
                    if google_meet_service:
                        meet_url = google_meet_service.create_meet_link(appointment)
                        if meet_url:
                            appointment.video_call_url = meet_url
                            print(f"✅ [WEBHOOK] Meet gerado com sucesso: {meet_url}")
                        else:
                            print(f"⚠️ [WEBHOOK] create_meet_link retornou None")
                    else:
                        print(f"⚠️ [WEBHOOK] google_meet_service não disponível")
                except Exception as e:
                    print(f"❌ [WEBHOOK] Erro ao gerar Meet: {e}")
                    import traceback
                    traceback.print_exc()

                # 🔥 DÉBITO DA SESSÃO
                wallet.balance -= appointment.session_price

                debit = Ledger(
                    wallet_id=wallet.id,
                    appointment_id=appointment.id,
                    transaction_type="session_debit",
                    amount=appointment.session_price,
                    balance_after=wallet.balance,
                    description=f"Sessão {appointment.id}"
                )
                db.add(debit)

                print(f"💰 Débito realizado: R$ {appointment.session_price}")
                print(f"💰 Saldo final: R$ {wallet.balance}")
                
                # 🔥 ENVIAR E-MAILS DE CONFIRMAÇÃO COM LINK DO MEET
                try:
                    patient = db.get(User, appointment.patient_user_id)
                    therapist = db.get(User, appointment.therapist_user_id)
                    
                    if patient and therapist:
                        email_service.send_appointment_confirmation(
                            appointment,
                            patient.email,
                            therapist.email,
                            meet_url
                        )
                        print(f"📧 [WEBHOOK] E-mails de confirmação enviados")
                    else:
                        print(f"⚠️ [WEBHOOK] Paciente ou terapeuta não encontrados")
                except Exception as e:
                    print(f"⚠️ [WEBHOOK] Erro ao enviar e-mails: {e}")
                    import traceback
                    traceback.print_exc()

        db.commit()

        print(f"\n💰 Webhook concluído com sucesso!")
        print(f"   Saldo: R$ {old_balance} → R$ {wallet.balance}")
        if meet_url:
            print(f"   Meet: {meet_url}")

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