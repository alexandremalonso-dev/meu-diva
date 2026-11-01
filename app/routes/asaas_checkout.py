"""Rotas do Asaas: abrir o checkout HOSPEDADO (reserva) e ASSINAR com o cartao digitado no nosso site. A ativacao vem pelo webhook."""
import ipaddress

from fastapi import APIRouter, Depends, HTTPException, Request, Security
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.db.database import get_db
from app.models.user import User
from app.services import asaas_cartao_service as cartao
from app.services import asaas_cep
from app.services import asaas_checkout_service as svc
from app.services import asaas_client as ac

router = APIRouter(prefix="/asaas", tags=["asaas-checkout"])


class CheckoutBody(BaseModel):
    tipo: str
    plano: str


def _bloqueado_no_sandbox(user):
    # Em modo SANDBOX (so para testes) usuarios comuns NAO podem pagar: nao existe cobranca de verdade ali.
    if ac.modo() == "sandbox" and not ac.usuario_sandbox(user.id):
        raise HTTPException(status_code=503, detail="Pagamentos por assinatura indisponíveis no momento.")


def _ip_cliente(request: Request) -> str:
    """IP do CLIENTE (o Asaas exige o do comprador, nunca o do servidor): X-Forwarded-For/X-Real-IP do proxy; prefere o primeiro IP publico."""
    candidatos = [x.strip() for x in (request.headers.get("x-forwarded-for", "").split(",") + [request.headers.get("x-real-ip", ""), request.client.host if request.client else ""]) if x.strip()]
    validos = []
    for c in candidatos:
        try:
            validos.append(ipaddress.ip_address(c))
        except ValueError:
            pass
    for ip in validos:
        if ip.is_global:
            return str(ip)
    if validos:
        print(f"⚠️ [asaas-cartao] nenhum IP público do cliente nos cabeçalhos (usando {validos[0]}); confira o proxy (X-Forwarded-For)")
        return str(validos[0])
    return "0.0.0.0"


@router.post("/checkout")
def abrir_checkout(body: CheckoutBody, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    _bloqueado_no_sandbox(current_user)
    return svc.criar_checkout(db, current_user, (body.tipo or "").strip().lower(), body.plano)


@router.post("/assinar")
async def assinar(request: Request, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    # O corpo e lido SEM modelo pydantic de proposito: um erro de validacao do FastAPI devolveria (e registraria) o que foi digitado, inclusive o cartao.
    _bloqueado_no_sandbox(current_user)
    try:
        dados = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Requisição inválida.")
    return cartao.assinar_com_cartao(db, current_user, dados, _ip_cliente(request))


@router.get("/cep/{cep}")
def consultar_cep(cep: str, current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    return asaas_cep.consultar(cep)


@router.get("/checkout/{local_id}/status")
def status_do_checkout(local_id: int, db: Session = Depends(get_db), current_user: User = Security(require_roles([UserRole.patient, UserRole.therapist]))):
    return svc.status_checkout(db, current_user, local_id)
