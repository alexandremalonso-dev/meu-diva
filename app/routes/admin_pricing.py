from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import math
import os
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.plan_price import PlanPrice

router = APIRouter(prefix="/admin/pricing", tags=["admin"])

# Planos com preço. O Básico é interno (cortesia) e não tem preço.
PRICED_PLANS = ["essencial", "profissional", "premium"]

# Limites de valor de um plano de assinatura no Mercado Pago
MIN_PRICE = Decimal("0.50")
MAX_PRICE = Decimal("4000.00")


class PriceUpdateRequest(BaseModel):
    plan: str
    price_brl: float


@router.post("/update")
async def update_plan_price(
    request: PriceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Atualiza o valor de um plano: vale na hora para novas assinaturas (Asaas) e para as telas que mostram os planos"""

    plan = (request.plan or "").strip().lower()
    if plan not in PRICED_PLANS:
        raise HTTPException(status_code=400, detail="Plano inválido")

    if not math.isfinite(request.price_brl):
        raise HTTPException(status_code=400, detail="Preço inválido")

    # Decimal(str(...)) evita erro de ponto flutuante (ex.: 1.15 * 100 = 114.99999)
    price = Decimal(str(request.price_brl)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if price < MIN_PRICE or price > MAX_PRICE:
        raise HTTPException(
            status_code=400,
            detail=f"Preço deve estar entre R$ {MIN_PRICE} e R$ {MAX_PRICE}"
        )

    price_cents = int(price * 100)

    plan_price = db.query(PlanPrice).filter(PlanPrice.plan == plan).first()
    antigo = float(plan_price.price_brl) if plan_price else None

    if plan_price:
        plan_price.price_brl = price
        plan_price.price_cents = price_cents
        plan_price.updated_at = datetime.now()
        plan_price.updated_by = current_user.id
    else:
        db.add(PlanPrice(
            plan=plan,
            price_brl=price,
            price_cents=price_cents,
            updated_by=current_user.id
        ))

    db.commit()
    print(f"💲 [ADMIN] usuário {current_user.id} alterou o preço exibido do plano {plan}: {antigo} -> {price}")

    return {
        "success": True,
        "message": f"Plano {plan} atualizado para R$ {price:.2f}. O novo valor já vale para novas assinaturas e aparece nas telas que mostram os planos."
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


@router.get("/billing-check")
async def billing_check(
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Mostra o valor realmente cobrado no Mercado Pago em cada plano (somente leitura)."""
    return {}  # asaas-valor-terapeuta: a cobranca e feita pelo Asaas com o valor salvo; nao consultamos mais o Mercado Pago (so gerava alarme falso)
    import requests as _requests
    from app.routes.payments import MP_PLAN_IDS

    token = os.getenv("MP_ACCESS_TOKEN", "")
    result = {}
    for plan, plan_id in MP_PLAN_IDS.items():
        info = {"mp_plan_id": plan_id, "mp_price_brl": None, "mp_status": None, "free_trial": None}
        try:
            r = _requests.get(
                f"https://api.mercadopago.com/preapproval_plan/{plan_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8,
            )
            if r.ok:
                d = r.json()
                a = d.get("auto_recurring") or {}
                info["mp_price_brl"] = a.get("transaction_amount")
                info["mp_status"] = d.get("status")
                info["free_trial"] = a.get("free_trial") or None
        except Exception as e:
            print(f"⚠️ billing-check {plan}: {e}")
        result[plan] = info
    return result
