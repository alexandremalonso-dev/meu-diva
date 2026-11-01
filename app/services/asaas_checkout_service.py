"""
Abre o Checkout do Asaas (pagina hospedada) para ASSINATURAS do Meu Diva, um por compra. O cartao e digitado na pagina do Asaas, nunca aqui.
O pedido leva o usuario e o plano em externalReference ("md:<tipo>:<usuario>:<plano>:<id local>"), e o preco vem SEMPRE do nosso banco.
Esta etapa so ABRE o checkout; ativar plano e creditar sessoes a partir dos eventos e a etapa seguinte.
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import text

from app.services import asaas_client as ac

BR_TZ = timezone(timedelta(hours=-3))
TRIAL_DIAS = {"essencial": 7}
PLANOS_TERAPEUTA = {"essencial": ("Essencial", 19.90), "profissional": ("Profissional", 79.00), "premium": ("Premium", 149.00)}
MINUTOS_VALIDADE = 60
MAX_POR_HORA = 6
MSG_INDISPONIVEL = "Não foi possível abrir o pagamento agora. Tente novamente em instantes."


def _papel(user) -> str:
    r = getattr(user, "role", "")
    return str(getattr(r, "value", r)).lower()


def _front() -> str:
    return os.getenv("FRONTEND_URL", "https://app.meudivaonline.com").rstrip("/")


def resolver_plano(db, user, tipo: str, plano: str) -> dict:
    plano = (plano or "").strip().lower()
    if tipo == "terapeuta":
        if _papel(user) != "therapist":
            raise HTTPException(status_code=403, detail="Este plano é para terapeutas.")
        if plano not in PLANOS_TERAPEUTA:
            raise HTTPException(status_code=404, detail="Plano não encontrado.")
        nome, preco = PLANOS_TERAPEUTA[plano]
        r = db.execute(text("SELECT price_brl FROM plan_prices WHERE plan = :p"), {"p": plano}).first()
        if r and r[0] is not None:
            preco = float(r[0])
        return {"plano": plano, "nome": f"Plano {nome} — Meu Divã", "valor": preco}
    if tipo == "paciente":
        if _papel(user) != "patient":
            raise HTTPException(status_code=403, detail="Este plano é para pacientes.")
        try:
            from app.routes.patient_packages_routes import _has_access
            if not _has_access(user):
                raise HTTPException(status_code=403, detail="Os pacotes de sessões ainda não estão disponíveis.")
        except ImportError:
            pass
        r = db.execute(text("SELECT chave, nome, preco_mensal FROM patient_plans WHERE chave = :c AND ativo = TRUE"), {"c": plano}).first()
        if not r:
            raise HTTPException(status_code=404, detail="Pacote não encontrado ou indisponível.")
        return {"plano": r[0], "nome": f"{r[1]} — Meu Divã", "valor": float(r[2])}
    raise HTTPException(status_code=400, detail="Tipo inválido.")


def _conferir_conflitos(db, user, tipo: str, plano: str):
    """Evita cobranca em dobro. Devolve o id da assinatura do Asaas que esta compra vai substituir (troca de plano de terapeuta), se houver."""
    if tipo == "paciente":
        vivo = db.execute(text("SELECT 1 FROM patient_plan_subscriptions WHERE patient_user_id = :u AND status IN ('authorized', 'pending', 'paused') LIMIT 1"), {"u": user.id}).first()
        vivo2 = db.execute(text("SELECT 1 FROM asaas_assinaturas WHERE user_id = :u AND tipo = 'paciente' AND status = 'ACTIVE' LIMIT 1"), {"u": user.id}).first()
        if vivo or vivo2:
            raise HTTPException(status_code=409, detail="Você já tem um pacote ativo. Cancele-o antes de contratar outro.")
        return None
    atual = db.execute(text("SELECT s.plan, COALESCE(s.payment_provider::text, '') FROM subscriptions s JOIN therapist_profiles tp ON tp.id = s.therapist_id "
                            "WHERE tp.user_id = :u AND s.status::text = 'active' ORDER BY s.id DESC LIMIT 1"), {"u": user.id}).first()
    if atual and atual[0] == plano:
        raise HTTPException(status_code=409, detail="Você já está neste plano.")
    if atual and atual[0] not in ("basico", None) and atual[1] in ("mercadopago", "apple_iap"):
        raise HTTPException(status_code=409, detail="Você já tem uma assinatura ativa por outro meio de pagamento. Cancele-a antes ou fale com o nosso suporte.")
    sub = db.execute(text("SELECT asaas_subscription_id FROM asaas_assinaturas WHERE user_id = :u AND tipo = 'terapeuta' AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1"), {"u": user.id}).first()
    return sub[0] if sub else None


def montar_corpo(user, tipo: str, plano: dict, local_id, cliente_asaas=None, agora=None) -> dict:
    agora = agora or datetime.now(BR_TZ)
    trial = TRIAL_DIAS.get(plano["plano"], 0) if tipo == "terapeuta" else 0
    vence = agora + timedelta(days=trial)
    f = _front()
    corpo = {
        "billingTypes": ["CREDIT_CARD"], "chargeTypes": ["RECURRENT"], "minutesToExpire": MINUTOS_VALIDADE,
        "externalReference": f"md:{tipo}:{user.id}:{plano['plano']}:{local_id}",
        "callback": {"successUrl": f"{f}/assinatura/retorno?c={local_id}&r=sucesso", "cancelUrl": f"{f}/assinatura/retorno?c={local_id}&r=cancelado", "expiredUrl": f"{f}/assinatura/retorno?c={local_id}&r=expirado"},
        "items": [{"name": plano["nome"], "description": ("Assinatura mensal com %d dias de teste" % trial) if trial else "Assinatura mensal", "quantity": 1, "value": plano["valor"]}],
        "subscription": {"cycle": "MONTHLY", "nextDueDate": vence.strftime("%Y-%m-%d %H:%M:%S")},
    }
    anos = os.getenv("ASAAS_CHECKOUT_ENDDATE_ANOS", "").strip()
    if anos.isdigit() and int(anos) > 0:
        corpo["subscription"]["endDate"] = (vence + timedelta(days=365 * int(anos))).strftime("%Y-%m-%d %H:%M:%S")
    if cliente_asaas:
        corpo["customer"] = cliente_asaas
    elif getattr(user, "full_name", None) and getattr(user, "email", None):
        corpo["customerData"] = {"name": user.full_name, "email": user.email}
    return corpo


def criar_checkout(db, user, tipo: str, plano_pedido: str) -> dict:
    if not ac.configurado():
        raise HTTPException(status_code=503, detail="Pagamentos por assinatura indisponíveis no momento.")
    plano = resolver_plano(db, user, tipo, plano_pedido)
    substitui = _conferir_conflitos(db, user, tipo, plano["plano"])
    amb = ac.modo()
    recentes = db.execute(text("SELECT count(*) FROM asaas_checkouts WHERE user_id = :u AND criado_em > now() - interval '1 hour'"), {"u": user.id}).scalar()
    if recentes >= MAX_POR_HORA:
        raise HTTPException(status_code=429, detail="Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.")
    ja = db.execute(text("SELECT id, link, expira_em FROM asaas_checkouts WHERE user_id = :u AND tipo = :t AND plano = :p AND ambiente = :a AND status = 'ACTIVE' AND link IS NOT NULL "
                         "AND expira_em > now() + interval '10 minutes' ORDER BY id DESC LIMIT 1"), {"u": user.id, "t": tipo, "p": plano["plano"], "a": amb}).first()
    if ja:
        return {"url": ja[1], "checkout_id": ja[0], "expira_em": ja[2].isoformat() if ja[2] else None, "reaproveitado": True}
    cli = db.execute(text("SELECT asaas_customer_id FROM asaas_clientes WHERE user_id = :u AND ambiente = :a"), {"u": user.id, "a": amb}).first()
    local_id = db.execute(text("INSERT INTO asaas_checkouts (user_id, tipo, plano, valor, ambiente, status, substitui_assinatura_id, expira_em) VALUES (:u, :t, :p, :v, :a, 'CRIANDO', :s, now() + make_interval(mins => :m)) RETURNING id"),
                          {"u": user.id, "t": tipo, "p": plano["plano"], "v": plano["valor"], "a": amb, "s": substitui, "m": MINUTOS_VALIDADE}).scalar()
    db.commit()
    corpo = montar_corpo(user, tipo, plano, local_id, cli[0] if cli else None)
    try:
        resp = ac.criar_checkout(corpo)
        cid = str(resp.get("id") or "")
        link = resp.get("link") or (f"https://asaas.com/checkoutSession/show?id={cid}" if amb == "production" else f"https://sandbox.asaas.com/checkoutSession/show/{cid}")
        if not cid:
            raise ac.AsaasErro("resposta sem id", 200)
    except ac.AsaasErro as e:
        db.execute(text("UPDATE asaas_checkouts SET status = 'ERRO', erro = :e, atualizado_em = now() WHERE id = :i"), {"e": f"{e} {e.detalhe}"[:500], "i": local_id})
        db.commit()
        print(f"[asaas] checkout {local_id} falhou: {e} {e.detalhe}")
        raise HTTPException(status_code=502, detail=MSG_INDISPONIVEL)
    db.execute(text("UPDATE asaas_checkouts SET asaas_checkout_id = :c, link = :l, external_reference = :x, status = 'ACTIVE', atualizado_em = now() WHERE id = :i"),
               {"c": cid, "l": link, "x": corpo["externalReference"], "i": local_id})
    antigos = db.execute(text("UPDATE asaas_checkouts SET status = 'SUBSTITUIDO', atualizado_em = now() WHERE user_id = :u AND tipo = :t AND ambiente = :a AND status = 'ACTIVE' AND id <> :i RETURNING asaas_checkout_id"),
                         {"u": user.id, "t": tipo, "a": amb, "i": local_id}).all()
    db.commit()
    for (antigo,) in antigos:
        try:
            if antigo:
                ac.cancelar_checkout(antigo)
        except ac.AsaasErro:
            pass
    exp = db.execute(text("SELECT expira_em FROM asaas_checkouts WHERE id = :i"), {"i": local_id}).scalar()
    return {"url": link, "checkout_id": local_id, "expira_em": exp.isoformat() if exp else None, "reaproveitado": False}


def status_checkout(db, user, local_id: int) -> dict:
    r = db.execute(text("SELECT status, tipo, plano FROM asaas_checkouts WHERE id = :i AND user_id = :u"), {"i": local_id, "u": user.id}).first()
    if not r:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    ativo = db.execute(text("SELECT 1 FROM asaas_assinaturas WHERE checkout_id = :i AND status = 'ACTIVE' LIMIT 1"), {"i": local_id}).first() is not None
    return {"status": r[0], "tipo": r[1], "plano": r[2], "ativo": ativo}
