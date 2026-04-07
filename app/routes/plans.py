from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.pricing_config import get_plan_name, get_plan_features, PLAN_FEATURES_DISPLAY
from app.models.user import User
from app.models.subscription import Subscription
from app.models.therapist_profile import TherapistProfile
from app.models.plan_price import PlanPrice

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/")
async def get_all_plans(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin]))
):
    """Retorna todos os planos disponíveis com preços e features"""
    
    # Buscar preços do banco
    plan_prices = db.query(PlanPrice).all()
    price_map = {p.plan: {"price_cents": p.price_cents, "price_brl": float(p.price_brl)} for p in plan_prices}
    
    plans = []
    for plan in ["essencial", "profissional", "premium"]:
        plan_data = {
            "id": plan,
            "name": get_plan_name(plan),
            "price_cents": price_map.get(plan, {}).get("price_cents", 0),
            "price_brl": price_map.get(plan, {}).get("price_brl", 0.0),
            "features": get_plan_features(plan),
            "is_free": plan == "essencial"
        }
        plans.append(plan_data)
    
    return {"plans": plans}


@router.get("/current")
async def get_current_plan(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Retorna o plano atual do terapeuta logado"""
    
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    subscription = db.query(Subscription).filter(
        Subscription.therapist_id == therapist_profile.id,
        Subscription.status == "active"
    ).first()
    
    current_plan = subscription.plan if subscription else "essencial"
    
    # Buscar preços do banco
    plan_prices = db.query(PlanPrice).all()
    price_map = {p.plan: {"price_cents": p.price_cents, "price_brl": float(p.price_brl)} for p in plan_prices}
    
    # Calcular savings em relação ao essencial (20% de comissão vs plano atual)
    commission_rates = {
        "essencial": 20.0,
        "profissional": 10.0,
        "premium": 3.0
    }
    
    # Exemplo: se terapeuta faz 20 sessões/mês a R$200
    example_sessions = 20
    example_session_price = 200
    current_commission = (example_session_price * commission_rates.get(current_plan, 20) / 100) * example_sessions
    essential_commission = (example_session_price * 20 / 100) * example_sessions
    monthly_saving = essential_commission - current_commission
    
    return {
        "current_plan": current_plan,
        "plan_name": get_plan_name(current_plan),
        "features": get_plan_features(current_plan),
        "price_brl": price_map.get(current_plan, {}).get("price_brl", 0),
        "price_cents": price_map.get(current_plan, {}).get("price_cents", 0),
        "is_free": current_plan == "essencial",
        "example_saving": round(monthly_saving, 2),
        "upgrade_available": current_plan != "premium"
    }


@router.get("/checkout-url/{plan_id}")
async def get_checkout_url(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Gera URL de checkout para upgrade de plano"""
    
    if plan_id not in ["profissional", "premium"]:
        raise HTTPException(status_code=400, detail="Plano inválido")
    
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    # Chamar o endpoint de criação de checkout
    from app.routes.payments import create_subscription_checkout
    # Retornar URL para o frontend redirecionar
    return {"checkout_url": f"/api/payments/create-subscription-checkout?plan={plan_id}"}