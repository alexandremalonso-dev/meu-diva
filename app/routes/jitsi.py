"""
Rotas para integração com Jitsi Meet
"""
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.appointment import Appointment
from app.models.session_participant import SessionParticipant
from app.services.jitsi_service import jitsi_service

router = APIRouter(prefix="/jitsi", tags=["jitsi"])


# ============================================
# GERAR LINK
# ============================================

@router.post("/generate/{appointment_id}")
async def generate_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin]))
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    if current_user.role != UserRole.admin and appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    if appointment.video_call_url:
        return {
            "meet_url": appointment.video_call_url,
            "room_name": appointment.video_call_url.split("/")[-1].split("?")[0]
        }

    therapist = db.get(User, appointment.therapist_user_id)
    if not therapist:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")

    meet_url = jitsi_service.get_meet_url(
        appointment_id=appointment.id,
        user_id=therapist.id,
        user_name=therapist.full_name or therapist.email.split("@")[0],
        is_moderator=True
    )

    appointment.video_call_url = meet_url
    db.commit()

    room_name = meet_url.split("/")[-1].split("?")[0]

    return {
        "meet_url": meet_url,
        "room_name": room_name
    }


# ============================================
# OBTER LINK
# ============================================

@router.get("/meet-url/{appointment_id}")
async def get_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    is_patient = appointment.patient_user_id == current_user.id
    is_therapist = appointment.therapist_user_id == current_user.id
    is_admin = current_user.role == UserRole.admin

    if not (is_patient or is_therapist or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    if not appointment.video_call_url:
        raise HTTPException(status_code=404, detail="Link ainda não gerado")

    return {"meet_url": appointment.video_call_url}


# ============================================
# REGISTRO DE ENTRADA
# ============================================

@router.post("/session/{appointment_id}/join")
async def register_participant_join(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    appointment = db.get(Appointment, appointment_id)

    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    is_therapist = current_user.id == appointment.therapist_user_id
    is_patient = current_user.id == appointment.patient_user_id
    is_admin = current_user.role == UserRole.admin

    if not (is_therapist or is_patient or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    user_role = "therapist" if is_therapist else "patient"

    participant_log = SessionParticipant(
        appointment_id=appointment_id,
        user_id=current_user.id,
        user_role=user_role,
        joined_at=datetime.now(timezone.utc)
    )

    db.add(participant_log)
    db.commit()

    return {"success": True, "message": "Entrada registrada"}


# ============================================
# REGISTRO DE SAÍDA
# ============================================

@router.post("/session/{appointment_id}/left")
async def register_participant_left(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    appointment = db.get(Appointment, appointment_id)

    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    participant_log = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_id == current_user.id,
        SessionParticipant.left_at.is_(None)
    ).order_by(SessionParticipant.joined_at.desc()).first()

    if not participant_log:
        return {"success": True, "message": "Nenhuma sessão aberta"}

    now = datetime.now(timezone.utc)

    participant_log.left_at = now

    duration = (now - participant_log.joined_at).total_seconds()
    participant_log.duration_seconds = max(0, int(duration))

    db.commit()

    return {
        "success": True,
        "duration_seconds": participant_log.duration_seconds
    }


# ============================================
# DURAÇÃO REAL DA SESSÃO
# ============================================

@router.get("/session/{appointment_id}/duration")
async def get_session_duration(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    appointment = db.get(Appointment, appointment_id)

    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    therapist_logs = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_role == "therapist"
    ).all()

    patient_logs = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_role == "patient"
    ).all()

    now = datetime.now(timezone.utc)

    def calcular_sobreposicao(logs_a, logs_b):
        total = 0

        for a in logs_a:
            for b in logs_b:
                inicio = max(a.joined_at, b.joined_at)

                fim_a = a.left_at or now
                fim_b = b.left_at or now

                fim = min(fim_a, fim_b)

                if fim > inicio:
                    total += (fim - inicio).total_seconds()

        return int(total)

    duracao = calcular_sobreposicao(therapist_logs, patient_logs)

    return {
        "appointment_id": appointment_id,
        "duracao_efetiva_segundos": duracao,
        "duracao_efetiva_minutos": round(duracao / 60, 1)
    }