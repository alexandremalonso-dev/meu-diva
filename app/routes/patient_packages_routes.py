import os
import re
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
from app.services.patient_packages import _parse_dt

router = APIRouter(prefix="/patient/pacotes", tags=["Pacotes do paciente"])

MP_API = "https://api.mercadopago.com"
LIVE_STATUSES = ("authorized", "pending", "paused")


# ==========================
# ACESSO (ligado por padrão para todos os pacientes)
# ==========================
def _flag_on() -> bool:
    """A venda de pacotes vem LIGADA para todos os pacientes. Só deixa de valer se o .env tiver PACOTES_VENDA_ATIVA=false."""
    return os.getenv("PACOTES_VENDA_ATIVA", "true").strip().lower() in ("1", "true", "yes", "sim")


def _preview_ids() -> set:
    """PACOTES_PREVIEW_USER_IDS=18,25 libera só para essas contas, mesmo com o interruptor desligado."""
    ids = set()
    for p in os.getenv("PACOTES_PREVIEW_USER_IDS", "").split(","):
        p = p.strip()
        if p.isdigit():
            ids.add(int(p))
    return ids


def _has_access(user) -> bool:
    return _flag_on() or user.id in _preview_ids()


# ==========================
# SCHEMAS
# ==========================
try:  # pydantic 2
    from pydantic import model_validator as _model_validator
    _PYD_V2 = True
except ImportError:  # pydantic 1
    from pydantic import root_validator as _root_validator
    _PYD_V2 = False


class SubscribeBody(BaseModel):
    plan: str = ""
    plan_key: Optional[str] = None  # nome que a tela do celular enviava; vira "plan" no validador abaixo
    card_token_id: str
    payer_cpf: str
    device_id: Optional[str] = ""

    if _PYD_V2:
        @_model_validator(mode="before")
        @classmethod
        def _plan_key_vira_plan(cls, dados):
            if isinstance(dados, dict) and not dados.get("plan") and dados.get("plan_key"):
                dados = {**dados, "plan": dados["plan_key"]}
            return dados
    else:
        @_root_validator(pre=True)
        def _plan_key_vira_plan(cls, valores):
            if not valores.get("plan") and valores.get("plan_key"):
                valores = {**valores, "plan": valores["plan_key"]}
            return valores


# ==========================
# CONSULTAS
# ==========================
@router.get("/config")
def config(current_user: User = Security(require_roles([UserRole.patient]))):
    return {"visible": _has_access(current_user)}


@router.get("/plans")
def listar_planos(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient])),
):
    """Planos à venda. NÃO expõe o valor repassado ao terapeuta (dado interno)."""
    if not _has_access(current_user):
        return {"visible": False, "plans": []}
    rows = db.execute(text(
        "SELECT chave, nome, preco_mensal, sessoes_mensais, descricao, validade_meses, acumula_proximo_mes FROM patient_plans "
        "WHERE ativo = TRUE AND mp_plan_id IS NOT NULL ORDER BY sessoes_mensais, preco_mensal"
    )).all()
    return {
        "visible": True,
        "plans": [
            {
                "chave": r.chave,
                "nome": r.nome,
                "preco_mensal": float(r.preco_mensal),
                "sessoes_mensais": int(r.sessoes_mensais),
                "validade_meses": int(r.validade_meses),
                "acumula_proximo_mes": bool(r.acumula_proximo_mes),
                "descricao": r.descricao,
            }
            for r in rows
        ],
    }


@router.get("/me")
def meu_pacote(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient])),
):
    if not _has_access(current_user):
        return {"visible": False, "subscription": None, "lots": [], "sessions_remaining": 0, "next_expiry": None}

    sub = db.execute(text(
        """
        SELECT s.status, s.current_period_end, p.chave, p.nome, p.preco_mensal, p.sessoes_mensais
        FROM patient_plan_subscriptions s JOIN patient_plans p ON p.id = s.plan_id
        WHERE s.patient_user_id = :u
        ORDER BY (s.status IN ('authorized','pending','paused')) DESC, s.created_at DESC
        LIMIT 1
        """
    ), {"u": current_user.id}).first()

    lots = db.execute(text(
        """
        SELECT l.id, l.sessions_total, l.valid_until, pl.nome,
               (SELECT count(*) FROM patient_session_uses u JOIN appointments a ON a.id = u.appointment_id WHERE u.lot_id = l.id AND a.status::text NOT IN ('cancelled_by_patient','cancelled_by_therapist','cancelled_by_admin','declined')) AS used
        FROM patient_session_lots l JOIN patient_plans pl ON pl.id = l.plan_id
        WHERE l.patient_user_id = :u AND l.valid_until > now()
        ORDER BY l.valid_until
        """
    ), {"u": current_user.id}).all()

    lot_list = []
    remaining_total = 0
    next_expiry = None
    for l in lots:
        remaining = max(0, int(l.sessions_total) - int(l.used))
        remaining_total += remaining
        if remaining > 0 and next_expiry is None:
            next_expiry = l.valid_until.isoformat()
        lot_list.append({
            "id": l.id,
            "plano_nome": l.nome,
            "sessions_total": int(l.sessions_total),
            "used": int(l.used),
            "remaining": remaining,
            "valid_until": l.valid_until.isoformat(),
        })

    return {
        "visible": True,
        "subscription": None if not sub else {
            "status": sub.status,
            "plano_chave": sub.chave,
            "plano_nome": sub.nome,
            "preco_mensal": float(sub.preco_mensal),
            "sessoes_mensais": int(sub.sessoes_mensais),
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "can_cancel": sub.status in LIVE_STATUSES,
        },
        "lots": lot_list,
        "sessions_remaining": remaining_total,
        "next_expiry": next_expiry,
    }


# ==========================
# ASSINAR
# ==========================
@router.post("/subscribe")
def assinar(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient])),
):
    if not _has_access(current_user):
        raise HTTPException(status_code=403, detail="Os pacotes de sessões ainda não estão disponíveis.")

    chave = (body.plan or "").strip().lower()
    token_id = (body.card_token_id or "").strip()
    cpf = re.sub(r"\D", "", body.payer_cpf or "")
    device_id = (body.device_id or "").strip()
    if device_id and not re.fullmatch(r"[A-Za-z0-9_.\-]{1,512}", device_id):
        device_id = ""

    if not token_id:
        raise HTTPException(status_code=400, detail="card_token_id é obrigatório.")
    if len(cpf) != 11:
        raise HTTPException(status_code=400, detail="CPF inválido.")

    plan = db.execute(text(
        "SELECT id, chave, nome, preco_mensal, mp_plan_id FROM patient_plans "
        "WHERE chave = :c AND ativo = TRUE AND mp_plan_id IS NOT NULL"
    ), {"c": chave}).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Pacote não encontrado ou indisponível.")

    # Evita cobrança dupla: quem já tem pacote vivo precisa cancelar antes de contratar outro
    vivo = db.execute(text(
        "SELECT 1 FROM patient_plan_subscriptions WHERE patient_user_id = :u AND status IN ('authorized','pending','paused') LIMIT 1"
    ), {"u": current_user.id}).first()
    if vivo:
        raise HTTPException(status_code=409, detail="Você já tem um pacote ativo. Cancele-o antes de contratar outro.")

    mp_token = os.getenv("MP_ACCESS_TOKEN", "")
    if not mp_token:
        raise HTTPException(status_code=503, detail="Mercado Pago não configurado.")

    payer_email = (current_user.email or "").strip()
    payload = {
        "preapproval_plan_id": plan.mp_plan_id,
        "reason": f"{plan.nome} — Meu Divã",
        "external_reference": f"patient_{current_user.id}_plan_{plan.chave}",
        "payer_email": payer_email,
        "card_token_id": token_id,
        "back_url": f"{os.getenv('FRONTEND_URL', 'https://app.meudivaonline.com')}/patient/dashboard?pacote=ok",
        "status": "authorized",
    }
    headers = {"Authorization": f"Bearer {mp_token}", "Content-Type": "application/json"}
    if device_id:
        headers["X-meli-session-id"] = device_id

    print(
        f"📦 [PACOTE] Criando assinatura - paciente {current_user.id} - plano {plan.chave} - "
        f"device_id={'sim' if device_id else 'nao'} - email={'sim' if payer_email else 'nao'}"
    )

    try:
        resp = requests.post(f"{MP_API}/preapproval", headers=headers, json=payload, timeout=30)
    except Exception as e:
        print(f"❌ [PACOTE] falha de rede com o Mercado Pago: {e}")
        raise HTTPException(status_code=502, detail="Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes.")

    try:
        data = resp.json()
    except ValueError:
        data = {}
    if not resp.ok:
        print(f"📦 [PACOTE] MP erro HTTP {resp.status_code}: {str(data)[:500]}")

    mp_status = data.get("status")
    mp_id = data.get("id")
    mp_msg = data.get("message", "")
    print(f"📦 [PACOTE] MP: status={mp_status} | id={mp_id} | erro={mp_msg}")

    if mp_status not in ("authorized", "pending") or not mp_id:
        if "CC_VAL" in str(mp_msg or ""):
            raise HTTPException(status_code=400, detail="O Mercado Pago não aprovou este cartão por segurança. Tente outro cartão ou escreva para contato@meudivaonline.com que ajudamos a concluir a contratação.")
        raise HTTPException(status_code=400, detail=f"Assinatura não aprovada: {mp_msg or mp_status or 'erro desconhecido'}")

    db.execute(text(
        """
        INSERT INTO patient_plan_subscriptions (patient_user_id, plan_id, mp_subscription_id, status, current_period_end)
        VALUES (:u, :p, :s, :st, :ne)
        ON CONFLICT (mp_subscription_id) DO UPDATE
          SET status = :st,
              current_period_end = COALESCE(:ne, patient_plan_subscriptions.current_period_end),
              updated_at = now()
        """
    ), {"u": current_user.id, "p": plan.id, "s": str(mp_id), "st": mp_status, "ne": _parse_dt(data.get("next_payment_date"))})
    db.commit()

    return {"status": mp_status, "mp_subscription_id": str(mp_id), "plano": plan.nome}


# ==========================
# CANCELAR
# ==========================
@router.post("/cancel")
def cancelar(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient])),
):
    sub = db.execute(text(
        "SELECT id, mp_subscription_id, provider FROM patient_plan_subscriptions "
        "WHERE patient_user_id = :u AND status IN ('authorized','pending','paused') "
        "ORDER BY created_at DESC LIMIT 1"
    ), {"u": current_user.id}).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Nenhum pacote ativo para cancelar.")

    # ASAAS-GESTAO: pacote assinado pelo Asaas e cancelado la (se nao confirmar, devolve erro e nada muda)
    if getattr(sub, "provider", "mercadopago") == "asaas":
        from app.services.asaas_gestao import cancelar_pacote_asaas
        return cancelar_pacote_asaas(db, current_user, sub)

    mp_token = os.getenv("MP_ACCESS_TOKEN", "")
    if not mp_token:
        raise HTTPException(status_code=503, detail="Mercado Pago não configurado.")

    erro = "Não foi possível cancelar agora no Mercado Pago. Tente de novo em instantes ou fale com a gente."
    try:
        resp = requests.put(
            f"{MP_API}/preapproval/{sub.mp_subscription_id}",
            headers={"Authorization": f"Bearer {mp_token}", "Content-Type": "application/json"},
            json={"status": "cancelled"},
            timeout=20,
        )
    except Exception as e:
        print(f"❌ [PACOTE] cancelamento: falha de rede: {e}")
        raise HTTPException(status_code=502, detail=erro)

    try:
        corpo = resp.json()
    except ValueError:
        corpo = {}
    confirmado = resp.ok and (corpo.get("status") in (None, "cancelled"))
    if not confirmado:
        print(f"⚠️ [PACOTE] O Mercado Pago NAO confirmou o cancelamento de {sub.mp_subscription_id}: HTTP {resp.status_code} {str(corpo)[:300]}")
        raise HTTPException(status_code=502, detail=erro)

    db.execute(text(
        "UPDATE patient_plan_subscriptions SET status = 'cancelled', updated_at = now() WHERE id = :i"
    ), {"i": sub.id})
    db.commit()

    ate = db.execute(text(
        "SELECT max(valid_until) FROM patient_session_lots WHERE patient_user_id = :u AND valid_until > now()"
    ), {"u": current_user.id}).scalar()
    print(f"🗓️ [PACOTE] assinatura {sub.mp_subscription_id} cancelada (paciente {current_user.id})")
    msg = "Pacote cancelado. Não haverá novas cobranças."
    if ate:
        msg += f" As sessões já pagas continuam valendo até {ate.strftime('%d/%m/%Y')}."
    return {"message": msg, "valid_until": ate.isoformat() if ate else None}
