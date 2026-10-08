import os
from fastapi import APIRouter, Depends, Security
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.subscription import Subscription

router = APIRouter(prefix="/therapist/onboarding", tags=["therapist-onboarding"])


def _enforce_enabled() -> bool:
    """Interruptor da trava: ONBOARDING_ENFORCE=true no .env.prod (padrão: desligado)."""
    return os.getenv("ONBOARDING_ENFORCE", "false").strip().lower() in ("1", "true", "yes", "sim")


@router.get("/status")
def onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist])),
):
    """
    Terapeuta NOVO = nenhuma linha em subscriptions. Os terapeutas que já existiam
    foram migrados para uma linha 'basico' (cortesia), então não caem no onboarding.
    """
    profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    sub = None
    if profile:
        sub = db.query(Subscription).filter(
            Subscription.therapist_id == profile.id
        ).order_by(Subscription.id.desc()).first()

    return {
        "needs_plan": bool(profile and sub is None),
        "plan": sub.plan if sub else None,
        "status": sub.status if sub else None,
        "enforce": _enforce_enabled(),
    }


from sqlalchemy import text as _sql_text
from app.services.plan_priority import get_therapist_plan as _get_plan


@router.get("/features")
def my_features(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist])),
):
    """
    Recursos liberados para o plano do terapeuta, segundo a tela de permissões do admin
    (tabela plan_features_config). Recurso sem linha na tabela não aparece aqui, e quem
    consome trata a ausência como liberado (falha "aberto").
    """
    plan = _get_plan(current_user.id, db)
    col = {
        "basico": "available_in_basico",
        "essencial": "available_in_essencial",
        "profissional": "available_in_profissional",
        "premium": "available_in_premium",
    }.get(plan)
    features = {}
    if col:
        try:
            rows = db.execute(_sql_text(f"SELECT feature_id, is_active, {col} FROM plan_features_config")).all()
            for fid, active, avail in rows:
                features[fid] = bool(active) and bool(avail)
        except Exception as e:
            db.rollback()
            print(f"⚠️ /therapist/features: {e}")
    return {"plan": plan, "features": features}
