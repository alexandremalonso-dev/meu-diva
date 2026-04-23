from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Security, Request, Response, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.appointment_status import AppointmentStatus
from app.core.appointment_event_type import AppointmentEventType
from app.models.user import User
from app.models.appointment import Appointment
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.appointment_event import AppointmentEvent
from app.models.medical_record import MedicalRecord
from app.models.patient_profile import PatientProfile
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdateStatus,
    RescheduleRequest,
)
from app.schemas.medical_record import MedicalRecordCreate, MedicalRecordOut

import os
import asyncio

from app.services.email_service import email_service
from app.services.notification_service import NotificationService
from app.services.jitsi_service import jitsi_service
from app.services.receipt_service import receipt_service

# 🔥 WebSocket events
from app.core.events import EventType, create_event
from app.routes.ws_events import emit_event

router = APIRouter(prefix="/appointments", tags=["appointments"])

print("✅ Serviços de e-mail e Jitsi carregados com sucesso")

BR_TZ = timezone(timedelta(hours=-3))

# 🔥 Dicionário para armazenar tarefas de cancelamento agendado
_cancel_tasks = {}


# ==========================
# HELPERS
# ==========================
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _mask_cpf(cpf: str) -> str:
    if not cpf:
        return None
    numbers = ''.join(filter(str.isdigit, cpf))
    if len(numbers) != 11:
        return cpf
    return f"{numbers[:2]}***.***-{numbers[-2:]}"


def _calculate_age(birth_date) -> int:
    if not birth_date:
        return None
    today = datetime.now().date()
    if isinstance(birth_date, datetime):
        birth_date = birth_date.date()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def _send_confirmation_emails_and_meet_and_notifications(appt: Appointment, db: Session):
    try:
        patient = db.get(User, appt.patient_user_id)
        therapist = db.get(User, appt.therapist_user_id)
        if not patient or not therapist:
            return
        meet_url = None
        try:
            if jitsi_service:
                meet_url = jitsi_service.get_meet_url(
                    appointment_id=appt.id,
                    user_id=therapist.id,
                    user_name=therapist.full_name or therapist.email.split('@')[0],
                    is_moderator=True
                )
                if meet_url:
                    appt.video_call_url = meet_url
                    db.commit()
                    print(f"✅ Jitsi Meet gerado: {meet_url}")
            else:
                print("⚠️ jitsi_service não disponível")
        except Exception as e:
            print(f"⚠️ Erro ao gerar Jitsi Meet: {e}")
        
        # Enviar e-mails
        email_service.send_appointment_confirmation(appt, patient.email, therapist.email, meet_url)
        
        # 🔥 Criar notificações no dashboard
        notification_service = NotificationService(db)
        notification_service.notify_appointment_confirmed(appt, patient, therapist, meet_url)
        
    except Exception as e:
        print(f"⚠️ Erro ao processar confirmação da sessão {appt.id}: {e}")


def _build_appointment_dict(apt: Appointment, db: Session) -> dict:
    status_value = apt.status.value if hasattr(apt.status, 'value') else str(apt.status)

    patient_data = None
    if apt.patient_user_id:
        patient = db.get(User, apt.patient_user_id)
        if patient:
            patient_profile = db.execute(
                select(PatientProfile).where(PatientProfile.user_id == patient.id)
            ).scalar_one_or_none()
            patient_data = {
                "id": patient.id,
                "email": patient.email,
                "full_name": (patient_profile.full_name if patient_profile and patient_profile.full_name else patient.full_name),
                "foto_url": patient_profile.foto_url if patient_profile else None,
            }

    therapist_data = None
    if apt.therapist_user_id:
        therapist = db.get(User, apt.therapist_user_id)
        if therapist:
            therapist_profile = db.execute(
                select(TherapistProfile).where(TherapistProfile.user_id == therapist.id)
            ).scalar_one_or_none()
            therapist_data = {
                "id": therapist.id,
                "email": therapist.email,
                "full_name": (therapist_profile.full_name if therapist_profile and therapist_profile.full_name else therapist.full_name),
                "foto_url": therapist_profile.foto_url if therapist_profile else None,
            }

    return {
        "id": apt.id,
        "patient_user_id": apt.patient_user_id,
        "therapist_user_id": apt.therapist_user_id,
        "starts_at": apt.starts_at.isoformat() if apt.starts_at else None,
        "ends_at": apt.ends_at.isoformat() if apt.ends_at else None,
        "status": status_value,
        "session_price": float(apt.session_price) if apt.session_price else None,
        "rescheduled_from_id": apt.rescheduled_from_id,
        "duration_minutes": apt.duration_minutes,
        "created_at": apt.created_at.isoformat() if apt.created_at else None,
        "video_call_url": apt.video_call_url,
        "patient": patient_data,
        "therapist": therapist_data,
    }


# 🔥 Função para cancelar appointment não pago após timeout
async def _cancel_unpaid_appointment_async(appointment_id: int):
    """Cancela appointment não pago após 2 minutos (executado em background)"""
    from app.db.database import SessionLocal
    
    db = SessionLocal()
    try:
        appt = db.get(Appointment, appointment_id)
        if not appt:
            print(f"⚠️ Appointment {appointment_id} não encontrado para cancelamento automático")
            return
        
        # Verifica se ainda está scheduled (não foi confirmado/alterado)
        if appt.status == AppointmentStatus.scheduled:
            appt.status = AppointmentStatus.cancelled_by_patient
            appt.cancelled_at = datetime.now()
            appt.cancel_reason = "Pagamento não confirmado em 2 minutos"
            db.commit()
            
            # 🔥 Emitir evento de cancelamento
            try:
                patient = db.get(User, appt.patient_user_id)
                therapist = db.get(User, appt.therapist_user_id)
                
                if patient:
                    event = create_event(
                        event_type=EventType.APPOINTMENT_CANCELLED,
                        payload={
                            "appointment_id": appt.id,
                            "therapist_id": appt.therapist_user_id,
                            "therapist_name": therapist.full_name if therapist else None,
                            "starts_at": appt.starts_at.isoformat(),
                            "cancelled_by": "paciente",
                            "reason": "Pagamento não confirmado"
                        },
                        target_user_ids=[appt.patient_user_id]
                    )
                    emit_event(event)
                    
                if therapist:
                    event = create_event(
                        event_type=EventType.APPOINTMENT_CANCELLED,
                        payload={
                            "appointment_id": appt.id,
                            "patient_id": appt.patient_user_id,
                            "patient_name": patient.full_name if patient else None,
                            "starts_at": appt.starts_at.isoformat(),
                            "cancelled_by": "paciente",
                            "reason": "Pagamento não confirmado"
                        },
                        target_user_ids=[appt.therapist_user_id]
                    )
                    emit_event(event)
            except Exception as e:
                print(f"⚠️ Erro ao emitir evento de cancelamento automático: {e}")
            
            print(f"✅ Appointment {appointment_id} cancelado automaticamente - pagamento não confirmado")
            
    except Exception as e:
        print(f"❌ Erro ao cancelar appointment {appointment_id} automaticamente: {e}")
    finally:
        db.close()
        # Remove da lista de tarefas
        if appointment_id in _cancel_tasks:
            del _cancel_tasks[appointment_id]


def _schedule_auto_cancel(appointment_id: int, delay_minutes: int = 2):
    """Agenda cancelamento automático após X minutos"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(asyncio.sleep(delay_minutes * 60))
        loop.run_until_complete(_cancel_unpaid_appointment_async(appointment_id))
    except Exception as e:
        print(f"⚠️ Erro no scheduler de cancelamento: {e}")
    finally:
        loop.close()


# ==========================
# ✅ GROQ LLM — GERAR EVOLUÇÃO CLÍNICA
# ==========================
async def _generate_clinical_draft(transcription: str, groq_api_key: str) -> str:
    import httpx

    prompt = f"""Você é um assistente especializado em psicologia clínica.
A partir da transcrição abaixo de uma sessão terapêutica, gere uma evolução clínica profissional e estruturada.

TRANSCRIÇÃO:
{transcription}

Gere a evolução no seguinte formato:

**Demanda:** (o que o paciente trouxe nesta sessão)

**Intervenção:** (técnicas e abordagens utilizadas pelo terapeuta)

**Evolução:** (como o paciente respondeu, insights, progressos ou dificuldades observadas)

**Encaminhamento:** (orientações para próxima sessão ou atividades sugeridas)

Regras importantes:
- Use linguagem clínica e profissional
- Seja objetivo e conciso (máximo 300 palavras)
- Não invente informações que não estejam na transcrição
- Se a transcrição for curta ou imprecisa, trabalhe com o que foi dito
- Finalize com: *📝 Rascunho gerado por IA — revise antes de finalizar.*"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_api_key}", "Content-Type": "application/json"},
                json={"model": "llama3-8b-8192", "messages": [{"role": "user", "content": prompt}], "max_tokens": 800, "temperature": 0.3}
            )
            if response.status_code == 200:
                draft = response.json()["choices"][0]["message"]["content"]
                print(f"✅ Draft clínico gerado pelo LLM ({len(draft)} chars)")
                return draft
            else:
                print(f"⚠️ Groq LLM status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"⚠️ Groq LLM erro: {e}")

    print("⚠️ Usando fallback para draft clínico")
    return f"""**Evolução da sessão:**\n\n{transcription}\n\n---\n*📝 Rascunho gerado por transcrição direta — revise antes de finalizar.*"""


# ==========================
# CREATE
# ==========================
@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(
    payload: AppointmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin])),
):
    # 🔥 VERIFICAÇÃO PARA PLANO EMPRESA
    if current_user.role == UserRole.patient:
        patient_profile = db.query(PatientProfile).filter(
            PatientProfile.user_id == current_user.id
        ).first()
        
        if patient_profile and patient_profile.empresa_id:
            from app.routes import appointments_plano
            return appointments_plano.create_empresa_appointment(payload, request, db, current_user)
    
    # ============================================
    # FLUXO ORIGINAL (PACIENTE COMUM / PRÉ-PAGO)
    # ============================================
    try:
        if current_user.role == UserRole.patient and payload.therapist_user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Você não pode agendar com você mesmo")

        therapist_profile = db.execute(select(TherapistProfile).where(TherapistProfile.user_id == payload.therapist_user_id)).scalar_one_or_none()
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")
        if not therapist_profile.session_price:
            raise HTTPException(status_code=400, detail="Terapeuta ainda não definiu o preço da sessão")

        starts_at = payload.starts_at
        ends_at = payload.ends_at

        from app.models.availability import AvailabilityPeriod, AvailabilitySlot
        starts_at_local = starts_at.astimezone(BR_TZ)
        ends_at_local = ends_at.astimezone(BR_TZ)
        weekday = starts_at_local.weekday()
        start_t = starts_at_local.time()
        end_t = ends_at_local.time()

        active_periods = db.execute(select(AvailabilityPeriod).where(and_(
            AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
            AvailabilityPeriod.start_date <= starts_at_local.date(),
            AvailabilityPeriod.end_date >= starts_at_local.date()
        ))).scalars().all()

        if not active_periods:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

        is_available = False
        for period in active_periods:
            slot = db.execute(select(AvailabilitySlot).where(and_(
                AvailabilitySlot.period_id == period.id,
                AvailabilitySlot.weekday == weekday,
                AvailabilitySlot.start_time <= start_t,
                AvailabilitySlot.end_time >= end_t
            ))).scalars().first()
            if slot:
                is_available = True
                break

        if not is_available:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

        overlap_conflict = db.execute(select(Appointment).where(and_(
            Appointment.therapist_user_id == payload.therapist_user_id,
            Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed, AppointmentStatus.proposed, AppointmentStatus.pending_payment]),
            starts_at < Appointment.ends_at,
            ends_at > Appointment.starts_at,
        ))).scalars().first()
        if overlap_conflict:
            raise HTTPException(status_code=409, detail="Horário já ocupado")

        patient_user_id = current_user.id
        if current_user.role == UserRole.therapist:
            if not payload.patient_user_id:
                raise HTTPException(status_code=400, detail="Terapeuta deve especificar o patient_user_id")
            patient_user_id = payload.patient_user_id

        saldo_insuficiente = False
        wallet_balance = 0

        if current_user.role == UserRole.patient:
            from app.models.wallet import Wallet
            patient_profile = db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id)).scalar_one_or_none()
            if not patient_profile:
                raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")
            wallet = db.execute(select(Wallet).where(Wallet.patient_id == patient_profile.id)).scalar_one_or_none()
            if not wallet:
                raise HTTPException(status_code=404, detail="Carteira do paciente não encontrada")
            wallet_balance = wallet.balance
            if wallet.balance < therapist_profile.session_price:
                saldo_insuficiente = True
                from app.core.audit import get_audit_service
                audit = get_audit_service(db, current_user, request)
                audit.log_insufficient_balance(patient_profile, therapist_profile, therapist_profile.session_price, wallet.balance, {"starts_at": str(starts_at), "therapist_id": payload.therapist_user_id})

        appt = Appointment(
            patient_user_id=patient_user_id,
            therapist_user_id=therapist_profile.user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.scheduled,  # 🔥 NUNCA confirmado sem pagamento
            session_price=therapist_profile.session_price or 0,
            duration_minutes=payload.duration_minutes or 50,
        )
        db.add(appt)
        db.flush()
        db.add(AppointmentEvent(
            appointment_id=appt.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.created,
            old_status=None,
            new_status=appt.status.value
        ))
        db.commit()
        db.refresh(appt)

        # 🔥 SE NÃO TEM SALDO, AGENDAR CANCELAMENTO AUTOMÁTICO APÓS 2 MINUTOS
        if saldo_insuficiente:
            import threading
            thread = threading.Thread(target=_schedule_auto_cancel, args=(appt.id, 2))
            thread.daemon = True
            thread.start()
            print(f"⏰ Cancelamento automático agendado para appointment {appt.id} em 2 minutos")

        # 🔥 Emitir evento de WebSocket para criação de sessão
        try:
            patient = db.get(User, appt.patient_user_id)
            therapist = db.get(User, appt.therapist_user_id)
            
            if therapist:
                event = create_event(
                    event_type=EventType.APPOINTMENT_CREATED,
                    payload={
                        "appointment_id": appt.id,
                        "patient_id": appt.patient_user_id,
                        "patient_name": patient.full_name if patient else None,
                        "starts_at": appt.starts_at.isoformat(),
                        "status": appt.status.value
                    },
                    target_user_ids=[appt.therapist_user_id]
                )
                emit_event(event)
                print(f"🔔 Evento emitido: APPOINTMENT_CREATED para terapeuta {appt.therapist_user_id}")
                
            if patient and current_user.role == UserRole.therapist:
                event = create_event(
                    event_type=EventType.APPOINTMENT_CREATED,
                    payload={
                        "appointment_id": appt.id,
                        "therapist_id": appt.therapist_user_id,
                        "therapist_name": therapist.full_name if therapist else None,
                        "starts_at": appt.starts_at.isoformat(),
                        "status": appt.status.value
                    },
                    target_user_ids=[appt.patient_user_id]
                )
                emit_event(event)
                print(f"🔔 Evento emitido: APPOINTMENT_CREATED para paciente {appt.patient_user_id}")
                
        except Exception as e:
            print(f"⚠️ Erro ao emitir evento WebSocket: {e}")

        return {
            "id": appt.id, "patient_user_id": appt.patient_user_id, "therapist_user_id": appt.therapist_user_id,
            "starts_at": appt.starts_at, "ends_at": appt.ends_at, "status": appt.status.value,
            "session_price": appt.session_price, "duration_minutes": appt.duration_minutes,
            "needs_payment": saldo_insuficiente, "insufficient_balance": saldo_insuficiente,
            "required_amount": therapist_profile.session_price if saldo_insuficiente else 0,
            "current_balance": wallet_balance
        }

    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao criar agendamento")
    except Exception as e:
        db.rollback()
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# RESCHEDULE
# ==========================
@router.post("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    payload: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin, UserRole.patient])),
):
    try:
        original = db.get(Appointment, appointment_id)
        if not original:
            raise HTTPException(status_code=404, detail="Appointment não encontrado")

        is_patient = original.patient_user_id == current_user.id
        is_therapist = original.therapist_user_id == current_user.id
        is_admin = current_user.role == UserRole.admin

        if not (is_patient or is_therapist or is_admin):
            raise HTTPException(status_code=403, detail="Acesso negado para reagendar")

        if is_patient and not is_admin:
            if original.rescheduled_from_id:
                raise HTTPException(status_code=400, detail="Esta sessão já foi reagendada anteriormente.")
            already = db.execute(select(Appointment).where(Appointment.rescheduled_from_id == original.id)).scalars().first()
            if already:
                raise HTTPException(status_code=400, detail="Esta sessão já foi reagendada anteriormente.")

        if original.status in (
            AppointmentStatus.completed, AppointmentStatus.cancelled_by_patient,
            AppointmentStatus.cancelled_by_therapist, AppointmentStatus.cancelled_by_admin,
            AppointmentStatus.rescheduled, AppointmentStatus.no_show
        ):
            raise HTTPException(status_code=400, detail="Appointment já finalizado")

        starts_at = payload.starts_at
        ends_at = payload.ends_at

        therapist_profile = db.execute(select(TherapistProfile).where(TherapistProfile.user_id == original.therapist_user_id)).scalar_one_or_none()
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")

        from app.models.availability import AvailabilityPeriod, AvailabilitySlot
        starts_at_local = starts_at.astimezone(BR_TZ)
        ends_at_local = ends_at.astimezone(BR_TZ)
        weekday = starts_at_local.weekday()
        start_t = starts_at_local.time()
        end_t = ends_at_local.time()

        active_periods = db.execute(select(AvailabilityPeriod).where(and_(
            AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
            AvailabilityPeriod.start_date <= starts_at_local.date(),
            AvailabilityPeriod.end_date >= starts_at_local.date()
        ))).scalars().all()
        if not active_periods:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

        is_available = False
        for period in active_periods:
            slot = db.execute(select(AvailabilitySlot).where(and_(
                AvailabilitySlot.period_id == period.id,
                AvailabilitySlot.weekday == weekday,
                AvailabilitySlot.start_time <= start_t,
                AvailabilitySlot.end_time >= end_t
            ))).scalars().first()
            if slot:
                is_available = True
                break
        if not is_available:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

        conflict = db.execute(select(Appointment).where(and_(
            Appointment.therapist_user_id == original.therapist_user_id,
            Appointment.id != original.id,
            Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed, AppointmentStatus.proposed, AppointmentStatus.pending_payment]),
            starts_at < Appointment.ends_at,
            ends_at > Appointment.starts_at
        ))).scalars().first()
        if conflict:
            raise HTTPException(status_code=409, detail="Horário já ocupado")

        new_appt = Appointment(
            patient_user_id=original.patient_user_id,
            therapist_user_id=therapist_profile.user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.scheduled,  # 🔥 NUNCA confirmado sem pagamento
            rescheduled_from_id=original.id,
            session_price=original.session_price,
            duration_minutes=payload.duration_minutes or original.duration_minutes or 50
        )
        old_status = original.status
        original.status = AppointmentStatus.rescheduled
        db.add(new_appt)
        db.flush()
        db.add(AppointmentEvent(
            appointment_id=original.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.rescheduled,
            old_status=old_status.value,
            new_status=AppointmentStatus.rescheduled.value,
            event_metadata={"new_appointment_id": new_appt.id}
        ))
        db.commit()
        db.refresh(new_appt)
        
        # 🔥 Agendar cancelamento automático para o novo appointment se não pago
        if current_user.role == UserRole.patient:
            # Verificar saldo do paciente
            patient_profile = db.execute(select(PatientProfile).where(PatientProfile.user_id == current_user.id)).scalar_one_or_none()
            if patient_profile:
                from app.models.wallet import Wallet
                wallet = db.execute(select(Wallet).where(Wallet.patient_id == patient_profile.id)).scalar_one_or_none()
                if not wallet or wallet.balance < new_appt.session_price:
                    import threading
                    thread = threading.Thread(target=_schedule_auto_cancel, args=(new_appt.id, 2))
                    thread.daemon = True
                    thread.start()
                    print(f"⏰ Cancelamento automático agendado para reagendamento {new_appt.id} em 2 minutos")
        
        # 🔥 Notificação de reagendamento
        try:
            patient = db.get(User, new_appt.patient_user_id)
            therapist = db.get(User, new_appt.therapist_user_id)
            if patient and therapist:
                notification_service = NotificationService(db)
                meet_url = new_appt.video_call_url
                notification_service.notify_appointment_rescheduled(new_appt, patient, therapist, meet_url)
                print(f"🔔 Notificação de reagendamento enviada")
        except Exception as e:
            print(f"⚠️ Erro ao enviar notificação de reagendamento: {e}")
        
        # 🔥 Emitir evento de WebSocket para reagendamento
        try:
            patient = db.get(User, new_appt.patient_user_id)
            therapist = db.get(User, new_appt.therapist_user_id)
            
            if patient:
                event = create_event(
                    event_type=EventType.APPOINTMENT_RESCHEDULED,
                    payload={
                        "appointment_id": new_appt.id,
                        "original_id": original.id,
                        "therapist_id": new_appt.therapist_user_id,
                        "therapist_name": therapist.full_name if therapist else None,
                        "new_starts_at": new_appt.starts_at.isoformat(),
                        "old_starts_at": original.starts_at.isoformat()
                    },
                    target_user_ids=[new_appt.patient_user_id]
                )
                emit_event(event)
                print(f"🔔 Evento emitido: APPOINTMENT_RESCHEDULED para paciente {new_appt.patient_user_id}")
                
            if therapist:
                event = create_event(
                    event_type=EventType.APPOINTMENT_RESCHEDULED,
                    payload={
                        "appointment_id": new_appt.id,
                        "original_id": original.id,
                        "patient_id": new_appt.patient_user_id,
                        "patient_name": patient.full_name if patient else None,
                        "new_starts_at": new_appt.starts_at.isoformat(),
                        "old_starts_at": original.starts_at.isoformat()
                    },
                    target_user_ids=[new_appt.therapist_user_id]
                )
                emit_event(event)
                print(f"🔔 Evento emitido: APPOINTMENT_RESCHEDULED para terapeuta {new_appt.therapist_user_id}")
                
        except Exception as e:
            print(f"⚠️ Erro ao emitir evento WebSocket: {e}")
        
        return new_appt

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao reagendar")


# ==========================
# LIST MY APPOINTMENTS WITH DETAILS
# ==========================
@router.get("/me/details")
def list_my_appointments_with_details(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin])),
):
    try:
        print(f"\n📋 Listando appointments para usuário: {current_user.id}, role: {current_user.role}")
        query = select(Appointment).where(
            or_(Appointment.patient_user_id == current_user.id, Appointment.therapist_user_id == current_user.id)
        ).order_by(Appointment.starts_at.desc())
        rows = db.execute(query).scalars().all()
        result = [_build_appointment_dict(apt, db) for apt in rows]
        print(f"✅ Retornando {len(result)} appointments")
        return result
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar sessões: {str(e)}")


# ==========================
# ADMIN: LISTAR TODOS OS APPOINTMENTS
# ==========================
@router.get("/admin/all")
def admin_list_all_appointments(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    try:
        print(f"\n📋 [ADMIN] Listando TODOS os appointments do sistema")
        rows = db.execute(select(Appointment).order_by(Appointment.starts_at.desc())).scalars().all()
        result = [_build_appointment_dict(apt, db) for apt in rows]
        print(f"✅ [ADMIN] Retornando {len(result)} appointments")
        return result
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar sessões: {str(e)}")


# ==========================
# COMPLETE APPOINTMENT (MEDICAL RECORD)
# ==========================
@router.post("/{appointment_id}/complete", response_model=MedicalRecordOut)
def complete_appointment(
    appointment_id: int,
    record_data: MedicalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o terapeuta da sessão pode finalizar")
    if appointment.status != AppointmentStatus.confirmed:
        raise HTTPException(status_code=400, detail="Apenas sessões confirmadas podem ser completadas")
    existing = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == appointment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prontuário já registrado. Não é possível alterar.")

    if record_data.session_not_occurred:
        if not record_data.not_occurred_reason:
            raise HTTPException(status_code=400, detail="Motivo da não ocorrência é obrigatório")
    else:
        if not record_data.evolution:
            raise HTTPException(status_code=400, detail="Evolução do atendimento é obrigatória")
        if not record_data.outcome:
            raise HTTPException(status_code=400, detail="Desfecho clínico é obrigatório")

    medical_record = MedicalRecord(
        appointment_id=appointment_id,
        session_not_occurred=record_data.session_not_occurred,
        not_occurred_reason=record_data.not_occurred_reason,
        evolution=record_data.evolution if not record_data.session_not_occurred else None,
        outcome=record_data.outcome if not record_data.session_not_occurred else None,
        patient_reasons=record_data.patient_reasons,
        private_notes=record_data.private_notes,
        activity_instructions=record_data.activity_instructions if not record_data.session_not_occurred else None,
        links=record_data.links if not record_data.session_not_occurred else None
    )
    db.add(medical_record)
    appointment.status = AppointmentStatus.completed
    db.commit()
    db.refresh(medical_record)
    
    # 🔥 Atualizar total_sessions do terapeuta (sessão realizada com sucesso)
    if not record_data.session_not_occurred:
        therapist_profile = db.query(TherapistProfile).filter(
            TherapistProfile.user_id == appointment.therapist_user_id
        ).first()
        if therapist_profile:
            therapist_profile.total_sessions = (therapist_profile.total_sessions or 0) + 1
            db.add(therapist_profile)
            db.commit()
            print(f"✅ total_sessions do terapeuta {therapist_profile.user_id} atualizado para {therapist_profile.total_sessions}")
    
    # 🔥 Emitir evento de WebSocket para atualizar prontuários pendentes
    try:
        therapist = db.get(User, appointment.therapist_user_id)
        patient = db.get(User, appointment.patient_user_id)
        
        if therapist:
            event = create_event(
                event_type=EventType.MEDICAL_RECORD_CREATED,
                payload={
                    "appointment_id": appointment.id,
                    "therapist_id": appointment.therapist_user_id,
                    "patient_id": appointment.patient_user_id,
                    "status": "completed"
                },
                target_user_ids=[appointment.therapist_user_id]
            )
            emit_event(event)
            print(f"🔔 Evento emitido: MEDICAL_RECORD_CREATED para terapeuta {appointment.therapist_user_id}")
            
        if patient:
            event = create_event(
                event_type=EventType.APPOINTMENT_COMPLETED,
                payload={
                    "appointment_id": appointment.id,
                    "therapist_id": appointment.therapist_user_id,
                    "patient_id": appointment.patient_user_id
                },
                target_user_ids=[appointment.patient_user_id]
            )
            emit_event(event)
            print(f"🔔 Evento emitido: APPOINTMENT_COMPLETED para paciente {appointment.patient_user_id}")
            
    except Exception as e:
        print(f"⚠️ Erro ao emitir evento WebSocket: {e}")
    
    return medical_record


# ==========================
# GET MEDICAL RECORD
# ==========================
@router.get("/{appointment_id}/medical-record", response_model=MedicalRecordOut)
def get_medical_record(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    if current_user.role == UserRole.admin:
        pass
    elif current_user.role == UserRole.patient:
        if appointment.patient_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    elif current_user.role == UserRole.therapist:
        if appointment.therapist_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Acesso negado")

    medical_record = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == appointment_id).first()
    
    if not medical_record:
        return MedicalRecordOut(
            id=0,
            appointment_id=appointment_id,
            session_not_occurred=False,
            not_occurred_reason=None,
            evolution=None,
            outcome=None,
            patient_reasons=[],
            private_notes=None,
            activity_instructions=None,
            links=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
    
    if current_user.role == UserRole.patient:
        medical_record.private_notes = None
        
    return medical_record


# ==========================
# RECIBO — DOWNLOAD
# ==========================
@router.get("/{appointment_id}/receipt")
def download_receipt(
    appointment_id: int,
    format: str = "pdf",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if current_user.role != UserRole.admin and current_user.id not in [appointment.patient_user_id, appointment.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Recibo disponível apenas para sessões realizadas")

    therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == appointment.therapist_user_id).first()
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == appointment.patient_user_id).first()
    patient_user = db.get(User, appointment.patient_user_id)

    if not therapist_profile or not patient_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    html_content = receipt_service.generate_receipt_html(appointment, therapist_profile, patient_profile, patient_user)
    if format == "html":
        return Response(content=html_content, media_type="text/html")
    pdf_bytes = receipt_service.generate_receipt_pdf(html_content)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=recibo_sessao_{appointment_id}.pdf"}
    )


# ==========================
# RECIBO — ENVIAR POR EMAIL
# ==========================
@router.post("/{appointment_id}/send-receipt")
def send_receipt_by_email(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist]))
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if current_user.id not in [appointment.patient_user_id, appointment.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Recibo disponível apenas para sessões realizadas")

    therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == appointment.therapist_user_id).first()
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == appointment.patient_user_id).first()
    patient_user = db.get(User, appointment.patient_user_id)
    if not therapist_profile or not patient_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    html_content = receipt_service.generate_receipt_html(appointment, therapist_profile, patient_profile, patient_user)
    email_service.send_receipt_email(
        to_email=patient_user.email,
        patient_name=patient_profile.full_name or patient_user.full_name,
        therapist_name=therapist_profile.full_name or therapist_profile.user.full_name,
        session_date=appointment.starts_at.strftime("%d/%m/%Y"),
        session_id=str(appointment.id),
        receipt_html=html_content
    )
    
    try:
        notification_service = NotificationService(db)
        notification_service.notify_receipt_available(
            patient_user, appointment, therapist_profile.full_name or therapist_profile.user.full_name, float(appointment.session_price)
        )
        print(f"🔔 Notificação de recibo disponível enviada para paciente {patient_user.id}")
    except Exception as e:
        print(f"⚠️ Erro ao enviar notificação de recibo: {e}")
    
    return {"message": "Recibo enviado por e-mail com sucesso"}


# ==========================
# GERAR MEET (JITSI)
# ==========================
@router.post("/{appointment_id}/generate-meet")
def generate_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin]))
):
    """
    Gera link do Jitsi Meet para uma sessão
    """
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    if appointment.therapist_user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    if appointment.video_call_url:
        return {"success": True, "message": "Sessão já possui link da videochamada", "video_call_url": appointment.video_call_url}
    
    if not jitsi_service:
        raise HTTPException(status_code=503, detail="Jitsi Service não disponível")
    
    try:
        therapist = db.get(User, appointment.therapist_user_id)
        if not therapist:
            raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
        
        meet_url = jitsi_service.get_meet_url(
            appointment_id=appointment.id,
            user_id=therapist.id,
            user_name=therapist.full_name or therapist.email.split('@')[0],
            is_moderator=True
        )
        
        if meet_url:
            appointment.video_call_url = meet_url
            db.commit()
            return {"success": True, "message": "Link da videochamada gerado com sucesso", "video_call_url": meet_url}
        
        raise HTTPException(status_code=500, detail="Falha ao gerar link da videochamada")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao gerar link: {str(e)}")


# ==========================
# UPDATE STATUS
# ==========================
@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentUpdateStatus,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin])),
):
    from app.models.wallet import Wallet, Ledger
    from app.core.audit import get_audit_service

    try:
        appt = db.get(Appointment, appointment_id)
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment não encontrado")

        is_patient = appt.patient_user_id == current_user.id
        is_therapist = appt.therapist_user_id == current_user.id
        is_admin = current_user.role == UserRole.admin

        if not (is_patient or is_therapist or is_admin):
            raise HTTPException(status_code=403, detail="Acesso negado")

        if appt.status in (
            AppointmentStatus.completed, AppointmentStatus.cancelled_by_patient,
            AppointmentStatus.cancelled_by_therapist, AppointmentStatus.cancelled_by_admin,
            AppointmentStatus.rescheduled, AppointmentStatus.no_show
        ):
            raise HTTPException(status_code=400, detail="Appointment já finalizado")

        new_status = payload.status
        if isinstance(new_status, str):
            try:
                new_status = AppointmentStatus(new_status)
            except ValueError:
                raise HTTPException(status_code=400, detail="Status inválido")

        old_status = appt.status

        if is_patient and not is_admin:
            if new_status == AppointmentStatus.declined:
                if appt.status != AppointmentStatus.proposed:
                    raise HTTPException(status_code=400, detail="Apenas convites pendentes podem ser recusados")
            elif new_status == AppointmentStatus.cancelled_by_patient:
                if appt.status != AppointmentStatus.proposed:
                    if (_to_utc(appt.starts_at) - _utcnow()).total_seconds() < 24 * 3600:
                        raise HTTPException(status_code=400, detail="Cancelamento permitido somente com 24h de antecedência")
            elif new_status == AppointmentStatus.confirmed:
                if appt.status not in (AppointmentStatus.scheduled, AppointmentStatus.proposed):
                    raise HTTPException(status_code=400, detail="Só é possível confirmar sessões agendadas ou convites pendentes")
            else:
                raise HTTPException(status_code=403, detail="Ação não permitida para paciente")
        elif is_therapist and not is_admin:
            if new_status not in (
                AppointmentStatus.cancelled_by_therapist, AppointmentStatus.confirmed,
                AppointmentStatus.completed, AppointmentStatus.no_show, AppointmentStatus.proposed
            ):
                raise HTTPException(status_code=403, detail="Ação não permitida para terapeuta")

        if new_status == AppointmentStatus.confirmed:
            if appt.status not in (AppointmentStatus.scheduled, AppointmentStatus.proposed):
                raise HTTPException(status_code=400, detail="Só é possível confirmar quando está scheduled ou proposed")
            
            # 🔥 VERIFICAR SE O PAGAMENTO FOI REALIZADO (via Stripe ou Wallet)
            # Verificar se já foi debitado
            already_debited = db.execute(select(Ledger).where(
                Ledger.appointment_id == appt.id,
                Ledger.transaction_type == "session_debit"
            )).scalars().first()
            
            # Se não foi debitado, verificar pagamento via Stripe
            if not already_debited:
                from app.models.payment import Payment
                payment = db.execute(select(Payment).where(
                    Payment.appointment_id == appt.id,
                    Payment.status.in_(["paid"])
                )).scalars().first()
                
                if not payment:
                    raise HTTPException(status_code=402, detail="Pagamento não confirmado. Realize o pagamento primeiro.")

        if new_status == AppointmentStatus.completed:
            if _utcnow() < _to_utc(appt.starts_at):
                raise HTTPException(status_code=400, detail="Não é possível completar antes do início")

        # DÉBITO
        if new_status == AppointmentStatus.confirmed:
            patient_profile = db.execute(select(PatientProfile).where(PatientProfile.user_id == appt.patient_user_id)).scalar_one_or_none()
            if not patient_profile:
                raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")
            wallet = db.execute(select(Wallet).where(Wallet.patient_id == patient_profile.id)).scalar_one_or_none()
            if not wallet:
                raise HTTPException(status_code=404, detail="Carteira do paciente não encontrada")
            already_debited = db.execute(select(Ledger).where(
                Ledger.appointment_id == appt.id,
                Ledger.transaction_type == "session_debit"
            )).scalars().first()
            if not already_debited:
                if wallet.balance < appt.session_price:
                    raise HTTPException(status_code=402, detail=f"Saldo insuficiente. Necessário: R$ {appt.session_price}")
                old_balance = wallet.balance
                wallet.balance -= appt.session_price
                db.add(Ledger(
                    wallet_id=wallet.id, appointment_id=appt.id,
                    transaction_type="session_debit", amount=appt.session_price,
                    balance_after=wallet.balance,
                    description=f"Sessão com terapeuta ID {appt.therapist_user_id}"
                ))
                get_audit_service(db, current_user, request).log_session_debit(appt, wallet, old_balance, wallet.balance, appt.session_price)

        # ESTORNO
        is_patient_cancel = is_patient and new_status == AppointmentStatus.cancelled_by_patient
        is_therapist_cancel = is_therapist and new_status == AppointmentStatus.cancelled_by_therapist

        if (is_patient_cancel or is_therapist_cancel) and old_status in [AppointmentStatus.confirmed, AppointmentStatus.scheduled]:
            do_refund = True
            if is_patient_cancel and (_to_utc(appt.starts_at) - _utcnow()).total_seconds() < 24 * 3600:
                do_refund = False
            if do_refund:
                debit_tx = db.execute(select(Ledger).where(
                    Ledger.appointment_id == appt.id,
                    Ledger.transaction_type == "session_debit"
                )).scalar_one_or_none()
                if debit_tx:
                    w = db.get(Wallet, debit_tx.wallet_id)
                    if w:
                        old_bal = w.balance
                        w.balance += debit_tx.amount
                        db.add(Ledger(
                            wallet_id=w.id, appointment_id=appt.id,
                            transaction_type="cancellation_refund", amount=debit_tx.amount,
                            balance_after=w.balance,
                            description=f"Estorno - Sessão {appt.id}"
                        ))
                        reason = "Cancelamento com 24h+" if is_patient_cancel else "Cancelamento por terapeuta"
                        get_audit_service(db, current_user, request).log_session_refund(appt, w, old_bal, w.balance, debit_tx.amount, reason)

        appt.status = new_status
        db.add(AppointmentEvent(
            appointment_id=appt.id, actor_user_id=current_user.id,
            event_type=AppointmentEventType.status_changed,
            old_status=old_status.value if old_status else None,
            new_status=new_status.value
        ))
        db.commit()
        db.refresh(appt)

        # ✅ JITSI + EMAIL + NOTIFICAÇÕES após confirmação
        if new_status == AppointmentStatus.confirmed:
            if not appt.video_call_url:
                try:
                    if jitsi_service:
                        therapist = db.get(User, appt.therapist_user_id)
                        if therapist:
                            meet_url = jitsi_service.get_meet_url(
                                appointment_id=appt.id,
                                user_id=therapist.id,
                                user_name=therapist.full_name or therapist.email.split('@')[0],
                                is_moderator=True
                            )
                            if meet_url:
                                appt.video_call_url = meet_url
                                db.commit()
                                print(f"✅ Jitsi Meet gerado: {meet_url}")
                            else:
                                print("⚠️ get_meet_url retornou None")
                        else:
                            print(f"⚠️ Terapeuta não encontrado para a sessão {appt.id}")
                    else:
                        print("⚠️ jitsi_service não disponível")
                except Exception as e:
                    print(f"⚠️ Erro ao gerar Jitsi Meet: {e}")
                    import traceback; traceback.print_exc()
            
            try:
                patient = db.get(User, appt.patient_user_id)
                therapist = db.get(User, appt.therapist_user_id)
                if patient and therapist:
                    email_service.send_appointment_confirmation(appt, patient.email, therapist.email, appt.video_call_url)
                    notification_service = NotificationService(db)
                    notification_service.notify_appointment_confirmed(appt, patient, therapist, appt.video_call_url)
            except Exception as e:
                print(f"⚠️ Erro ao enviar e-mails/notificações: {e}")
            
            # 🔥 Emitir evento de confirmação de sessão
            try:
                patient = db.get(User, appt.patient_user_id)
                therapist = db.get(User, appt.therapist_user_id)
                
                if patient:
                    event = create_event(
                        event_type=EventType.APPOINTMENT_CONFIRMED,
                        payload={
                            "appointment_id": appt.id,
                            "therapist_id": appt.therapist_user_id,
                            "therapist_name": therapist.full_name if therapist else None,
                            "starts_at": appt.starts_at.isoformat(),
                            "meet_url": appt.video_call_url
                        },
                        target_user_ids=[appt.patient_user_id]
                    )
                    emit_event(event)
                    print(f"🔔 Evento emitido: APPOINTMENT_CONFIRMED para paciente {appt.patient_user_id}")
                    
                if therapist:
                    event = create_event(
                        event_type=EventType.APPOINTMENT_CONFIRMED,
                        payload={
                            "appointment_id": appt.id,
                            "patient_id": appt.patient_user_id,
                            "patient_name": patient.full_name if patient else None,
                            "starts_at": appt.starts_at.isoformat()
                        },
                        target_user_ids=[appt.therapist_user_id]
                    )
                    emit_event(event)
                    print(f"🔔 Evento emitido: APPOINTMENT_CONFIRMED para terapeuta {appt.therapist_user_id}")
                    
            except Exception as e:
                print(f"⚠️ Erro ao emitir evento WebSocket: {e}")
        
        # 🔥 Notificação de cancelamento
        if new_status in (AppointmentStatus.cancelled_by_patient, AppointmentStatus.cancelled_by_therapist):
            try:
                patient = db.get(User, appt.patient_user_id)
                therapist = db.get(User, appt.therapist_user_id)
                if patient and therapist:
                    notification_service = NotificationService(db)
                    cancelled_by = "paciente" if new_status == AppointmentStatus.cancelled_by_patient else "terapeuta"
                    notification_service.notify_appointment_cancelled(appt, patient, therapist, cancelled_by)
            except Exception as e:
                print(f"⚠️ Erro ao enviar notificação de cancelamento: {e}")
            
            # 🔥 Emitir evento de cancelamento de sessão
            try:
                patient = db.get(User, appt.patient_user_id)
                therapist = db.get(User, appt.therapist_user_id)
                
                if patient:
                    event = create_event(
                        event_type=EventType.APPOINTMENT_CANCELLED,
                        payload={
                            "appointment_id": appt.id,
                            "therapist_id": appt.therapist_user_id,
                            "therapist_name": therapist.full_name if therapist else None,
                            "starts_at": appt.starts_at.isoformat(),
                            "cancelled_by": "paciente" if new_status == AppointmentStatus.cancelled_by_patient else "terapeuta"
                        },
                        target_user_ids=[appt.patient_user_id]
                    )
                    emit_event(event)
                    print(f"🔔 Evento emitido: APPOINTMENT_CANCELLED para paciente {appt.patient_user_id}")
                    
                if therapist:
                    event = create_event(
                        event_type=EventType.APPOINTMENT_CANCELLED,
                        payload={
                            "appointment_id": appt.id,
                            "patient_id": appt.patient_user_id,
                            "patient_name": patient.full_name if patient else None,
                            "starts_at": appt.starts_at.isoformat(),
                            "cancelled_by": "paciente" if new_status == AppointmentStatus.cancelled_by_patient else "terapeuta"
                        },
                        target_user_ids=[appt.therapist_user_id]
                    )
                    emit_event(event)
                    print(f"🔔 Evento emitido: APPOINTMENT_CANCELLED para terapeuta {appt.therapist_user_id}")
                    
            except Exception as e:
                print(f"⚠️ Erro ao emitir evento WebSocket: {e}")

        # 🔥 Notificação de prontuário pendente (quando sessão é completada)
        if new_status == AppointmentStatus.completed:
            try:
                patient = db.get(User, appt.patient_user_id)
                therapist = db.get(User, appt.therapist_user_id)
                if patient and therapist:
                    notification_service = NotificationService(db)
                    notification_service.notify_pending_medical_record(appt, therapist, patient)
                    print(f"🔔 Notificação de prontuário pendente enviada para terapeuta {therapist.id}")
            except Exception as e:
                print(f"⚠️ Erro ao enviar notificação de prontuário pendente: {e}")

        # ✅ Google Calendar sync
        try:
            from app.routes.google_calendar import sync_appointment_to_calendar
            import asyncio
            if new_status == AppointmentStatus.confirmed:
                asyncio.create_task(sync_appointment_to_calendar(appt, "upsert", db))
            elif new_status in (
                AppointmentStatus.cancelled_by_patient,
                AppointmentStatus.cancelled_by_therapist,
                AppointmentStatus.cancelled_by_admin,
            ):
                asyncio.create_task(sync_appointment_to_calendar(appt, "cancel", db))
            elif new_status == AppointmentStatus.rescheduled:
                asyncio.create_task(sync_appointment_to_calendar(appt, "upsert", db))
        except Exception as _gcal_err:
            print(f"⚠️ GCal task ignorada: {_gcal_err}")

        return appt

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# 🎙️ TRANSCREVER ÁUDIO COM GROQ WHISPER
# ==========================
@router.post("/{appointment_id}/transcribe")
async def transcribe_audio(
    appointment_id: int,
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist])),
):
    import httpx

    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o terapeuta da sessão pode transcrever")

    try:
        audio_bytes = await audio_file.read()
        if len(audio_bytes) < 500:
            return {"success": True, "transcription": "", "message": "Chunk ignorado (silêncio)"}
        if len(audio_bytes) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Áudio muito grande. Máximo 25MB por chunk")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler áudio: {str(e)}")

    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY não configurada")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={
                    "file": (audio_file.filename or "chunk.webm", audio_bytes, "audio/webm"),
                    "model": (None, "whisper-large-v3"),
                    "response_format": (None, "json"),
                    "language": (None, "pt"),
                }
            )
            if response.status_code != 200:
                print(f"❌ Groq Whisper erro {response.status_code}: {response.text[:300]}")
                raise HTTPException(status_code=502, detail="Erro na transcrição — tente novamente")
            transcription = response.json().get("text", "").strip()
            print(f"✅ Chunk transcrito: {len(transcription)} chars")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout na transcrição")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro na IA: {str(e)}")

    return {"success": True, "transcription": transcription, "message": "Chunk transcrito com sucesso"}


# ==========================
# 🤖 GERAR RASCUNHO CLÍNICO COM LLM
# ==========================
@router.post("/{appointment_id}/generate-draft")
async def generate_clinical_draft(
    appointment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist])),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    body = await request.json()
    transcription = body.get("transcription", "").strip()
    if not transcription:
        raise HTTPException(status_code=400, detail="Transcrição vazia")

    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY não configurada")

    draft = await _generate_clinical_draft(transcription, GROQ_API_KEY)
    return {"success": True, "draft": draft, "message": "Rascunho clínico gerado com sucesso"}