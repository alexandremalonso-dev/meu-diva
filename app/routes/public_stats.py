from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.db.database import get_db
from app.models.user import User
from app.models.appointment import Appointment
from app.core.roles import UserRole
from app.core.appointment_status import AppointmentStatus

router = APIRouter(prefix="/public/stats", tags=["public"])


@router.get("/")
def get_public_stats(db: Session = Depends(get_db)):
    """
    Endpoint público para estatísticas da plataforma
    - Total de terapeutas ativos
    - Total de sessões realizadas
    - Taxa de satisfação (mock por enquanto)
    """
    
    # Total de terapeutas
    total_therapists = db.execute(
        select(func.count(User.id)).where(User.role == UserRole.therapist, User.is_active == True)
    ).scalar() or 0
    
    # Total de sessões realizadas (completed)
    total_sessions = db.execute(
        select(func.count(Appointment.id)).where(Appointment.status == AppointmentStatus.completed)
    ).scalar() or 0
    
    return {
        "therapists": total_therapists,
        "sessions": total_sessions,
        "satisfaction": 98,  # Será dinâmico quando tivermos avaliações
        "online": 100
    }