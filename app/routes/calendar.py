from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from app.db.database import get_db
from app.core.auth import get_current_user_optional
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.appointment import Appointment
from app.core.appointment_status import AppointmentStatus

router = APIRouter(prefix="/calendar", tags=["calendar"])

def _parse_tz_offset(tz_offset: str) -> timezone:
    """Parse timezone offset string like -03:00"""
    try:
        sign = 1
        s = tz_offset.strip()
        if s.startswith("-"):
            sign = -1
            s = s[1:]
        elif s.startswith("+"):
            s = s[1:]
        hh, mm = s.split(":")
        delta = timedelta(hours=int(hh), minutes=int(mm))
        return timezone(sign * delta)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="tz_offset inválido. Use formato: -03:00, +00:00, +02:30"
        )

def _overlaps(s1: datetime, e1: datetime, s2: datetime, e2: datetime) -> bool:
    """Check if two time intervals overlap"""
    return s1 < e2 and e1 > s2

@router.get("")
def get_available_slots(
    therapistId: int = Query(..., description="ID do terapeuta"),
    days: int = Query(30, ge=1, le=60, description="Número de dias para buscar"),
    tz_offset: str = Query("-03:00", description="Fuso horário do cliente"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Retorna os slots disponíveis para um terapeuta
    """
    print(f"\n📅 GET /calendar - therapistId: {therapistId}, days: {days}")
    
    try:
        tz = _parse_tz_offset(tz_offset)
        
        # Buscar perfil do terapeuta
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == therapistId)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
        
        # Buscar disponibilidades do terapeuta
        availabilities = db.execute(
            select(TherapistAvailability).where(
                TherapistAvailability.therapist_profile_id == therapist_profile.id
            )
        ).scalars().all()
        
        if not availabilities:
            return {
                "therapist_user_id": therapistId,
                "range_start": datetime.now(tz),
                "range_end": datetime.now(tz) + timedelta(days=days),
                "slots": [],
                "count": 0
            }
        
        # Organizar por dia da semana
        av_by_weekday = {}
        for av in availabilities:
            av_by_weekday.setdefault(av.weekday, []).append(av)
        
        # Buscar appointments ocupados
        now_utc = datetime.now(timezone.utc)
        range_start_utc = now_utc
        range_end_utc = now_utc + timedelta(days=days)
        
        busy_appointments = db.execute(
            select(Appointment).where(
                and_(
                    Appointment.therapist_user_id == therapistId,
                    Appointment.status.in_([
                        AppointmentStatus.scheduled,
                        AppointmentStatus.confirmed,
                        AppointmentStatus.proposed
                    ]),
                    Appointment.starts_at < range_end_utc,
                    Appointment.ends_at > range_start_utc
                )
            )
        ).scalars().all()
        
        busy_windows = [
            (a.starts_at.astimezone(tz), a.ends_at.astimezone(tz))
            for a in busy_appointments
        ]
        
        # Calcular slots disponíveis
        range_start = datetime.now(tz)
        range_end = range_start + timedelta(days=days)
        
        slots = []
        step = timedelta(minutes=50)  # Duração padrão
        
        current_date = range_start.date()
        end_date = range_end.date()
        
        while current_date <= end_date:
            weekday = datetime(current_date.year, current_date.month, current_date.day, tzinfo=tz).weekday()
            day_windows = av_by_weekday.get(weekday, [])
            
            for window in day_windows:
                window_start = datetime.combine(current_date, window.start_time, tzinfo=tz)
                window_end = datetime.combine(current_date, window.end_time, tzinfo=tz)
                
                if window_end <= range_start or window_start >= range_end:
                    continue
                
                cursor = max(window_start, range_start)
                last_end = min(window_end, range_end)
                
                while cursor + step <= last_end:
                    slot_start = cursor
                    slot_end = cursor + step
                    
                    # Verificar se não conflita com appointments ocupados
                    if all(not _overlaps(slot_start, slot_end, busy_start, busy_end) 
                           for busy_start, busy_end in busy_windows):
                        slots.append({
                            "starts_at": slot_start.isoformat(),
                            "ends_at": slot_end.isoformat(),
                            "duration_minutes": 50
                        })
                    
                    cursor += step
            
            current_date += timedelta(days=1)
        
        slots.sort(key=lambda x: x["starts_at"])
        
        result = {
            "therapist_user_id": therapistId,
            "range_start": range_start.isoformat(),
            "range_end": range_end.isoformat(),
            "slots": slots,
            "count": len(slots)
        }
        
        print(f"✅ Encontrados {len(slots)} slots disponíveis")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar slots: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")