from sqlalchemy.orm import Session
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.subscription import Subscription
from app.models.appointment import Appointment

# Limites máximos de pacientes por plano
PLAN_PATIENT_LIMITS = {
    "essencial": 10,
    "profissional": 50,
    "premium": 999999  # Ilimitado
}

def get_therapist_plan(therapist_user_id: int, db: Session) -> str:
    """Retorna o plano atual do terapeuta"""
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == therapist_user_id
    ).first()
    
    if not therapist_profile:
        return "essencial"
    
    subscription = db.query(Subscription).filter(
        Subscription.therapist_id == therapist_profile.id,
        Subscription.status == "active"
    ).first()
    
    if not subscription:
        return "essencial"
    
    return subscription.plan


def get_current_patient_count(therapist_user_id: int, db: Session) -> int:
    """Retorna o número atual de pacientes ativos do terapeuta"""
    # Contar pacientes únicos que já tiveram pelo menos uma sessão
    # ou que foram convidados pelo terapeuta
    patient_count = db.query(Appointment.patient_user_id).filter(
        Appointment.therapist_user_id == therapist_user_id,
        Appointment.status.in_(["scheduled", "confirmed", "completed", "proposed"])
    ).distinct().count()
    
    return patient_count


def can_add_patient(therapist_user_id: int, db: Session, new_patient_id: int = None) -> tuple[bool, str]:
    """Verifica se o terapeuta pode adicionar um novo paciente"""
    plan = get_therapist_plan(therapist_user_id, db)
    max_patients = PLAN_PATIENT_LIMITS.get(plan, 10)
    current_count = get_current_patient_count(therapist_user_id, db)
    
    if plan == "premium":
        return True, ""
    
    if current_count >= max_patients:
        plan_names = {"essencial": "Essencial", "profissional": "Profissional", "premium": "Premium"}
        plan_display = plan_names.get(plan, plan)
        return False, f"Limite de pacientes do plano {plan_display} atingido ({max_patients} pacientes). Faça upgrade para adicionar mais pacientes."
    
    remaining = max_patients - current_count
    return True, f"Você pode adicionar mais {remaining} paciente(s)"


def get_patient_limit_info(therapist_user_id: int, db: Session) -> dict:
    """Retorna informações sobre o limite de pacientes do terapeuta"""
    plan = get_therapist_plan(therapist_user_id, db)
    max_patients = PLAN_PATIENT_LIMITS.get(plan, 10)
    current_count = get_current_patient_count(therapist_user_id, db)
    
    plan_names = {"essencial": "Essencial", "profissional": "Profissional", "premium": "Premium"}
    
    return {
        "plan": plan,
        "plan_display": plan_names.get(plan, plan),
        "current_patients": current_count,
        "max_patients": max_patients if max_patients < 999999 else None,
        "is_unlimited": max_patients >= 999999,
        "remaining": None if max_patients >= 999999 else max_patients - current_count,
        "can_add_more": current_count < max_patients or max_patients >= 999999
    }