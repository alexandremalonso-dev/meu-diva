from sqlalchemy.orm import Session
from app.models.subscription import Subscription
from app.models.therapist_profile import TherapistProfile

# Prioridade de exibição na busca (quanto maior, mais alto aparece)
PLAN_PRIORITY = {
    "premium": 3,       # Primeiros na busca
    "profissional": 2,  # Depois
    "essencial": 1      # Por último
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


def get_plan_priority_value(plan: str) -> int:
    """Retorna o valor de prioridade do plano"""
    return PLAN_PRIORITY.get(plan, 1)