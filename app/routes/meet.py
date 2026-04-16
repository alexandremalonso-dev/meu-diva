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


@router.post("/generate/{appointment_id}")
async def generate_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin]))
):
    """
    Gera link do Jitsi Meet para uma sessão
    Apenas terapeutas e admin podem gerar links
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    if current_user.role != UserRole.admin and appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    if appointment.video_call_url:
        return {"meet_url": appointment.video_call_url, "room_name": appointment.video_call_url.split('/')[-1].split('#')[0]}
    
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
        
        # Extrair room_name da URL
        room_name = meet_url.split('/')[-1].split('#')[0]
        
        return {"meet_url": meet_url, "room_name": room_name}
    else:
        raise HTTPException(status_code=500, detail="Erro ao gerar link do Meet")


@router.get("/meet-url/{appointment_id}")
async def get_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    """
    Obtém o link do Jitsi Meet de uma sessão
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    is_patient = appointment.patient_user_id == current_user.id
    is_therapist = appointment.therapist_user_id == current_user.id
    is_admin = current_user.role == UserRole.admin
    
    if not (is_patient or is_therapist or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    if not appointment.video_call_url:
        raise HTTPException(status_code=404, detail="Link da videochamada ainda não gerado")
    
    return {"meet_url": appointment.video_call_url}


# ============================================
# ENDPOINTS PARA REGISTRAR ENTRADA/SAÍDA
# ============================================

@router.post("/session/{appointment_id}/join")
async def register_participant_join(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    """Registra quando o usuário entra na sala do Meet"""
    
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    is_therapist = current_user.id == appointment.therapist_user_id
    is_patient = current_user.id == appointment.patient_user_id
    is_admin = current_user.role == UserRole.admin
    
    if not (is_therapist or is_patient or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    user_role = "therapist" if is_therapist else "patient"
    
    # Verificar se já existe um registro sem left_at
    existing = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_id == current_user.id,
        SessionParticipant.left_at.is_(None)
    ).first()
    
    if existing:
        existing.joined_at = datetime.now(timezone.utc)
    else:
        participant_log = SessionParticipant(
            appointment_id=appointment_id,
            user_id=current_user.id,
            user_role=user_role,
            joined_at=datetime.now(timezone.utc)
        )
        db.add(participant_log)
    
    db.commit()
    
    return {"success": True, "message": "Entrada registrada"}


@router.post("/session/{appointment_id}/left")
async def register_participant_left(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    """Registra quando o usuário sai da sala do Meet"""
    
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    is_therapist = current_user.id == appointment.therapist_user_id
    is_patient = current_user.id == appointment.patient_user_id
    is_admin = current_user.role == UserRole.admin
    
    if not (is_therapist or is_patient or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    user_role = "therapist" if is_therapist else "patient"
    
    participant_log = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_id == current_user.id,
        SessionParticipant.left_at.is_(None)
    ).first()
    
    if not participant_log:
        participant_log = SessionParticipant(
            appointment_id=appointment_id,
            user_id=current_user.id,
            user_role=user_role,
            joined_at=datetime.now(timezone.utc),
            left_at=datetime.now(timezone.utc),
            duration_seconds=0
        )
        db.add(participant_log)
    else:
        participant_log.left_at = datetime.now(timezone.utc)
        duration = (participant_log.left_at - participant_log.joined_at).total_seconds()
        participant_log.duration_seconds = int(duration)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Saída registrada",
        "duration_seconds": participant_log.duration_seconds
    }


@router.get("/session/{appointment_id}/duration")
async def get_session_duration(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    """Retorna a duração efetiva da sessão (sobreposição)"""
    
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    is_therapist = current_user.id == appointment.therapist_user_id
    is_patient = current_user.id == appointment.patient_user_id
    is_admin = current_user.role == UserRole.admin
    
    if not (is_therapist or is_patient or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Buscar logs do terapeuta e paciente
    therapist_log = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_role == "therapist"
    ).order_by(SessionParticipant.joined_at.desc()).first()
    
    patient_log = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id == appointment_id,
        SessionParticipant.user_role == "patient"
    ).order_by(SessionParticipant.joined_at.desc()).first()
    
    resultado = {
        "appointment_id": appointment_id,
        "therapist": {
            "joined_at": therapist_log.joined_at.isoformat() if therapist_log else None,
            "left_at": therapist_log.left_at.isoformat() if therapist_log and therapist_log.left_at else None,
            "duration_seconds": therapist_log.duration_seconds if therapist_log else 0
        } if therapist_log else None,
        "patient": {
            "joined_at": patient_log.joined_at.isoformat() if patient_log else None,
            "left_at": patient_log.left_at.isoformat() if patient_log and patient_log.left_at else None,
            "duration_seconds": patient_log.duration_seconds if patient_log else 0
        } if patient_log else None
    }
    
    # Calcular sobreposição (duração efetiva)
    if therapist_log and patient_log and therapist_log.joined_at and patient_log.joined_at:
        inicio_sobreposicao = max(therapist_log.joined_at, patient_log.joined_at)
        
        therapist_end = therapist_log.left_at or datetime.now(timezone.utc)
        patient_end = patient_log.left_at or datetime.now(timezone.utc)
        fim_sobreposicao = min(therapist_end, patient_end)
        
        if fim_sobreposicao > inicio_sobreposicao:
            duracao_efetiva = (fim_sobreposicao - inicio_sobreposicao).total_seconds()
            resultado["duracao_efetiva_segundos"] = int(duracao_efetiva)
            resultado["duracao_efetiva_minutos"] = round(duracao_efetiva / 60, 1)
        else:
            resultado["duracao_efetiva_segundos"] = 0
            resultado["duracao_efetiva_minutos"] = 0
    
    return resultado