"""Rotas para ABRIR o checkout de assinatura no Asaas. O pagamento acontece na pagina do Asaas; a ativacao vem pelo webhook."""
from fastapi import APIRouter, Depends, Security
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.db.database import get_db
from app.models.user import User
from app.services import asaas_checkout_service as svc

router = APIRouter(prefix="/asaas", tags=["asaas-checkout"])


class CheckoutBody(BaseModel):
    tipo: str
    plano: str


@router.post("/checkout")
def abrir_checkout(body: CheckoutBody, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    return svc.criar_checkout(db, current_user, (body.tipo or "").strip().lower(), body.plano)


@router.get("/checkout/{local_id}/status")
def status_do_checkout(local_id: int, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    return svc.status_checkout(db, current_user, local_id)
