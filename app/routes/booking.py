from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Security, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from decimal import Decimal
import stripe
import os

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.auth import get_current_user
from app.core.appointment_status import AppointmentStatus
from app.core.audit import get_audit_service

from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.wallet import Wallet, Ledger
from app.models.appointment import Appointment
from app.models.pending_booking import PendingBooking, PendingBookingStatus

from app.schemas.pending_booking import (
    BookWithPaymentRequest,
    BookWithPaymentResponse,
    PendingBookingOut
)
from app.schemas.payment import CreateCheckoutResponse

# Configurar Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/booking", tags=["booking"])

# ==========================
# HELPERS
# ==========================

def get_patient_profile(db: Session, user_id: int) -> PatientProfile:
    """Busca o perfil do paciente"""
    profile = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    ).scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")
    
    return profile

def get_patient_wallet(db: Session, patient_id: int) -> Wallet:
    """Busca a carteira do paciente"""
    wallet = db.execute(
        select(Wallet).where(Wallet.patient_id == patient_id)
    ).scalar_one_or_none()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")
    
    return wallet

def check_availability(
    db: Session,
    therapist_id: int,
    starts_at: datetime,
    ends_at: datetime
) -> bool:
    """Verifica se o horário está disponível"""
    
    # Verificar conflito com appointments existentes
    conflict = db.execute(
        select(Appointment).where(
            and_(
                Appointment.therapist_user_id == therapist_id,
                Appointment.status.in_([
                    AppointmentStatus.scheduled,
                    AppointmentStatus.confirmed,
                    AppointmentStatus.proposed,
                ]),
                starts_at < Appointment.ends_at,
                ends_at > Appointment.starts_at,
            )
        )
    ).scalars().first()
    
    return conflict is None

def create_stripe_checkout(
    amount: Decimal,
    pending_booking_id: int,
    success_url: str,
    cancel_url: str
) -> dict:
    """Cria uma sessão de checkout no Stripe"""
    
    if not STRIPE_SECRET_KEY:
        # Modo mock para desenvolvimento
        return {
            "id": f"mock_{pending_booking_id}",
            "url": f"http://localhost:3000/mock/{pending_booking_id}"
        }
    
    amount_float = float(amount)
    
    checkout_session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "brl",
                "unit_amount": int(amount_float * 100),
                "product_data": {
                    "name": "Complemento para agendamento",
                    "description": f"Valor faltante para agendar sessão",
                },
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "pending_booking_id": str(pending_booking_id),
            "type": "booking_complement"
        }
    )
    
    return {
        "id": checkout_session.id,
        "url": checkout_session.url
    }

# ==========================
# ENDPOINT PRINCIPAL
# ==========================

@router.post("/book", response_model=BookWithPaymentResponse)
async def book_appointment(
    payload: BookWithPaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    """
    Fluxo completo de agendamento com verificação de saldo:
    1. Verifica disponibilidade do horário
    2. Verifica saldo atual
    3. Se saldo suficiente: cria appointment direto
    4. Se saldo insuficiente: cria pending_booking e retorna checkout
    """
    print(f"\n📅 Book appointment - Usuário: {current_user.id}")
    print(f"📦 Payload: therapist_id={payload.therapist_id}, starts_at={payload.starts_at}")
    
    try:
        # ==========================
        # 1. VALIDAR TERAPEUTA
        # ==========================
        therapist = db.get(TherapistProfile, payload.therapist_id)
        if not therapist:
            raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
        
        if not therapist.session_price:
            raise HTTPException(status_code=400, detail="Terapeuta não definiu preço da sessão")
        
        # ==========================
        # 2. VALIDAR HORÁRIO
        # ==========================
        ends_at = payload.ends_at
        if not check_availability(db, therapist.user_id, payload.starts_at, ends_at):
            raise HTTPException(status_code=409, detail="Horário não disponível")
        
        # ==========================
        # 3. BUSCAR CARTEIRA DO PACIENTE
        # ==========================
        patient_profile = get_patient_profile(db, current_user.id)
        wallet = get_patient_wallet(db, patient_profile.id)
        
        session_price = therapist.session_price
        current_balance = wallet.balance
        
        print(f"💰 Saldo atual: R$ {current_balance}")
        print(f"💰 Preço da sessão: R$ {session_price}")
        
        # ==========================
        # 4. CASO 1: SALDO SUFICIENTE
        # ==========================
        if current_balance >= session_price:
            print("✅ Saldo suficiente - criando appointment direto")
            
            # Criar appointment
            appointment = Appointment(
                patient_user_id=current_user.id,
                therapist_user_id=therapist.user_id,
                starts_at=payload.starts_at,
                ends_at=ends_at,
                status=AppointmentStatus.scheduled,
                session_price=session_price
            )
            db.add(appointment)
            db.flush()
            
            # Registrar evento
            from app.models.appointment_event import AppointmentEvent
            from app.core.appointment_event_type import AppointmentEventType
            
            event = AppointmentEvent(
                appointment_id=appointment.id,
                actor_user_id=current_user.id,
                event_type=AppointmentEventType.created,
                new_status=appointment.status.value
            )
            db.add(event)
            
            db.commit()
            
            # 🔥 Registrar auditoria
            audit = get_audit_service(db, current_user, request)
            audit.log_appointment_created(appointment, "created_with_sufficient_balance")
            
            return BookWithPaymentResponse(
                status="scheduled",
                appointment_id=appointment.id,
                message="Sessão agendada com sucesso"
            )
        
        # ==========================
        # 5. CASO 2: SALDO INSUFICIENTE
        # ==========================
        else:
            missing_amount = session_price - current_balance
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
            
            print(f"⚠️ Saldo insuficiente - necessário complemento de R$ {missing_amount}")
            
            # Criar pending booking
            pending = PendingBooking(
                user_id=current_user.id,
                therapist_id=payload.therapist_id,
                starts_at=payload.starts_at,
                ends_at=ends_at,
                session_price=session_price,
                current_balance=current_balance,
                missing_amount=missing_amount,
                status=PendingBookingStatus.PENDING,
                expires_at=expires_at
            )
            db.add(pending)
            db.commit()
            db.refresh(pending)
            
            # Criar checkout no Stripe
            success_url = f"{request.base_url}patient/wallet?booking_success={pending.id}"
            cancel_url = f"{request.base_url}patient/booking?canceled=true"
            
            checkout = create_stripe_checkout(
                amount=missing_amount,
                pending_booking_id=pending.id,
                success_url=success_url,
                cancel_url=cancel_url
            )
            
            # Atualizar com session_id
            pending.checkout_session_id = checkout["id"]
            db.commit()
            
            # 🔥 Registrar auditoria
            audit = get_audit_service(db, current_user, request)
            audit.log_payment_required(
                pending,
                missing_amount,
                "insufficient_balance_for_booking"
            )
            
            return BookWithPaymentResponse(
                status="payment_required",
                pending_booking_id=pending.id,
                checkout_url=checkout["url"],
                missing_amount=missing_amount,
                current_balance=current_balance,
                session_price=session_price,
                message=f"Saldo insuficiente. Necessário complemento de R$ {missing_amount}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em book_appointment: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# ENDPOINT PARA VERIFICAR STATUS DO PENDING BOOKING
# ==========================

@router.get("/pending/{pending_id}", response_model=PendingBookingOut)
def get_pending_booking(
    pending_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    """
    Retorna o status de um agendamento pendente
    """
    pending = db.get(PendingBooking, pending_id)
    
    if not pending:
        raise HTTPException(status_code=404, detail="Agendamento pendente não encontrado")
    
    if pending.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    return pending