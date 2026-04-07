from fastapi import Security, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.subscription import Subscription
from typing import List, Optional

# Mapeamento de recursos por plano
PLAN_FEATURES = {
    "essencial": {
        "max_patients": 10,
        "reports": False,
        "advanced_stats": False,
        "financial_report": False,
        "chat_support": False,
        "priority_support": False,
        "commission_rate": 20.0
    },
    "profissional": {
        "max_patients": 50,
        "reports": True,
        "advanced_stats": True,
        "financial_report": True,
        "chat_support": True,
        "priority_support": False,
        "commission_rate": 10.0
    },
    "premium": {
        "max_patients": 999999,
        "reports": True,
        "advanced_stats": True,
        "financial_report": True,
        "chat_support": True,
        "priority_support": True,
        "commission_rate": 3.0
    }
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


def check_plan_feature(therapist_user_id: int, feature: str, db: Session) -> bool:
    """Verifica se o terapeuta tem acesso a um recurso específico"""
    plan = get_therapist_plan(therapist_user_id, db)
    return PLAN_FEATURES.get(plan, {}).get(feature, False)


def get_plan_info(therapist_user_id: int, db: Session) -> dict:
    """Retorna informações completas do plano do terapeuta"""
    plan = get_therapist_plan(therapist_user_id, db)
    features = PLAN_FEATURES.get(plan, PLAN_FEATURES["essencial"])
    
    return {
        "plan": plan,
        "features": features,
        "upgrade_available": plan != "premium"
    }


def require_plan_feature(feature: str):
    """
    Decorator para verificar se o terapeuta tem acesso a um recurso baseado no plano.
    """
    async def plan_checker(
        current_user: User = Security(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        if current_user.role != "therapist":
            # Pacientes e admins têm acesso irrestrito
            return current_user
        
        has_feature = check_plan_feature(current_user.id, feature, db)
        
        if not has_feature:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Recurso não disponível no seu plano. Faça upgrade para acessar: {feature}"
            )
        
        return current_user
    
    return plan_checker