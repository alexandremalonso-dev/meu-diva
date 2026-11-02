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


# 🔥 CORRIGIDO: Endpoint público (não requer autenticação)
@router.get("/")
async def get_all_plans(
    db: Session = Depends(get_db),
):
    """Retorna todos os planos disponíveis com preços e features (PÚBLICO)"""
    
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
            "is_free": plan == "basico"
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
    
    current_plan = subscription.plan if subscription else "basico"
    
    # Buscar preços do banco
    plan_prices = db.query(PlanPrice).all()
    price_map = {p.plan: {"price_cents": p.price_cents, "price_brl": float(p.price_brl)} for p in plan_prices}
    
    # Calcular savings em relação ao essencial (20% de comissão vs plano atual)
    commission_rates = {
        "basico": 20.0,
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
        "is_free": current_plan == "basico",
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


@router.get("/empresa")
async def get_empresa_plans(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.empresa, UserRole.admin]))
):
    """asaas-precos-final: planos de EMPRESA ativos (nome, valor por colaborador, sessoes). So empresa e admin: sao valores comerciais, nao publicos."""
    from app.models.empresa_plano import EmpresaPlano

    planos = db.query(EmpresaPlano).filter(EmpresaPlano.ativo == True).order_by(EmpresaPlano.preco_mensal_por_colaborador).all()
    return {
        "plans": [
            {
                "chave": p.chave,
                "nome": p.nome,
                "preco_mensal_por_colaborador": float(p.preco_mensal_por_colaborador or 0),
                "sessoes_inclusas_por_colaborador": int(p.sessoes_inclusas_por_colaborador or 0),
                "descricao": p.descricao,
            }
            for p in planos
        ]
    }


@router.get("/repasse")
async def get_repasse_faixa(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin]))
):
    """asaas-precos-final: menor e maior valor por sessao que o terapeuta recebe nos planos ativos (paciente e empresa)."""
    from sqlalchemy import text

    r = db.execute(text(
        "SELECT min(v), max(v) FROM ("
        "SELECT valor_repassado_terapeuta AS v FROM patient_plans WHERE ativo = TRUE "
        "UNION ALL SELECT valor_repassado_terapeuta FROM empresa_planos WHERE ativo = TRUE"
        ") t WHERE v IS NOT NULL"
    )).first()
    if not r or r[0] is None:
        return {"min": None, "max": None}
    return {"min": float(r[0]), "max": float(r[1])}
