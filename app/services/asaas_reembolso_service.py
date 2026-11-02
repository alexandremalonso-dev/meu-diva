"""
GARANTIA DE 7 DIAS do plano do TERAPEUTA (Asaas): reembolso INTEGRAL da PRIMEIRA cobranca, pedido pelo proprio terapeuta (botao em "Meu plano"), UMA vez por conta.
- Elegivel: a 1a cobranca confirmada do terapeuta (a compra) tem GARANTIA_DIAS dias ou menos, nao foi reembolsada e a conta ainda nao usou a garantia. Renovacoes e upgrades NAO entram.
- Reembolsar: estorna a cobranca no Asaas (POST /v3/payments/{id}/refund), cancela a(s) assinatura(s) la e devolve o terapeuta ao plano Basico NA HORA. O saldo do estorno sai da conta Asaas.
- A trava "uma vez por conta" e do BANCO (indice unico parcial): dois cliques ao mesmo tempo nunca estornam duas vezes. Falha do Asaas (HTTP 4xx/5xx) NAO consome a garantia; timeout consome (INCERTO) ate o aviso do Asaas esclarecer.
- O aviso do Asaas (PAYMENT_REFUNDED) de um reembolso NOSSO conclui o registro sem alertar o admin (handler h_estorno em asaas_eventos).
"""
import os
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.services import asaas_client as ac

BR = timezone(timedelta(hours=-3))
GARANTIA_DIAS = int(os.getenv("ASAAS_GARANTIA_DIAS", "7"))
CONSUMIDOS = ("INICIANDO", "PEDIDO", "PROCESSANDO", "CONCLUIDO", "INCERTO")
NOMES = {"essencial": "Essencial", "profissional": "Profissional", "premium": "Premium", "basico": "Básico"}


def _hoje() -> date:
    return datetime.now(BR).date()


def _dia(s):
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def _info(r) -> dict:
    return {"status": r.status, "valor": float(r.valor or 0), "pedido_em": r.criado_em.astimezone(BR).isoformat() if r.criado_em else None}


def avaliar(db, user, interno: bool = False) -> dict:
    """Situacao da garantia deste terapeuta. Publico: sem ids internos. interno=True: inclui _payment_id e _assinatura."""
    res = {"garantia_dias": GARANTIA_DIAS, "elegivel": False, "motivo": None, "reembolso": None}
    amb = ac.modo()
    u = db.execute(text("SELECT id, status, valor, criado_em FROM asaas_reembolsos WHERE user_id = :u ORDER BY id DESC LIMIT 1"), {"u": user.id}).first()
    if u and u.status in CONSUMIDOS:
        res.update(motivo="O reembolso da garantia já foi solicitado.", reembolso=_info(u))
        return res
    p = db.execute(text("SELECT payment_id, asaas_subscription_id, valor, criado_em FROM asaas_pagamentos WHERE user_id = :u AND tipo = 'terapeuta' AND ambiente = :a ORDER BY criado_em ASC LIMIT 1"), {"u": user.id, "a": amb}).first()
    if not p:
        res["motivo"] = "Não encontramos uma cobrança do seu plano para reembolsar."
        return res
    if (_hoje() - p.criado_em.astimezone(BR).date()).days > GARANTIA_DIAS + 2:  # atalho: nem consulta o Asaas
        res["motivo"] = f"O prazo da garantia de {GARANTIA_DIAS} dias já passou."
        return res
    try:
        pay = ac.obter_cobranca(p.payment_id, ambiente=amb)
    except ac.AsaasErro:
        res["motivo"] = "Não foi possível verificar a garantia agora. Tente novamente em instantes."
        return res
    st = str(pay.get("status") or "")
    if st.startswith("REFUND") or any(str(r.get("status")) in ("PENDING", "DONE") for r in (pay.get("refunds") or [])):
        res["motivo"] = "Esta cobrança já foi reembolsada."
        return res
    if st not in ("CONFIRMED", "RECEIVED"):
        res["motivo"] = "A cobrança do seu plano ainda não foi confirmada."
        return res
    quando = _dia(pay.get("confirmedDate") or pay.get("paymentDate") or pay.get("clientPaymentDate") or pay.get("dateCreated")) or p.criado_em.astimezone(BR).date()
    dias = (_hoje() - quando).days
    if dias > GARANTIA_DIAS:
        res["motivo"] = f"O prazo da garantia de {GARANTIA_DIAS} dias já passou."
        return res
    res.update(elegivel=True, valor=float(pay.get("value") or p.valor or 0), pago_em=quando.isoformat(), expira_em=(quando + timedelta(days=GARANTIA_DIAS)).isoformat(), dias_restantes=max(GARANTIA_DIAS - dias, 0))
    if interno:
        res.update(_payment_id=p.payment_id, _assinatura=p.asaas_subscription_id)
    return res


def _alerta(db, assunto, linhas):
    try:
        from app.services.asaas_eventos import _alertar
        _alertar(db, assunto, linhas)
        db.commit()
    except Exception as e:  # noqa: BLE001
        print(f"[garantia] não consegui alertar o admin: {e}")


def _encerrar_plano(db, user, sub_garantia):
    """Cancela as assinaturas Asaas do terapeuta (la e aqui) e o devolve ao Basico NA HORA. O dinheiro ja foi estornado: falha ao cancelar so alerta."""
    from app.services import asaas_gestao as gestao
    amb = ac.modo()
    subs = [r[0] for r in db.execute(text("SELECT asaas_subscription_id FROM asaas_assinaturas WHERE user_id = :u AND tipo = 'terapeuta' AND ambiente = :a AND status <> 'DELETED'"), {"u": user.id, "a": amb}).all()]
    if sub_garantia and sub_garantia not in subs:
        subs.append(sub_garantia)
    for sid in subs:
        try:
            gestao.cancelar_assinatura_asaas(db, sid)
        except HTTPException:
            _alerta(db, "⚠️ Garantia: reembolsei, mas NÃO consegui cancelar a assinatura no Asaas", [f"Usuário {user.id}, assinatura {sid}", "Cancele-a manualmente no painel do Asaas para não cobrar de novo."])
    plano = db.execute(text("SELECT s.plan FROM subscriptions s JOIN therapist_profiles tp ON tp.id = s.therapist_id WHERE tp.user_id = :u AND s.payment_provider = 'asaas' ORDER BY s.id DESC LIMIT 1"), {"u": user.id}).scalar()
    db.execute(text("UPDATE subscriptions s SET status = 'cancelled', plan = 'basico', cancel_at_period_end = FALSE, updated_at = now() FROM therapist_profiles tp WHERE s.therapist_id = tp.id AND tp.user_id = :u AND s.payment_provider = 'asaas'"), {"u": user.id})
    db.commit()
    try:
        from app.services.notification_service import NotificationService
        NotificationService(db).notify_subscription_cancelled(user, NOMES.get(plano, plano or "do seu plano"))
    except Exception as e:  # noqa: BLE001
        print(f"[garantia] notificação de cancelamento: {e}")


def reembolsar(db, user) -> dict:
    if not ac.configurado():
        raise HTTPException(status_code=503, detail="Reembolsos indisponíveis no momento.")
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": 74000000 + int(user.id)})
    a = avaliar(db, user, interno=True)
    if not a["elegivel"]:
        db.rollback()
        raise HTTPException(status_code=409, detail=a["motivo"] or "Reembolso indisponível.")
    amb = ac.modo()
    try:
        rid = db.execute(text("INSERT INTO asaas_reembolsos (user_id, payment_id, asaas_subscription_id, valor, ambiente, status, motivo) VALUES (:u, :p, :s, :v, :a, 'INICIANDO', 'garantia') RETURNING id"),
                         {"u": user.id, "p": a["_payment_id"], "s": a["_assinatura"], "v": a["valor"], "a": amb}).scalar()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="O reembolso da garantia já foi solicitado.")
    def marcar(status, erro=None):
        db.execute(text("UPDATE asaas_reembolsos SET status = :s, erro = :e, atualizado_em = now() WHERE id = :i"), {"s": status, "e": (erro or None) and str(erro)[:400], "i": rid})
        db.commit()
    try:
        ac.estornar_cobranca(a["_payment_id"], f"Garantia de {GARANTIA_DIAS} dias (pedido do usuário {user.id})", ambiente=amb, espera=int(os.getenv("ASAAS_ESPERA", "60")))
    except ac.AsaasErro as e:
        if e.status == 0:
            marcar("INCERTO", f"{e} {e.detalhe}")
            _alerta(db, "⚠️ Garantia: o pedido de reembolso ficou INCERTO (timeout do Asaas)", [f"Usuário {user.id}, cobrança {a['_payment_id']}, R$ {a['valor']}", "Confira no painel do Asaas se o estorno foi feito; o aviso de estorno conclui o registro sozinho."])
            raise HTTPException(status_code=504, detail="Não conseguimos confirmar o reembolso agora. NÃO tente de novo: nossa equipe confere e avisa você.")
        marcar("ERRO", f"{e} {e.detalhe}")
        _alerta(db, "⚠️ Garantia: o Asaas recusou o estorno", [f"Usuário {user.id}, cobrança {a['_payment_id']}, R$ {a['valor']}", f"Erro: {e} {e.detalhe}", "Se for saldo insuficiente na conta Asaas, deposite saldo e peça ao usuário para tentar de novo."])
        raise HTTPException(status_code=502, detail="Não foi possível pedir o reembolso agora. Tente novamente em instantes ou fale com a gente.")
    marcar("PEDIDO")
    _encerrar_plano(db, user, a["_assinatura"])
    _alerta(db, "💸 Garantia de 7 dias: reembolso pedido", [f"Usuário {user.id}, cobrança {a['_payment_id']}, R$ {a['valor']:.2f}", "Estorno pedido ao Asaas, assinatura cancelada e terapeuta devolvido ao Básico. O aviso de estorno conclui o registro."])
    return {"ok": True, "mensagem": "Reembolso solicitado. A devolução aparece na fatura do seu cartão em alguns dias úteis. Seu plano foi cancelado e você voltou ao plano Básico.",
            "reembolso": {"status": "PEDIDO", "valor": a["valor"]}}
