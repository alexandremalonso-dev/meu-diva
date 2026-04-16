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
from app.services.jitsi_service import jitsi_service

router = APIRouter(prefix="/jitsi", tags=["jitsi"])


@router.get("/meet-url/{appointment_id}")
def get_jitsi_meet_url(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([
        UserRole.patient,
        UserRole.therapist,
        UserRole.admin
    ]))
):
    """
    Retorna a URL do Jitsi Meet para uma sessão.

    Regras:
    - Paciente → participante
    - Terapeuta/Admin → moderador
    """

    # ==========================
    # BUSCAR SESSÃO
    # ==========================
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )

    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    # ==========================
    # PERMISSÃO
    # ==========================
    is_patient = appointment.patient_user_id == current_user.id
    is_therapist = appointment.therapist_user_id == current_user.id
    is_admin = current_user.role == UserRole.admin

    if not (is_patient or is_therapist or is_admin):
        raise HTTPException(status_code=403, detail="Acesso negado")

    # ==========================
    # NOME SEGURO
    # ==========================
    def safe_name(user: User) -> str:
        if user.full_name and user.full_name.strip():
            return user.full_name.strip()
        return user.email.split("@")[0]

    user_name = safe_name(current_user)

    # ==========================
    # MODERADOR
    # ==========================
    is_moderator = is_therapist or is_admin

    # ==========================
    # OUTRO PARTICIPANTE
    # ==========================
    other_user_id = (
        appointment.therapist_user_id if is_patient
        else appointment.patient_user_id
    )

    other_user = db.query(User).filter(User.id == other_user_id).first()
    other_name = safe_name(other_user) if other_user else "Participante"

    # ==========================
    # GERAR URL
    # ==========================
    meet_url = jitsi_service.get_meet_url(
        appointment_id=appointment_id,
        user_id=current_user.id,
        user_name=user_name,
        is_moderator=is_moderator
    )

    room_name = jitsi_service.generate_room_name(appointment_id)

    # ==========================
    # RESPOSTA PADRONIZADA
    # ==========================
    return {
        "meet_url": meet_url,
        "room_name": room_name,
        "is_moderator": is_moderator,
        "appointment_id": appointment_id,
        "user_name": user_name,
        "other_name": other_name,
        "role": "moderator" if is_moderator else "participant"
    }