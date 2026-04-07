"""
Configuração de preços dos planos
Os preços são armazenados no banco de dados na tabela plan_prices
"""

from sqlalchemy.orm import Session
from app.db.database import SessionLocal

# Fallback prices (caso banco esteja vazio)
FALLBACK_PRICES = {
    "profissional": {"price_cents": 7900, "price_brl": 79.00},
    "premium": {"price_cents": 14900, "price_brl": 149.00}
}

PLAN_NAMES = {
    "essencial": "Essencial",
    "profissional": "Profissional",
    "premium": "Premium"
}

PLAN_DESCRIPTIONS = {
    "essencial": "Perfeito para começar",
    "profissional": "Para terapeutas em crescimento",
    "premium": "Para clínicas e profissionais experientes"
}

PLAN_FEATURES_DISPLAY = {
    "essencial": [
        "✓ Até 10 pacientes ativos",
        "✓ Agendamento básico",
        "✓ Prontuário digital",
        "✓ Comissão de 20% por sessão"
    ],
    "profissional": [
        "✓ Até 50 pacientes ativos",
        "✓ Relatórios financeiros",
        "✓ Estatísticas avançadas",
        "✓ Suporte por chat",
        "✓ Comissão de 10% por sessão",
        "✓ Agendamento ilimitado"
    ],
    "premium": [
        "✓ Pacientes ilimitados",
        "✓ Relatórios completos",
        "✓ Estatísticas avançadas",
        "✓ Suporte prioritário",
        "✓ Comissão de 3% por sessão",
        "✓ Agendamento ilimitado",
        "✓ Acesso antecipado a novas features"
    ]
}


def get_plan_price_cents(plan: str, db: Session = None) -> int:
    """Retorna o preço do plano em centavos"""
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        from app.models.plan_price import PlanPrice
        plan_price = db.query(PlanPrice).filter(PlanPrice.plan == plan).first()
        if plan_price:
            return plan_price.price_cents
        return FALLBACK_PRICES.get(plan, {}).get("price_cents", 0)
    except Exception as e:
        print(f"⚠️ Erro ao buscar preço do plano {plan}: {e}")
        return FALLBACK_PRICES.get(plan, {}).get("price_cents", 0)
    finally:
        if should_close:
            db.close()


def get_plan_price_brl(plan: str, db: Session = None) -> float:
    """Retorna o preço do plano em reais"""
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        from app.models.plan_price import PlanPrice
        plan_price = db.query(PlanPrice).filter(PlanPrice.plan == plan).first()
        if plan_price:
            return float(plan_price.price_brl)
        return FALLBACK_PRICES.get(plan, {}).get("price_brl", 0.0)
    except Exception as e:
        print(f"⚠️ Erro ao buscar preço do plano {plan}: {e}")
        return FALLBACK_PRICES.get(plan, {}).get("price_brl", 0.0)
    finally:
        if should_close:
            db.close()


def get_plan_name(plan: str) -> str:
    """Retorna o nome amigável do plano"""
    return PLAN_NAMES.get(plan, plan.capitalize())


def get_plan_features(plan: str) -> list:
    """Retorna a lista de features do plano"""
    return PLAN_FEATURES_DISPLAY.get(plan, [])


def get_all_plans_prices(db: Session = None) -> dict:
    """Retorna os preços de todos os planos"""
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        from app.models.plan_price import PlanPrice
        plans = db.query(PlanPrice).all()
        result = {}
        for plan in plans:
            result[plan.plan] = {
                "price_cents": plan.price_cents,
                "price_brl": float(plan.price_brl)
            }
        return result
    except Exception as e:
        print(f"⚠️ Erro ao buscar preços: {e}")
        return FALLBACK_PRICES
    finally:
        if should_close:
            db.close()