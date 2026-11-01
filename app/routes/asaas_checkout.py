"""Rotas para ABRIR o checkout de assinatura no Asaas. O pagamento acontece na pagina do Asaas; a ativacao vem pelo webhook."""
from fastapi import APIRouter, Depends, HTTPException, Security
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.db.database import get_db
from app.models.user import User
from app.services import asaas_checkout_service as svc
from app.services import asaas_client as ac

router = APIRouter(prefix="/asaas", tags=["asaas-checkout"])


class CheckoutBody(BaseModel):
    tipo: str
    plano: str


@router.post("/checkout")
def abrir_checkout(body: CheckoutBody, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    # Em modo SANDBOX (so para testes) usuarios comuns NAO podem abrir checkout: nao existe cobranca de verdade ali.
    if ac.modo() == "sandbox" and not ac.usuario_sandbox(current_user.id):
        raise HTTPException(status_code=503, detail="Pagamentos por assinatura indisponíveis no momento.")
    return svc.criar_checkout(db, current_user, (body.tipo or "").strip().lower(), body.plano)


@router.get("/checkout/{local_id}/status")
def status_do_checkout(local_id: int, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    return svc.status_checkout(db, current_user, local_id)
