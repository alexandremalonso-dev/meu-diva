from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.plan_price import PlanPrice
from pydantic import BaseModel

router = APIRouter(prefix="/therapist-plans", tags=["Therapist Plans"])


class PlanOut(BaseModel):
    id: int
    plan: str
    price_brl: float
    price_cents: int

    class Config:
        from_attributes = True


@router.get("/", response_model=List[PlanOut])
def get_therapist_plans(db: Session = Depends(get_db)):
    """Endpoint público para buscar planos de terapeuta"""
    plans = db.query(PlanPrice).order_by(PlanPrice.price_cents).all()
    return plans