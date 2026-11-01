"""
Pagamento de SESSAO AVULSA pelo ASAAS: cartao digitado no nosso site (POST /v3/payments com creditCard) e Pix (cobranca PIX + QR Code).
A CONFIRMACAO do agendamento reaproveita a funcao que ja existia (payments._confirm_appointment_after_payment): credita a carteira, confirma a sessao, gera a sala, envia os e-mails e
registra a comissao. Ela e chamada por UM unico caminho (confirmar_sessao), protegido contra repeticao, tanto pela resposta imediata do cartao quanto pelo aviso do Asaas (webhook).
SEGURANCA DO CARTAO: igual a assinatura (asaas_cartao_service): nunca gravado, logado ou devolvido; mensagens fixas; nunca recria uma cobranca depois de timeout (so consulta).
"""
import os
import re
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select, text

from app.services import asaas_cartao_service as cartao
from app.services import asaas_checkout_service as base
from app.services import asaas_client as ac

BR = base.BR_TZ
MINIMO = 5.00  # valor minimo de cobranca do Asaas
REF_RE = re.compile(r"^md:sessao:(\d+):(\d+)$")
APROVADO = ("CONFIRMED", "RECEIVED")


def _modelos():
    from app.core.appointment_status import AppointmentStatus
    from app.models.appointment import Appointment
    from app.models.payment import Payment
    from app.models.wallet import Wallet
    return AppointmentStatus, Appointment, Payment, Wallet


def _carregar(db, user, payment_id):
    """Devolve (pagamento, agendamento, ja_pago). Pagamento de outra pessoa = 404 (nao revela que existe)."""
    AS, Ap, Pay, _ = _modelos()
    try:
        pid = int(payment_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Pagamento inválido.")
    p = db.get(Pay, pid)
    if not p or p.user_id != user.id:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    if str(p.status) == "paid":
        return p, None, True
    if str(p.status) != "pending":
        raise HTTPException(status_code=409, detail="Este pagamento não está mais disponível. Volte e escolha o horário de novo.")
    ap = db.get(Ap, int(p.appointment_id)) if p.appointment_id else None
    if not ap or ap.status not in (AS.scheduled, AS.proposed):
        raise HTTPException(status_code=409, detail="Este horário não está mais disponível. Volte e escolha o horário de novo.")
    return p, ap, False


def _valor_a_cobrar(db, p):
    v = round(float(p.amount), 2)
    if v < MINIMO:  # o Asaas nao cobra menos que R$ 5,00: cobra o minimo e a diferenca fica de saldo na carteira
        p.amount = MINIMO
        db.commit()
        return MINIMO, True
    return v, False


def _hoje():
    return datetime.now(BR).date()


def _iso(s):
    s = str(s or "").strip()
    return (s.replace(" ", "T") + "-03:00") if re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", s) else (s or None)


def _travar(db, user, origem, valor, amb, ref, max_hora, max_recusas=None):
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": 73000000 + int(user.id)})
    if db.execute(text("SELECT 1 FROM asaas_checkouts WHERE user_id = :u AND origem = :o AND status IN ('CRIANDO', 'INCERTO') AND criado_em > now() - make_interval(mins => 10)"), {"u": user.id, "o": origem}).first():
        db.rollback()
        raise HTTPException(status_code=409, detail="Estamos processando o seu pagamento. Aguarde alguns minutos e não tente de novo agora.")
    if db.execute(text("SELECT count(*) FROM asaas_checkouts WHERE user_id = :u AND origem = :o AND criado_em > now() - interval '1 hour'"), {"u": user.id, "o": origem}).scalar() >= max_hora:
        db.rollback()
        raise HTTPException(status_code=429, detail="Muitas tentativas em pouco tempo. Aguarde cerca de uma hora e confira os dados.")
    if max_recusas and db.execute(text("SELECT count(*) FROM asaas_checkouts WHERE user_id = :u AND origem = :o AND status = 'RECUSADO' AND criado_em > now() - interval '15 minutes'"), {"u": user.id, "o": origem}).scalar() >= max_recusas:
        db.rollback()
        raise HTTPException(status_code=429, detail="Várias recusas seguidas. Por segurança, aguarde 15 minutos e confira os dados do cartão.")
    lid = db.execute(text("INSERT INTO asaas_checkouts (user_id, tipo, plano, valor, ambiente, status, origem, external_reference) VALUES (:u, 'paciente', 'sessao', :v, :a, 'CRIANDO', :o, :r) RETURNING id"),
                     {"u": user.id, "v": valor, "a": amb, "o": origem, "r": ref}).scalar()
    db.commit()
    return lid


def _marcar(db, lid, status, e=None, etapa=""):
    db.execute(text("UPDATE asaas_checkouts SET status = :s, erro = :e, atualizado_em = now() WHERE id = :i"), {"s": status, "e": (f"{etapa}: {e} {e.detalhe}"[:500] if e else None), "i": lid})
    db.commit()
    if e:
        print(f"[asaas-sessao] pedido {lid} {status} ({etapa}): {e} {e.detalhe}")


def _cliente(db, user, amb, nome, cpf, extra=None):
    r = db.execute(text("SELECT asaas_customer_id FROM asaas_clientes WHERE user_id = :u AND ambiente = :a"), {"u": user.id, "a": amb}).first()
    if r:
        return r[0]
    corpo = {"name": getattr(user, "full_name", None) or nome or str(user.email).split("@")[0], "email": user.email, "cpfCnpj": cpf, "notificationDisabled": True, "externalReference": f"md-user-{user.id}", **(extra or {})}
    cid = ac.chamar("POST", "/customers", corpo, espera=int(os.getenv("ASAAS_ESPERA", "60")))["id"]
    db.execute(text("INSERT INTO asaas_clientes (user_id, asaas_customer_id, ambiente) VALUES (:u, :c, :a) ON CONFLICT (user_id, ambiente) DO UPDATE SET asaas_customer_id = :c"), {"u": user.id, "c": cid, "a": amb})
    db.commit()
    return cid


def confirmar_sessao(db, payment_id, user_id, asaas_pay_id, valor, ambiente, forma) -> str:
    """UNICO caminho que confirma o pagamento da sessao (resposta do cartao e webhook passam por aqui). Idempotente."""
    from app.services.asaas_eventos import _alertar
    _, _, Pay, W = _modelos()
    if ambiente == "sandbox" and not ac.usuario_sandbox(user_id):
        return "sandbox de usuário não autorizado: nada alterado"
    p = db.execute(select(Pay).where(Pay.id == int(payment_id)).with_for_update()).scalar_one_or_none()
    if not p:
        return "pagamento local não encontrado"
    if p.user_id != int(user_id):
        _alertar(db, "🚨 Pagamento de sessão do Asaas com usuário diferente do pedido", [f"Cobrança {asaas_pay_id}", f"Pagamento local {payment_id}: dono {p.user_id}, referência do usuário {user_id}"])
        return "usuário diferente (admin alertado)"
    if str(p.status) == "paid":
        return "pagamento já estava pago (evento repetido)"
    if abs(float(p.amount) - float(valor)) > 0.01:
        _alertar(db, "🚨 Pagamento de sessão do Asaas com valor diferente do pedido", [f"Cobrança {asaas_pay_id}: R$ {valor}", f"Pagamento local {payment_id}: R$ {p.amount}", "A sessão NÃO foi confirmada."])
        return "valor diferente (admin alertado)"
    if not db.execute(text("INSERT INTO asaas_pagamentos (payment_id, user_id, tipo, valor, ambiente) VALUES (:p, :u, 'sessao', :v, :a) ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id"),
                      {"p": str(asaas_pay_id), "u": int(user_id), "v": valor, "a": ambiente}).first():
        return "pagamento já tratado (repetido)"
    wallet = db.get(W, p.wallet_id)
    if not wallet:
        raise RuntimeError(f"carteira {p.wallet_id} não encontrada")
    p.payment_method = "asaas_cartao" if forma == "cartao" else "asaas_pix"
    p.meta_data = {**(p.meta_data or {}), "asaas_payment_id": str(asaas_pay_id), "asaas_ambiente": ambiente}
    from app.routes.payments import _confirm_appointment_after_payment
    _confirm_appointment_after_payment(p, wallet, str(asaas_pay_id), "Asaas", db)
    return f"sessão confirmada (pagamento {p.id}, {forma})"


def pagar_com_cartao(db, user, dados, ip: str) -> dict:
    if not ac.configurado():
        raise HTTPException(status_code=503, detail="Pagamentos indisponíveis no momento.")
    v = cartao.validar(dados if isinstance(dados, dict) else {}, exigir_plano=False)
    p, ap, ja_pago = _carregar(db, user, (dados or {}).get("payment_id"))
    if ja_pago:
        return {"status": "approved", "detail": "Pagamento já processado", "payment_id": p.id}
    valor, ajustado = _valor_a_cobrar(db, p)
    amb = ac.modo()
    ref = f"md:sessao:{user.id}:{p.id}"
    lid = _travar(db, user, "sessao_cartao", valor, amb, ref, cartao.MAX_TENTATIVAS_HORA, cartao.MAX_RECUSAS_15MIN)
    etapa, pay_id, status_asaas = "cliente", None, None
    try:
        cliente = _cliente(db, user, amb, v["nome"], v["cpf"], {"postalCode": v["cep"], "addressNumber": v["num_end"], "mobilePhone": v["celular"],
                                                                **({"address": v["rua"]} if v["rua"] else {}), **({"complement": v["complemento"]} if v["complemento"] else {}), **({"province": v["bairro"]} if v["bairro"] else {})})
        etapa = "cobranca"
        resp = ac.criar_cobranca({
            "customer": cliente, "billingType": "CREDIT_CARD", "value": valor, "dueDate": _hoje().isoformat(), "description": f"Sessão #{p.appointment_id} — Meu Divã"[:500], "externalReference": ref,
            "creditCard": {"holderName": v["nome"], "number": v["numero"], "expiryMonth": v["mes"], "expiryYear": v["ano"], "ccv": v["ccv"]},
            "creditCardHolderInfo": {"name": v["nome"], "email": user.email, "cpfCnpj": v["cpf"], "postalCode": v["cep"], "addressNumber": v["num_end"], "phone": v["celular"], "mobilePhone": v["celular"],
                                     **({"addressComplement": v["complemento"]} if v["complemento"] else {})},
            "remoteIp": ip}, espera=int(os.getenv("ASAAS_ESPERA", "60")))
        pay_id, status_asaas = str(resp.get("id") or ""), str(resp.get("status") or "")
        if not pay_id:
            raise ac.AsaasErro("resposta sem id", 200)
    except ac.AsaasErro as e:
        if e.status == 0 and etapa == "cobranca":
            try:  # o Asaas pode ter criado: so consulta (nunca recria)
                achadas = [x for x in ac.buscar_cobrancas_por_referencia(ref) if x.get("billingType") == "CREDIT_CARD"]
                if achadas:
                    pay_id, status_asaas = str(achadas[0].get("id")), str(achadas[0].get("status"))
            except ac.AsaasErro:
                pass
            if not pay_id:
                _marcar(db, lid, "INCERTO", e, etapa)
                raise HTTPException(status_code=504, detail=cartao.MSG_INCERTO)
        elif e.status in (400, 422) and etapa == "cobranca":
            _marcar(db, lid, "RECUSADO", e, etapa)
            return {"status": "rejected", "detail": cartao._mensagem_asaas(e.detalhe)}
        elif e.status in (400, 422):
            _marcar(db, lid, "ERRO", e, etapa)
            raise HTTPException(status_code=400, detail="Não foi possível validar os dados do titular. Confira o CPF, o CEP e o celular.")
        else:
            _marcar(db, lid, "ERRO", e, etapa)
            raise HTTPException(status_code=502, detail=cartao.MSG_GENERICA)
    if status_asaas in APROVADO:
        _marcar(db, lid, "PAID")
        confirmar_sessao(db, p.id, user.id, pay_id, valor, amb, "cartao")
        return {"status": "approved", "payment_id": p.id, "asaas_payment_id": pay_id, **({"ajuste_minimo": True} if ajustado else {})}
    _marcar(db, lid, "EM_ANALISE")
    print(f"[asaas-sessao] pedido {lid}: cobrança {pay_id} com status {status_asaas}; o aviso do Asaas confirma")
    return {"status": "pending", "payment_id": p.id, "asaas_payment_id": pay_id}


def gerar_pix(db, user, dados, ip: str) -> dict:
    if not ac.configurado():
        raise HTTPException(status_code=503, detail="Pagamentos indisponíveis no momento.")
    dados = dados if isinstance(dados, dict) else {}
    cpf = re.sub(r"\D", "", str(dados.get("payer_cpf") or dados.get("cpf") or ""))
    if not cartao.cpf_valido(cpf):
        raise HTTPException(status_code=400, detail="CPF inválido. Confira os números.")
    p, ap, ja_pago = _carregar(db, user, dados.get("payment_id"))
    if ja_pago:
        return {"status": "approved", "detail": "Pagamento já processado", "payment_id": p.id}
    valor, ajustado = _valor_a_cobrar(db, p)
    amb = ac.modo()
    ref = f"md:sessao:{user.id}:{p.id}"

    def resposta(pix_id, qr):
        return {"status": "pending", "payment_id": p.id, "asaas_payment_id": pix_id, "qr_code": qr.get("payload", ""), "qr_code_base64": qr.get("encodedImage", ""), "amount": valor, "expires_at": _iso(qr.get("expirationDate"))}
    antigo = (p.meta_data or {}).get("asaas_pix") or {}
    try:  # reaproveita o Pix que ja existe para este pagamento (mesmo valor e ambiente): nada de cobrancas duplicadas
        if antigo.get("id") and antigo.get("amb") == amb and abs(float(antigo.get("valor", 0)) - valor) < 0.01:
            return resposta(antigo["id"], ac.obter_pix(antigo["id"]))
        for x in ac.buscar_cobrancas_por_referencia(ref):
            if x.get("billingType") == "PIX" and x.get("status") == "PENDING" and abs(float(x.get("value", 0)) - valor) < 0.01:
                return resposta(str(x["id"]), ac.obter_pix(str(x["id"])))
    except ac.AsaasErro:
        pass
    lid = _travar(db, user, "sessao_pix", valor, amb, ref, 8)
    etapa = "cliente"
    try:
        cliente = _cliente(db, user, amb, None, cpf)
        etapa = "cobranca"
        resp = ac.criar_cobranca({"customer": cliente, "billingType": "PIX", "value": valor, "dueDate": _hoje().isoformat(), "description": f"Sessão #{p.appointment_id} — Meu Divã"[:500], "externalReference": ref},
                                 espera=int(os.getenv("ASAAS_ESPERA", "60")))
        pix_id = str(resp.get("id") or "")
        if not pix_id:
            raise ac.AsaasErro("resposta sem id", 200)
        qr = ac.obter_pix(pix_id)
    except ac.AsaasErro as e:
        if e.status == 0 and etapa == "cobranca":
            _marcar(db, lid, "INCERTO", e, etapa)
            raise HTTPException(status_code=504, detail="Não conseguimos gerar o Pix agora. Aguarde um minuto e tente de novo.")
        _marcar(db, lid, "ERRO", e, etapa)
        raise HTTPException(status_code=400 if e.status in (400, 422) else 502, detail="Não foi possível gerar o Pix. Confira o CPF e tente novamente." if e.status in (400, 422) else cartao.MSG_GENERICA)
    _marcar(db, lid, "PIX_GERADO")
    p.meta_data = {**(p.meta_data or {}), "asaas_pix": {"id": pix_id, "valor": valor, "amb": amb, "expira": qr.get("expirationDate")}}
    db.commit()
    return {**resposta(pix_id, qr), **({"ajuste_minimo": True} if ajustado else {})}
