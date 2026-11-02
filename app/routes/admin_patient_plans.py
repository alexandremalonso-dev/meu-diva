import os
import re
import time
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Security
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.patient_plan import PatientPlan

router = APIRouter(prefix="/admin/pacientes/planos", tags=["Admin - Planos de Pacientes"])

# Limites de valor de um plano de assinatura no Mercado Pago
MIN_PRECO = Decimal("0.50")
MAX_PRECO = Decimal("4000.00")
CHAVE_RE = re.compile(r"^[a-z0-9_]{2,50}$")
MP_ID_RE = re.compile(r"^[0-9a-f]{32}$")

MP_API = "https://api.mercadopago.com"
# O Mercado Pago limita as consultas (HTTP 429). Fazemos UMA consulta para todos os planos e
# guardamos o resultado por alguns minutos, em vez de uma consulta por plano a cada abertura da página.
_MP_CACHE = {"at": 0.0, "plans": None}
_MP_CACHE_TTL = 300


# ==========================
# SCHEMAS
# ==========================
class PlanoCreate(BaseModel):
    nome: str
    chave: str
    preco_mensal: float
    sessoes_mensais: int
    valor_repassado_terapeuta: float = 50
    descricao: Optional[str] = None
    mp_plan_id: Optional[str] = None
    ativo: bool = True
    validade_meses: int = 1
    acumula_proximo_mes: bool = False


class PlanoUpdate(BaseModel):
    chave: str
    nome: Optional[str] = None
    preco_mensal: Optional[float] = None
    sessoes_mensais: Optional[int] = None
    valor_repassado_terapeuta: Optional[float] = None
    descricao: Optional[str] = None
    mp_plan_id: Optional[str] = None
    ativo: Optional[bool] = None
    validade_meses: Optional[int] = None
    acumula_proximo_mes: Optional[bool] = None


class ToggleStatus(BaseModel):
    chave: str
    ativo: bool


# ==========================
# HELPERS
# ==========================
def _money(value, campo: str) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail=f"{campo} inválido")


def _validar(preco: Decimal, sessoes: int, repasse: Decimal) -> None:
    if preco < MIN_PRECO or preco > MAX_PRECO:
        raise HTTPException(
            status_code=400,
            detail=f"O preço deve estar entre R$ {MIN_PRECO} e R$ {MAX_PRECO} (limites do Mercado Pago)",
        )
    if sessoes < 1 or sessoes > 50:
        raise HTTPException(status_code=400, detail="As sessões por mês devem ficar entre 1 e 50")
    if repasse < 0:
        raise HTTPException(status_code=400, detail="O valor do terapeuta não pode ser negativo")
    if repasse * sessoes > preco:
        raise HTTPException(
            status_code=400,
            detail=f"O repasse total aos terapeutas (R$ {repasse * sessoes}) é maior que o preço do plano (R$ {preco})",
        )


def _mp_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip().lower()
    if not v:
        return None
    if not MP_ID_RE.match(v):
        raise HTTPException(status_code=400, detail="ID do plano no Mercado Pago inválido (32 caracteres, letras a-f e números)")
    return v


def _validar_validade(meses: int) -> int:
    if meses is None or meses < 1 or meses > 12:
        raise HTTPException(status_code=400, detail="A validade dos créditos deve ficar entre 1 e 12 meses")
    return int(meses)


def _extras(db: Session) -> dict:
    """Validade e acúmulo ficam em colunas lidas direto do banco (o modelo ORM do plano não as declara)."""
    rows = db.execute(text("SELECT id, validade_meses, acumula_proximo_mes FROM patient_plans")).all()
    return {r.id: {"validade_meses": int(r.validade_meses), "acumula_proximo_mes": bool(r.acumula_proximo_mes)} for r in rows}


def _gravar_extras(db: Session, plano_id: int, validade: Optional[int], acumula: Optional[bool]) -> None:
    if validade is not None:
        db.execute(text("UPDATE patient_plans SET validade_meses = :v WHERE id = :i"), {"v": validade, "i": plano_id})
    if acumula is not None:
        db.execute(text("UPDATE patient_plans SET acumula_proximo_mes = :a WHERE id = :i"), {"a": acumula, "i": plano_id})
    db.commit()


def _out(p: PatientPlan, extra: Optional[dict] = None) -> dict:
    extra = extra or {"validade_meses": 1, "acumula_proximo_mes": False}
    preco = Decimal(p.preco_mensal)
    repasse = Decimal(p.valor_repassado_terapeuta)
    return {
        "id": p.id,
        "nome": p.nome,
        "chave": p.chave,
        "preco_mensal": float(preco),
        "sessoes_mensais": p.sessoes_mensais,
        "valor_repassado_terapeuta": float(repasse),
        # receita da plataforma por assinante, antes das taxas do Mercado Pago
        "receita_por_assinante": float(preco - repasse * p.sessoes_mensais),
        "descricao": p.descricao,
        "mp_plan_id": p.mp_plan_id,
        "ativo": bool(p.ativo),
        "validade_meses": extra["validade_meses"],
        "acumula_proximo_mes": extra["acumula_proximo_mes"],
    }


def _get_plano(db: Session, chave: str) -> PatientPlan:
    plano = db.query(PatientPlan).filter(PatientPlan.chave == (chave or "").strip().lower()).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return plano


# ==========================
# ENDPOINTS
# ==========================
@router.get("")
def listar_planos(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    """Lista todos os planos (ativos e inativos)"""
    planos = db.query(PatientPlan).order_by(PatientPlan.sessoes_mensais, PatientPlan.preco_mensal).all()
    extras = _extras(db)
    return [_out(p, extras.get(p.id)) for p in planos]


@router.post("/add")
def adicionar_plano(
    body: PlanoCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    chave = body.chave.strip().lower()
    nome = body.nome.strip()
    if not CHAVE_RE.match(chave):
        raise HTTPException(status_code=400, detail="Identificador inválido: use 2 a 50 letras minúsculas, números ou _")
    if not nome or len(nome) > 100:
        raise HTTPException(status_code=400, detail="Nome obrigatório (até 100 caracteres)")
    if db.query(PatientPlan).filter(PatientPlan.chave == chave).first():
        raise HTTPException(status_code=400, detail=f"Já existe um plano com o identificador '{chave}'")

    preco = _money(body.preco_mensal, "Preço")
    repasse = _money(body.valor_repassado_terapeuta, "Valor do terapeuta")
    _validar(preco, body.sessoes_mensais, repasse)
    validade = _validar_validade(body.validade_meses)

    plano = PatientPlan(
        nome=nome,
        chave=chave,
        preco_mensal=preco,
        sessoes_mensais=body.sessoes_mensais,
        valor_repassado_terapeuta=repasse,
        descricao=(body.descricao or "").strip() or None,
        mp_plan_id=_mp_id(body.mp_plan_id),
        ativo=body.ativo,
    )
    db.add(plano)
    db.commit()
    db.refresh(plano)
    _gravar_extras(db, plano.id, validade, body.acumula_proximo_mes)
    print(f"📦 [ADMIN] usuário {current_user.id} criou o plano de paciente {chave}")
    return _out(plano, _extras(db).get(plano.id))


@router.post("/update")
def atualizar_plano(
    body: PlanoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    plano = _get_plano(db, body.chave)
    enviados = getattr(body, "model_fields_set", None)
    if enviados is None:
        enviados = getattr(body, "__fields_set__", set())

    preco = Decimal(plano.preco_mensal) if body.preco_mensal is None else _money(body.preco_mensal, "Preço")
    repasse = (
        Decimal(plano.valor_repassado_terapeuta)
        if body.valor_repassado_terapeuta is None
        else _money(body.valor_repassado_terapeuta, "Valor do terapeuta")
    )
    sessoes = plano.sessoes_mensais if body.sessoes_mensais is None else body.sessoes_mensais
    _validar(preco, sessoes, repasse)
    validade = None if body.validade_meses is None else _validar_validade(body.validade_meses)

    if body.nome is not None:
        nome = body.nome.strip()
        if not nome or len(nome) > 100:
            raise HTTPException(status_code=400, detail="Nome obrigatório (até 100 caracteres)")
        plano.nome = nome
    plano.preco_mensal = preco
    plano.sessoes_mensais = sessoes
    plano.valor_repassado_terapeuta = repasse
    if "descricao" in enviados:
        plano.descricao = (body.descricao or "").strip() or None
    if "mp_plan_id" in enviados:
        plano.mp_plan_id = _mp_id(body.mp_plan_id)
    if body.ativo is not None:
        plano.ativo = body.ativo

    db.commit()
    db.refresh(plano)
    _gravar_extras(db, plano.id, validade, body.acumula_proximo_mes)
    print(f"📦 [ADMIN] usuário {current_user.id} atualizou o plano de paciente {plano.chave}")
    return {
        "success": True,
        "message": f"Plano {plano.nome} atualizado. O novo valor já vale para novas assinaturas (cobradas pelo Asaas) e aparece em todas as telas.",
        "plano": _out(plano, _extras(db).get(plano.id)),
    }


@router.post("/toggle-status")
def alternar_status(
    body: ToggleStatus,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    plano = _get_plano(db, body.chave)
    plano.ativo = body.ativo
    db.commit()
    return {"success": True, "message": f"Plano {plano.nome} {'ativado' if body.ativo else 'desativado'}"}


def _mp_plans_snapshot(token: str, force: bool = False):
    """
    Devolve (planos_por_id, erro, desatualizado).
    Usa o cache quando está fresco. Se a consulta falhar (inclusive 429), devolve o último dado
    guardado (desatualizado=True) e o motivo do erro.
    """
    agora = time.time()
    if not force and _MP_CACHE["plans"] is not None and agora - _MP_CACHE["at"] < _MP_CACHE_TTL:
        return _MP_CACHE["plans"], None, False
    try:
        r = requests.get(
            f"{MP_API}/preapproval_plan/search",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except Exception as e:
        print(f"⚠️ billing-check: {e}")
        return _MP_CACHE["plans"], "indisponível", _MP_CACHE["plans"] is not None
    if not r.ok:
        print(f"⚠️ billing-check: Mercado Pago respondeu HTTP {r.status_code}")
        return _MP_CACHE["plans"], f"HTTP {r.status_code}", _MP_CACHE["plans"] is not None
    try:
        results = r.json().get("results", [])
    except ValueError:
        results = []
    planos = {p.get("id"): p for p in results if p.get("id")}
    _MP_CACHE["at"] = agora
    _MP_CACHE["plans"] = planos
    return planos, None, False


@router.get("/billing-check")
def conferir_mercado_pago(
    refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    """Mostra o que o Mercado Pago realmente cobra em cada plano vinculado (somente leitura)."""
    return {}  # asaas-precos: a cobranca e feita pelo Asaas com o preco salvo; nao comparamos mais com o Mercado Pago (so gerava alarme falso)
    token = os.getenv("MP_ACCESS_TOKEN", "")
    vinculados = db.query(PatientPlan).filter(PatientPlan.mp_plan_id.isnot(None)).all()
    if not vinculados:
        return {}

    planos, erro, desatualizado = _mp_plans_snapshot(token, force=refresh)
    resultado = {}
    for p in vinculados:
        info = {
            "mp_plan_id": p.mp_plan_id,
            "mp_status": None,
            "mp_price": None,
            "billing_day": None,
            "proportional": None,
            "free_trial": None,
            "back_url": None,
        }
        mp = (planos or {}).get(p.mp_plan_id)
        if mp:
            a = mp.get("auto_recurring") or {}
            info["mp_status"] = mp.get("status")
            info["mp_price"] = a.get("transaction_amount")
            info["billing_day"] = a.get("billing_day")
            info["proportional"] = a.get("billing_day_proportional")
            info["free_trial"] = a.get("free_trial") or None
            info["back_url"] = mp.get("back_url")
            if desatualizado:
                info["desatualizado"] = True
        elif erro:
            info["erro"] = erro
        else:
            info["erro"] = "não encontrado"
        resultado[p.chave] = info
    return resultado
