from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.availability import AvailabilityPeriod, AvailabilitySlot

router = APIRouter(prefix="/admin/availability", tags=["admin"])

@router.get("/all")
def get_all_therapists_availability(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """
    Endpoint exclusivo para admin visualizar TODOS os períodos de disponibilidade
    de TODOS os terapeutas cadastrados.
    """
    
    # Buscar todos os terapeutas
    therapists = db.execute(
        select(TherapistProfile)
    ).scalars().all()
    
    result = []
    
    for therapist in therapists:
        # Buscar períodos do terapeuta
        periods = db.execute(
            select(AvailabilityPeriod)
            .where(AvailabilityPeriod.therapist_profile_id == therapist.id)
            .order_by(AvailabilityPeriod.start_date.desc())
        ).scalars().all()
        
        if not periods:
            continue
        
        periods_data = []
        for period in periods:
            # Buscar slots do período
            slots = db.execute(
                select(AvailabilitySlot)
                .where(AvailabilitySlot.period_id == period.id)
                .order_by(AvailabilitySlot.weekday, AvailabilitySlot.start_time)
            ).scalars().all()
            
            periods_data.append({
                "id": period.id,
                "start_date": period.start_date.isoformat(),
                "end_date": period.end_date.isoformat(),
                "slots": [
                    {
                        "id": slot.id,
                        "weekday": slot.weekday,
                        "start_time": str(slot.start_time),
                        "end_time": str(slot.end_time)
                    }
                    for slot in slots
                ]
            })
        
        result.append({
            "therapist_id": therapist.user_id,
            "therapist_profile_id": therapist.id,
            "therapist_name": therapist.full_name,
            "periods": periods_data
        })
    
    return result