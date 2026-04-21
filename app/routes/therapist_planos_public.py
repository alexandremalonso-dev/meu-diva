from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.plan_price import PlanPrice
from pydantic import BaseModel

router = APIRouter(prefix="/therapist/planos", tags=["Therapist Planos Public"])


class TherapistPlanoOut(BaseModel):
    id: int
    plan: str
    price_brl: float
    price_cents: int
    features: List[str] = []

    class Config:
        from_attributes = True


def get_plan_features(plan_id: str) -> List[str]:
    """Retorna features específicas de cada plano"""
    features_map = {
        "profissional": [
            "Tudo do Essencial",
            "Perfil no marketplace",
            "Captação de novos pacientes",
            "Relatórios financeiros avançados",
            "Suporte prioritário",
            "Chat com pacientes"
        ],
        "premium": [
            "Tudo do Profissional",
            "Destaque no marketplace",
            "Leads diretos da plataforma",
            "Acesso a pacientes corporativos",
            "Suporte dedicado",
            "Menor comissão do mercado"
        ]
    }
    return features_map.get(plan_id, [])


@router.get("/", response_model=List[TherapistPlanoOut])
def listar_planos_terapeuta_publico(
    db: Session = Depends(get_db),
):
    """
    Lista todos os planos disponíveis para terapeutas (Profissional e Premium).
    Este endpoint é PÚBLICO (não requer autenticação) para ser usado no cadastro.
    O plano Essencial é grátis e não está na tabela.
    """
    planos = db.query(PlanPrice).order_by(PlanPrice.price_cents).all()
    
    result = []
    for plano in planos:
        result.append(
            TherapistPlanoOut(
                id=plano.id,
                plan=plano.plan,
                price_brl=float(plano.price_brl),
                price_cents=plano.price_cents,
                features=get_plan_features(plano.plan)
            )
        )
    
    return result