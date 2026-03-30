"""
Rotas para integração com Google Meet
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.deps import get_db
from app.core.auth import get_current_user
from app.models.user import User, UserRole
from app.models.appointment import Appointment
from app.core.google_meet import google_meet_service

router = APIRouter()


def require_roles(allowed_roles: list):
    """
    Dependency para verificar roles
    """
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Permissão negada. Acesso restrito."
            )
        return current_user
    return role_checker


@router.post("/meet/generate/{appointment_id}")
async def generate_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist, UserRole.admin]))
):
    """
    Gera link do Google Meet para uma sessão
    Apenas terapeutas e admin podem gerar links
    """
    # Busca o appointment
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verifica permissão (apenas o terapeuta da sessão ou admin)
    if current_user.role != UserRole.admin and appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Se já tem link, retorna ele
    if appointment.video_call_url:
        return {"meet_url": appointment.video_call_url}
    
    # Cria novo link
    meet_url = google_meet_service.create_meet_link(appointment)
    
    if meet_url:
        appointment.video_call_url = meet_url
        db.commit()
        return {"meet_url": meet_url}
    else:
        raise HTTPException(status_code=500, detail="Erro ao gerar link do Meet")


@router.get("/meet/{appointment_id}")
async def get_meet_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtém o link do Meet de uma sessão
    Paciente e terapeuta podem acessar
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verifica permissão
    if current_user.role == UserRole.patient:
        if appointment.patient_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Sem permissão")
    elif current_user.role == UserRole.therapist:
        if appointment.therapist_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Sem permissão")
    elif current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    if not appointment.video_call_url:
        raise HTTPException(status_code=404, detail="Link do Meet ainda não gerado")
    
    return {"meet_url": appointment.video_call_url}