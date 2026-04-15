from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func, desc
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment
from app.models.session_participant import SessionParticipant

router = APIRouter(prefix="/admin/reports", tags=["admin"])


@router.get("/sessoes-duracao")
def get_sessoes_duracao(
    start_date: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    therapist_id: Optional[int] = Query(None, description="ID do terapeuta"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """
    Relatório de duração efetiva das sessões
    Calcula o tempo de sobreposição entre terapeuta e paciente
    """
    print(f"\n📊 [ADMIN] Relatório de Duração de Sessões")
    
    # Configurar datas
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    else:
        start = datetime.now() - timedelta(days=90)
    
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d")
        end = end.replace(hour=23, minute=59, second=59)
    else:
        end = datetime.now()
    
    # Buscar appointments no período
    query = db.query(Appointment).filter(
        Appointment.starts_at >= start,
        Appointment.starts_at <= end,
        Appointment.status.in_(["completed", "confirmed", "scheduled"])
    )
    
    if therapist_id:
        query = query.filter(Appointment.therapist_user_id == therapist_id)
    
    appointments = query.order_by(Appointment.starts_at.desc()).all()
    
    # Buscar participantes
    appointment_ids = [apt.id for apt in appointments]
    participants = db.query(SessionParticipant).filter(
        SessionParticipant.appointment_id.in_(appointment_ids)
    ).all()
    
    # Mapear participantes por appointment
    participants_by_appointment: Dict[int, Dict[str, Any]] = {}
    for p in participants:
        if p.appointment_id not in participants_by_appointment:
            participants_by_appointment[p.appointment_id] = {}
        
        role_key = "therapist" if p.user_role == "therapist" else "patient"
        participants_by_appointment[p.appointment_id][role_key] = {
            "joined_at": p.joined_at,
            "left_at": p.left_at,
            "duration_seconds": p.duration_seconds or 0
        }
    
    # Processar resultados
    sessions_list = []
    therapists_set = set()
    
    for apt in appointments:
        therapist = db.get(TherapistProfile, apt.therapist_user_id)
        therapist_user = db.get(User, apt.therapist_user_id) if therapist else None
        patient = db.get(PatientProfile, apt.patient_user_id)
        patient_user = db.get(User, apt.patient_user_id) if patient else None
        
        therapist_name = therapist.full_name if therapist else (therapist_user.full_name if therapist_user else f"Terapeuta {apt.therapist_user_id}")
        patient_name = patient.full_name if patient else (patient_user.full_name if patient_user else f"Paciente {apt.patient_user_id}")
        patient_email = patient_user.email if patient_user else ""
        
        therapists_set.add(apt.therapist_user_id)
        
        participant_data = participants_by_appointment.get(apt.id, {})
        therapist_participant = participant_data.get("therapist")
        patient_participant = participant_data.get("patient")
        
        # Calcular duração efetiva (sobreposição)
        effective_duration_seconds = 0
        
        if therapist_participant and patient_participant:
            therapist_joined = therapist_participant["joined_at"]
            therapist_left = therapist_participant["left_at"] or datetime.now()
            patient_joined = patient_participant["joined_at"]
            patient_left = patient_participant["left_at"] or datetime.now()
            
            start_overlap = max(therapist_joined, patient_joined)
            end_overlap = min(therapist_left, patient_left)
            
            if end_overlap > start_overlap:
                effective_duration_seconds = int((end_overlap - start_overlap).total_seconds())
        
        sessions_list.append({
            "id": apt.id,
            "appointment_id": apt.id,
            "date": apt.starts_at.strftime("%Y-%m-%d"),
            "time": apt.starts_at.strftime("%H:%M"),
            "patient_name": patient_name,
            "patient_email": patient_email,
            "patient_foto_url": patient.foto_url if patient else None,
            "therapist_name": therapist_name,
            "therapist_id": apt.therapist_user_id,
            "therapist_foto_url": therapist.foto_url if therapist else None,
            "status": apt.status,
            "session_price": float(apt.session_price or 0),
            "therapist_joined_at": therapist_participant["joined_at"].isoformat() if therapist_participant and therapist_participant["joined_at"] else None,
            "therapist_left_at": therapist_participant["left_at"].isoformat() if therapist_participant and therapist_participant["left_at"] else None,
            "therapist_duration_seconds": therapist_participant["duration_seconds"] if therapist_participant else 0,
            "patient_joined_at": patient_participant["joined_at"].isoformat() if patient_participant and patient_participant["joined_at"] else None,
            "patient_left_at": patient_participant["left_at"].isoformat() if patient_participant and patient_participant["left_at"] else None,
            "patient_duration_seconds": patient_participant["duration_seconds"] if patient_participant else 0,
            "effective_duration_seconds": effective_duration_seconds,
            "effective_duration_minutes": round(effective_duration_seconds / 60, 1)
        })
    
    # Lista de terapeutas para filtro
    therapists_list = []
    for therapist_id in therapists_set:
        therapist = db.get(TherapistProfile, therapist_id)
        therapist_user = db.get(User, therapist_id)
        if therapist:
            therapists_list.append({
                "id": therapist_id,
                "name": therapist.full_name or (therapist_user.full_name if therapist_user else f"Terapeuta {therapist_id}")
            })
    
    return {
        "sessions": sessions_list,
        "therapists": therapists_list,
        "period": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat()
        }
    }