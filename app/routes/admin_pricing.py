from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.plan_price import PlanPrice

router = APIRouter(prefix="/admin/pricing", tags=["admin"])


class PriceUpdateRequest(BaseModel):
    plan: str
    price_brl: float


@router.post("/update")
async def update_plan_price(
    request: PriceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Atualiza o preço de um plano no banco de dados"""
    
    if request.plan not in ["profissional", "premium"]:
        raise HTTPException(status_code=400, detail="Plano inválido")
    
    if request.price_brl <= 0:
        raise HTTPException(status_code=400, detail="Preço deve ser maior que zero")
    
    price_cents = int(request.price_brl * 100)
    
    # Buscar ou criar o registro
    plan_price = db.query(PlanPrice).filter(PlanPrice.plan == request.plan).first()
    
    if plan_price:
        plan_price.price_brl = request.price_brl
        plan_price.price_cents = price_cents
        plan_price.updated_at = datetime.now()
        plan_price.updated_by = current_user.id
    else:
        plan_price = PlanPrice(
            plan=request.plan,
            price_brl=request.price_brl,
            price_cents=price_cents,
            updated_by=current_user.id
        )
        db.add(plan_price)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Preço do plano {request.plan} atualizado para R$ {request.price_brl:.2f}"
    }


@router.get("/get")
async def get_pricing(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Retorna os preços atuais dos planos"""
    
    plans = db.query(PlanPrice).all()
    result = {}
    
    for plan in plans:
        result[plan.plan] = {
            "price_brl": float(plan.price_brl),
            "price_cents": plan.price_cents,
            "updated_at": plan.updated_at
        }
    
    return result