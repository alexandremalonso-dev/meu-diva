"""
Assinatura com CARTAO digitado no nosso site, cobrada pelo ASAAS (POST /v3/subscriptions com creditCard + creditCardHolderInfo + remoteIp).
SEGURANCA DO CARTAO: numero, validade e CVV passam por aqui SO na memoria, a caminho do Asaas (HTTPS). NUNCA sao gravados, registrados em log, devolvidos em resposta ou
colocados em mensagem de erro. A validacao devolve mensagens fixas, sem repetir o que o cliente digitou. O Asaas guarda o cartao (token) para as cobrancas mensais.
REGRAS DO ASAAS: timeout minimo de 60 s e NUNCA repetir a criacao automaticamente (duplicaria a assinatura): depois de um timeout o pedido fica INCERTO e so o webhook (que traz
o nosso externalReference) o resolve; remoteIp e o IP do CLIENTE, nao o do servidor. Preco, teste gratis e travas de conflito sao os mesmos do checkout hospedado.
"""
import calendar
import os
import re
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import text

from app.services import asaas_checkout_service as base
from app.services import asaas_client as ac

BR = base.BR_TZ
MAX_TENTATIVAS_HORA = 5
MAX_RECUSAS_15MIN = 3
MINUTOS_EM_ANDAMENTO = 10
UFS = {"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"}
MSG_GENERICA = "Não foi possível concluir a assinatura agora. Tente novamente em instantes."
MSG_INCERTO = "Não conseguimos confirmar o resultado com o Asaas. NÃO tente de novo agora: se o pagamento tiver passado, seu plano é ativado automaticamente em alguns minutos e você recebe uma notificação."


def _digitos(s) -> str:
    return re.sub(r"\D", "", str(s if s is not None else ""))


def _luhn(n: str) -> bool:
    total, alt = 0, False
    for ch in reversed(n):
        d = int(ch)
        if alt:
            d *= 2
            d -= 9 if d > 9 else 0
        total += d
        alt = not alt
    return total % 10 == 0


def cpf_valido(raw) -> bool:
    d = _digitos(raw)
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for n in (9, 10):
        soma = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        r = (soma * 10) % 11
        if (0 if r == 10 else r) != int(d[n]):
            return False
    return True


def validar(dados) -> dict:
    """Valida e normaliza. As mensagens sao fixas: nunca repetem o que foi digitado."""
    def erro(m):
        raise HTTPException(status_code=400, detail=m)
    if not isinstance(dados, dict):
        erro("Requisição inválida.")
    cartao, titular = dados.get("cartao"), dados.get("titular")
    if not isinstance(cartao, dict) or not isinstance(titular, dict):
        erro("Preencha os dados do cartão e do titular.")
    nome = re.sub(r"\s+", " ", str(cartao.get("nome") or "")).strip()
    if not re.fullmatch(r"[A-Za-zÀ-ÿ'.\- ]{3,60}", nome) or len(nome.split(" ")) < 2:
        erro("Informe o nome no cartão (nome e sobrenome).")
    numero = _digitos(cartao.get("numero"))
    if not 13 <= len(numero) <= 19 or not _luhn(numero):
        erro("Número do cartão inválido.")
    m = re.fullmatch(r"\s*(\d{2})\s*/\s*(\d{2}|\d{4})\s*", str(cartao.get("validade") or ""))
    if not m or not 1 <= int(m.group(1)) <= 12:
        erro("Validade do cartão inválida.")
    mes, ano = int(m.group(1)), int(m.group(2)) + (2000 if len(m.group(2)) == 2 else 0)
    hoje = datetime.now(BR)
    if (ano, mes) < (hoje.year, hoje.month):
        erro("Cartão vencido.")
    ccv = _digitos(cartao.get("ccv"))
    if not 3 <= len(ccv) <= 4:
        erro("CVV inválido.")
    if not cpf_valido(titular.get("cpf")):
        erro("CPF inválido. Confira os números.")
    cep = _digitos(titular.get("cep"))
    if len(cep) != 8:
        erro("CEP inválido.")
    num_end = str(titular.get("numero") or "").strip()
    if not re.fullmatch(r"[0-9A-Za-z\-/ ]{1,10}", num_end):
        erro("Número do endereço inválido.")
    def livre(chave, minimo, maximo, msg, obrigatorio):
        bruto = titular.get(chave)
        if bruto is None or str(bruto).strip() == "":
            if obrigatorio:
                erro(msg)
            return ""
        s = re.sub(r"\s+", " ", str(bruto)).strip()
        if not minimo <= len(s) <= maximo or not re.fullmatch(r"[A-Za-zÀ-ÿ0-9 .,'ªº°\-/()#&]+", s):
            erro(msg)
        return s
    legado = "rua" not in titular  # clientes antigos (sem os campos de endereco completo) continuam aceitos: o Asaas so exige CEP e numero
    rua = livre("rua", 3, 120, "Informe a rua do endereço do titular.", not legado)
    bairro = livre("bairro", 2, 80, "Bairro inválido.", False)
    cidade = livre("cidade", 2, 80, "Informe a cidade do titular.", not legado)
    complemento = livre("complemento", 1, 60, "Complemento inválido.", False)
    uf = str(titular.get("uf") or "").strip().upper()
    if not legado and uf not in UFS:
        erro("Estado (UF) inválido.")
    cel = _digitos(titular.get("celular"))
    if len(cel) in (12, 13) and cel.startswith("55"):
        cel = cel[2:]
    if len(cel) not in (10, 11):
        erro("Celular inválido (informe com DDD).")
    tipo = str(dados.get("tipo") or "").strip().lower()
    if tipo not in ("terapeuta", "paciente"):
        erro("Tipo inválido.")
    return {"tipo": tipo, "plano": str(dados.get("plano") or "").strip().lower(), "nome": nome, "numero": numero, "mes": f"{mes:02d}", "ano": str(ano), "ccv": ccv,
            "cpf": _digitos(titular.get("cpf")), "cep": cep, "num_end": num_end, "celular": cel, "rua": rua, "bairro": bairro, "cidade": cidade, "uf": uf, "complemento": complemento}


def _mensagem_asaas(detalhe: str) -> str:
    d = (detalhe or "").strip()
    if d and len(d) <= 200 and "<oculto>" not in d and not re.search(r"\d{6,}", d):
        return d
    return "Não foi possível validar o cartão. Confira os dados ou use outro cartão."


def _gravar_falha(db, local_id, status, e, etapa):
    db.execute(text("UPDATE asaas_checkouts SET status = :s, erro = :e, atualizado_em = now() WHERE id = :i"), {"s": status, "e": f"{etapa}: {e} {e.detalhe}"[:500], "i": local_id})
    db.commit()
    print(f"[asaas-cartao] pedido {local_id} {status} ({etapa}): {e} {e.detalhe}")


def _finalizar(db, user, local_id, plano, tipo, amb, sub_id, cliente_id, prox):
    db.execute(text("INSERT INTO asaas_assinaturas (asaas_subscription_id, asaas_customer_id, user_id, tipo, plano, status, valor, proximo_vencimento, checkout_id, ambiente) "
                    "VALUES (:s, :c, :u, :t, :p, 'ACTIVE', :v, :n, :k, :a) ON CONFLICT (asaas_subscription_id) DO NOTHING"),
               {"s": sub_id, "c": cliente_id, "u": user.id, "t": tipo, "p": plano["plano"], "v": plano["valor"], "n": prox, "k": local_id, "a": amb})
    db.execute(text("UPDATE asaas_checkouts SET status = 'PAID', asaas_subscription_id = :s, asaas_customer_id = :c, atualizado_em = now() WHERE id = :i"), {"s": sub_id, "c": cliente_id, "i": local_id})
    db.execute(text("INSERT INTO asaas_clientes (user_id, asaas_customer_id, ambiente) VALUES (:u, :c, :a) ON CONFLICT (user_id, ambiente) DO UPDATE SET asaas_customer_id = :c"), {"u": user.id, "c": cliente_id, "a": amb})
    db.commit()


def assinar_com_cartao(db, user, dados, ip: str) -> dict:
    if not ac.configurado():
        raise HTTPException(status_code=503, detail="Pagamentos por assinatura indisponíveis no momento.")
    v = validar(dados)
    plano = base.resolver_plano(db, user, v["tipo"], v["plano"])
    substitui = base._conferir_conflitos(db, user, v["tipo"], plano["plano"])
    amb = ac.modo()
    # serializa cliques duplos do mesmo usuario e aplica os limites (protecao contra duplicidade e contra teste de cartoes)
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": 73000000 + int(user.id)})
    if db.execute(text("SELECT 1 FROM asaas_checkouts WHERE user_id = :u AND origem = 'cartao' AND status IN ('CRIANDO', 'INCERTO') AND criado_em > now() - make_interval(mins => :m)"), {"u": user.id, "m": MINUTOS_EM_ANDAMENTO}).first():
        db.rollback()
        raise HTTPException(status_code=409, detail="Estamos processando a sua assinatura. Aguarde alguns minutos e não tente de novo agora.")
    if db.execute(text("SELECT count(*) FROM asaas_checkouts WHERE user_id = :u AND origem = 'cartao' AND criado_em > now() - interval '1 hour'"), {"u": user.id}).scalar() >= MAX_TENTATIVAS_HORA:
        db.rollback()
        raise HTTPException(status_code=429, detail="Muitas tentativas em pouco tempo. Aguarde cerca de uma hora e confira os dados do cartão.")
    if db.execute(text("SELECT count(*) FROM asaas_checkouts WHERE user_id = :u AND origem = 'cartao' AND status = 'RECUSADO' AND criado_em > now() - interval '15 minutes'"), {"u": user.id}).scalar() >= MAX_RECUSAS_15MIN:
        db.rollback()
        raise HTTPException(status_code=429, detail="Várias recusas seguidas. Por segurança, aguarde 15 minutos e confira os dados do cartão.")
    local_id = db.execute(text("INSERT INTO asaas_checkouts (user_id, tipo, plano, valor, ambiente, status, origem, substitui_assinatura_id) VALUES (:u, :t, :p, :v, :a, 'CRIANDO', 'cartao', :s) RETURNING id"),
                          {"u": user.id, "t": v["tipo"], "p": plano["plano"], "v": plano["valor"], "a": amb, "s": substitui}).scalar()
    ref = f"md:{v['tipo']}:{user.id}:{plano['plano']}:{local_id}"
    db.execute(text("UPDATE asaas_checkouts SET external_reference = :r WHERE id = :i"), {"r": ref, "i": local_id})
    db.commit()
    trial = base.TRIAL_DIAS.get(plano["plano"], 0) if v["tipo"] == "terapeuta" else 0
    prox = (datetime.now(BR) + timedelta(days=trial)).date()
    etapa, sub_id, cliente_id = "cliente", None, None
    try:
        r = db.execute(text("SELECT asaas_customer_id FROM asaas_clientes WHERE user_id = :u AND ambiente = :a"), {"u": user.id, "a": amb}).first()
        cliente_id = r[0] if r else ac.chamar("POST", "/customers", {
            "name": getattr(user, "full_name", None) or v["nome"], "email": user.email, "cpfCnpj": v["cpf"], "postalCode": v["cep"], "addressNumber": v["num_end"],
            "mobilePhone": v["celular"], "notificationDisabled": True, "externalReference": f"md-user-{user.id}",
            **({"address": v["rua"]} if v["rua"] else {}), **({"complement": v["complemento"]} if v["complemento"] else {}), **({"province": v["bairro"]} if v["bairro"] else {})}, espera=int(os.getenv("ASAAS_ESPERA", "60")))["id"]
        etapa = "assinatura"
        resp = ac.chamar("POST", "/subscriptions", {
            "customer": cliente_id, "billingType": "CREDIT_CARD", "value": plano["valor"], "nextDueDate": prox.isoformat(), "cycle": "MONTHLY",
            "description": plano["nome"][:500], "externalReference": ref,
            "creditCard": {"holderName": v["nome"], "number": v["numero"], "expiryMonth": v["mes"], "expiryYear": v["ano"], "ccv": v["ccv"]},
            "creditCardHolderInfo": {"name": v["nome"], "email": user.email, "cpfCnpj": v["cpf"], "postalCode": v["cep"], "addressNumber": v["num_end"], "phone": v["celular"], "mobilePhone": v["celular"],
                                     **({"addressComplement": v["complemento"]} if v["complemento"] else {})},
            "remoteIp": ip}, espera=int(os.getenv("ASAAS_ESPERA", "60")))
        sub_id = str(resp.get("id") or "")
        if not sub_id:
            raise ac.AsaasErro("resposta sem id", 200)
    except ac.AsaasErro as e:
        v.pop("numero", None); v.pop("ccv", None)
        if e.status == 0 and etapa == "assinatura":
            try:  # o Asaas pode ter criado: procura pelo nosso externalReference (so leitura; nunca recria)
                lista = ac.chamar("GET", f"/subscriptions?externalReference={ref}&limit=1", espera=int(os.getenv("ASAAS_ESPERA", "60"))).get("data") or []
                if lista and lista[0].get("id"):
                    sub_id = str(lista[0]["id"])
            except ac.AsaasErro:
                pass
            if not sub_id:
                _gravar_falha(db, local_id, "INCERTO", e, etapa)
                raise HTTPException(status_code=504, detail=MSG_INCERTO)
        elif e.status in (400, 422):
            _gravar_falha(db, local_id, "RECUSADO" if etapa == "assinatura" else "ERRO", e, etapa)
            raise HTTPException(status_code=400, detail=_mensagem_asaas(e.detalhe) if etapa == "assinatura" else "Não foi possível validar os dados do titular. Confira o CPF, o CEP e o celular.")
        else:
            _gravar_falha(db, local_id, "ERRO", e, etapa)
            raise HTTPException(status_code=502, detail=MSG_GENERICA)
    _finalizar(db, user, local_id, plano, v["tipo"], amb, sub_id, cliente_id, prox)
    print(f"[asaas-cartao] pedido {local_id}: assinatura {sub_id} criada para o usuário {user.id} ({v['tipo']}/{plano['plano']})")
    return {"ok": True, "checkout_id": local_id, "teste_gratis_dias": trial, "primeira_cobranca": prox.isoformat()}
