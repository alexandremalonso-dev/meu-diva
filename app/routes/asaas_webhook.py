"""
Recebe os webhooks do Asaas (assinaturas, cobrancas e checkout). Regras (da documentacao do Asaas):
  - entrega "at least once": o mesmo evento pode chegar mais de uma vez -> o id do evento e UNICO na tabela asaas_events;
  - persistir ANTES de responder 200 e NUNCA executar regra de negocio aqui (isso e feito por uma rotina a parte, em ordem);
  - validar o cabecalho asaas-access-token (token proprio do webhook, nunca a chave da API);
  - qualquer resposta que nao seja 2xx conta como falha e penaliza a fila: so recusamos o que MERECE recusa (token errado, corpo invalido).
"""
import hmac
import json
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db

router = APIRouter(prefix="/webhooks/asaas", tags=["asaas"])

LIMITE_CORPO = 256 * 1024
TOKENS = (("ASAAS_WEBHOOK_TOKEN", "production"), ("ASAAS_WEBHOOK_TOKEN_SANDBOX", "sandbox"))


def _ambiente_do_token(recebido: str):
    for nome, ambiente in TOKENS:
        esperado = os.getenv(nome, "")
        if esperado and recebido and hmac.compare_digest(recebido.encode("utf-8"), esperado.encode("utf-8")):
            return ambiente
    return None


@router.post("")
async def receber_webhook(request: Request, db: Session = Depends(get_db)):
    if not any(os.getenv(nome) for nome, _ in TOKENS):
        raise HTTPException(status_code=503, detail="webhook do Asaas nao configurado")
    ambiente = _ambiente_do_token(request.headers.get("asaas-access-token", ""))
    if ambiente is None:
        raise HTTPException(status_code=401, detail="token invalido")
    bruto = await request.body()
    if len(bruto) > LIMITE_CORPO:
        raise HTTPException(status_code=413, detail="corpo grande demais")
    try:
        corpo = json.loads(bruto.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="JSON invalido")
    if not isinstance(corpo, dict) or not corpo.get("id") or not corpo.get("event"):
        raise HTTPException(status_code=400, detail="evento sem id ou sem tipo")
    db.execute(
        text("INSERT INTO asaas_events (asaas_event_id, event, ambiente, payload) VALUES (:i, :e, :a, CAST(:p AS jsonb)) ON CONFLICT (asaas_event_id) DO NOTHING"),
        {"i": str(corpo["id"])[:250], "e": str(corpo["event"])[:100], "a": ambiente, "p": json.dumps(corpo, ensure_ascii=False)},
    )
    db.commit()
    print(f"[asaas-webhook] evento {str(corpo['event'])[:60]} recebido ({ambiente})")
    return {"received": True}
