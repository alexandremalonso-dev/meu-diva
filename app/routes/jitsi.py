"""
Rotas para integração com Jitsi Meet
"""
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.appointment import Appointment
from app.models.patient_profile import PatientProfile
from app.models.therapist_profile import TherapistProfile
from app.services.jitsi_service import jitsi_service

router = APIRouter(prefix="/jitsi", tags=["jitsi"])


@router.get("/meet-url/{appointment_id}")
def get_jitsi_meet_url(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    """
    Retorna a URL do Jitsi Meet para uma sessão.
    - Paciente: visualiza apenas
    - Terapeuta/Admin: moderador da sala
    """
    # Buscar sessão
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verificar permissão
    is_patient = appointment.patient_user_id == current_user.id
    is_therapist = appointment.therapist_user_id == current_user.id
    is_admin = current_user.role == UserRole.admin
    
    if not (is_patient or is_therapist or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado a esta sessão")
    
    # Buscar nome do usuário para exibição
    user_name = current_user.full_name or current_user.email.split('@')[0]
    
    # Se for terapeuta ou admin, é moderador
    is_moderator = is_therapist or is_admin
    
    # Buscar também o nome do outro participante para log (opcional)
    other_user_id = appointment.therapist_user_id if is_patient else appointment.patient_user_id
    other_user = db.query(User).filter(User.id == other_user_id).first()
    other_name = other_user.full_name if other_user else "Participante"
    
    # Gerar URL da sala
    meet_url = jitsi_service.get_meet_url(
        appointment_id=appointment_id,
        user_id=current_user.id,
        user_name=user_name,
        is_moderator=is_moderator
    )
    
    return {
        "meet_url": meet_url,
        "room_name": jitsi_service.generate_room_name(appointment_id),
        "is_moderator": is_moderator,
        "appointment_id": appointment_id,
        "therapist_name": other_name if is_patient else user_name,
        "patient_name": user_name if is_patient else other_name
    }