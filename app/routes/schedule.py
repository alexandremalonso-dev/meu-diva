from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.auth import get_current_user
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability

# 🔥 IMPORTS CORRIGIDOS
from app.schemas.therapist import TherapistProfileOut
from app.schemas.therapist_availability import AvailabilityCreate, AvailabilityOut

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/therapists", response_model=List[TherapistProfileOut])
def list_therapists_for_scheduling(
    db: Session = Depends(get_db),
    # 🔥 ALTERADO: Depends → Security com lista de papéis
    current_user: User = Security(require_roles([UserRole.patient, UserRole.admin])),
):
    """
    Lista todos os terapeutas disponíveis para agendamento (pacientes)
    """
    therapists = db.execute(
        select(TherapistProfile).join(User).where(User.role == UserRole.therapist)
    ).scalars().all()
    
    return therapists


@router.get("/therapists/{therapist_id}/availability", response_model=List[AvailabilityOut])
def get_therapist_availability(
    therapist_id: int,
    db: Session = Depends(get_db),
    # 🔥 ALTERADO: Depends → Security com lista de papéis
    current_user: User = Security(require_roles([UserRole.patient, UserRole.admin])),
):
    """
    Retorna a disponibilidade semanal de um terapeuta específico
    """
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == therapist_id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
    
    availability = db.execute(
        select(TherapistAvailability).where(
            TherapistAvailability.therapist_profile_id == therapist_profile.id
        )
    ).scalars().all()
    
    return availability