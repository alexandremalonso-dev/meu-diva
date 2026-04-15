from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.auth import get_current_user
from app.db.database import get_db  # <-- CORRIGIDO!
from app.models.user import User
from app.models.therapist_profile import TherapistProfile

router = APIRouter(prefix="/api/therapists", tags=["therapist_availability"])


@router.get("/me/availability-status")
async def get_availability_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna o status de disponibilidade do terapeuta logado"""
    
    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    return {
        "is_available_now": therapist.is_available_now if hasattr(therapist, 'is_available_now') else False
    }


@router.patch("/me/availability-status")
async def update_availability_status(
    status_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza o status de disponibilidade do terapeuta logado"""
    
    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    new_status = status_data.get("is_available_now", False)
    therapist.is_available_now = new_status
    db.commit()
    db.refresh(therapist)
    
    return {
        "is_available_now": therapist.is_available_now,
        "message": "Disponibilidade atualizada com sucesso"
    }


@router.get("/{therapist_id}/availability-status")
async def get_therapist_availability_status(
    therapist_id: int,
    db: Session = Depends(get_db)
):
    """Retorna o status de disponibilidade de um terapeuta específico (público)"""
    
    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == therapist_id
    ).first()
    
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    return {
        "is_available_now": therapist.is_available_now if hasattr(therapist, 'is_available_now') else False
    }