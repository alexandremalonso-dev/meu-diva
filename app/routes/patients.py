from fastapi import APIRouter, Depends, Security
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.patient_profile import PatientProfile

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("")
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin]))
):
    """
    Lista todos os pacientes (acessível por terapeutas e admin)
    """
    patients = db.execute(
        select(User).where(User.role == UserRole.patient)
    ).scalars().all()
    
    # 🔥 ADICIONAR FOTO_URL DE CADA PACIENTE
    result = []
    for patient in patients:
        patient_profile = db.execute(
            select(PatientProfile).where(PatientProfile.user_id == patient.id)
        ).scalar_one_or_none()
        
        result.append({
            "id": patient.id,
            "email": patient.email,
            "full_name": patient.full_name,
            "foto_url": patient_profile.foto_url if patient_profile else None
        })
    
    return result