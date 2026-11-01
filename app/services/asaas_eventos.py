"""
Regras que transformam os eventos do Asaas (tabela asaas_events, processados EM ORDEM) em estado do Meu Diva.
  - terapeuta: plano ativo / em atraso / pausado / cancelado, na mesma tabela e com as mesmas regras do Mercado Pago (cancelamento agendado ate o fim do periodo, etc.)
  - paciente: assinatura do pacote e LOTE de sessoes a cada cobranca confirmada (mesmas regras de validade, acumulo e valor minimo do Mercado Pago)
Principios: (1) nada e creditado sem cobranca CONFIRMADA; PAYMENT_RECEIVED (32 dias depois no cartao) nunca credita de novo; (2) idempotente por pagamento;
(3) evento de SANDBOX so altera contas autorizadas (ASAAS_SANDBOX_USUARIOS); (4) pagamento que nao consegue ser ligado a um pedido gera ALERTA ao admin, nunca fica em silencio.
"""
import calendar
import json
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select, text

from app.services import asaas_client as ac

BR = timezone(timedelta(hours=-3))
NOMES = {"essencial": "Essencial", "profissional": "Profissional", "premium": "Premium", "basico": "Básico"}
COM_TESTE_GRATIS = {"essencial"}
JANELA_HORAS = 6
REF_RE = re.compile(r"^md:(terapeuta|paciente):(\d+):([a-z0-9_]+):(\d+)$")


def _hoje() -> date:
    return datetime.now(BR).date()


def _dia(s):
    try:
        return date.fromisoformat(str(s)[:10])
    except (ValueError, TypeError):
        return None


def _fim_do_dia(d: date) -> datetime:
    return datetime.combine(d, time(23, 59, 59))


def _mais_um_mes(d: date) -> date:
    y, m = d.year + d.month // 12, d.month % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def _valor(v) -> Decimal:
    try:
        return Decimal(str(v if v is not None else 0))
    except InvalidOperation:
        return Decimal("0")


def _alertar(db, assunto, linhas):
    db.execute(text("INSERT INTO asaas_alertas (assunto, linhas) VALUES (:a, CAST(:l AS jsonb))"), {"a": assunto[:200], "l": json.dumps([str(x) for x in linhas], ensure_ascii=False)})
    try:
        from app.services.patient_packages import _notify_admin
        _notify_admin(assunto, linhas)
    except Exception as e:
        print(f"⚠️ [ASAAS] falha ao enviar o alerta '{assunto}': {e}")


# ---------------------------------------------------------------- vínculo pedido <-> assinatura
CK = "id, user_id, tipo, plano, valor, ambiente, status, asaas_checkout_id, substitui_assinatura_id"


def _vinculo(db, sub_id):
    return db.execute(text("SELECT a.id, a.asaas_subscription_id, a.asaas_customer_id, a.user_id, a.tipo, a.plano, a.status, a.valor, a.ambiente, a.checkout_id, c.substitui_assinatura_id "
                           "FROM asaas_assinaturas a LEFT JOIN asaas_checkouts c ON c.id = a.checkout_id WHERE a.asaas_subscription_id = :s"), {"s": sub_id}).first()


def _ck_por_obj(db, amb, obj):
    """Acha o pedido por: id do checkout no objeto, ou externalReference 'md:<tipo>:<usuario>:<plano>:<id>'."""
    if not isinstance(obj, dict):
        return None
    for k in ("checkoutSession", "checkout"):
        v = obj.get(k)
        v = v.get("id") if isinstance(v, dict) else v
        if v:
            r = db.execute(text(f"SELECT {CK} FROM asaas_checkouts WHERE asaas_checkout_id = :c AND ambiente = :a"), {"c": str(v), "a": amb}).first()
            if r:
                return r
    m = REF_RE.match(str(obj.get("externalReference") or ""))
    if m:
        return db.execute(text(f"SELECT {CK} FROM asaas_checkouts WHERE id = :i AND user_id = :u AND ambiente = :a"), {"i": int(m.group(4)), "u": int(m.group(2)), "a": amb}).first()
    return None


def _ck_por_cliente(db, amb, cliente, valor, email=None):
    """Ultimo recurso: pedido recente, sem assinatura, do mesmo valor, do usuario dono deste cliente do Asaas (ou do e-mail dele). Ambiguidade => nao vincula."""
    uids = [r[0] for r in db.execute(text("SELECT user_id FROM asaas_clientes WHERE asaas_customer_id = :c AND ambiente = :a"), {"c": cliente, "a": amb}).all()]
    if not uids and email:
        uids = [r[0] for r in db.execute(text("SELECT id FROM users WHERE lower(email) = :e"), {"e": email.lower()}).all()]
    if not uids:
        return None
    cands = db.execute(text(f"SELECT {CK} FROM asaas_checkouts WHERE user_id = ANY(:u) AND ambiente = :a AND status IN ('ACTIVE', 'PAID', 'CRIANDO') AND asaas_subscription_id IS NULL "
                            "AND ABS(valor - :v) < 0.01 AND criado_em > now() - make_interval(hours => :h) ORDER BY id DESC"), {"u": uids, "a": amb, "v": valor, "h": JANELA_HORAS}).all()
    if cands and len({(c.user_id, c.tipo, c.plano) for c in cands}) == 1:
        return cands[0]
    return None


def _vincular(db, amb, sub_id, sub_obj=None, cliente=None, pay_obj=None):
    v = _vinculo(db, sub_id)
    if v:
        return v
    obj = dict(sub_obj or {})
    cliente = cliente or obj.get("customer") or (pay_obj or {}).get("customer")
    valor = obj.get("value") if obj.get("value") is not None else (pay_obj or {}).get("value")
    ck = _ck_por_obj(db, amb, obj) or _ck_por_obj(db, amb, pay_obj)
    if not ck and ac.configurado(amb):
        try:
            completo = ac.obter_assinatura(sub_id, ambiente=amb)
        except ac.AsaasErro as e:
            if e.status != 404:  # 404 = o Asaas nao conhece a assinatura (resposta definitiva); rede/5xx sobem e o evento e tentado de novo
                raise
            completo = {}
        obj = {**obj, **completo}
        cliente = cliente or completo.get("customer")
        valor = valor if valor is not None else completo.get("value")
        ck = _ck_por_obj(db, amb, completo)
    if not ck and cliente and valor is not None:
        ck = _ck_por_cliente(db, amb, cliente, valor)
        if not ck and ac.configurado(amb):
            try:
                email = (ac.obter_cliente(cliente, ambiente=amb).get("email") or "").strip()
            except ac.AsaasErro as e:
                if e.status != 404:
                    raise
                email = ""
            ck = _ck_por_cliente(db, amb, cliente, valor, email or None)
    if not ck:
        return None
    db.execute(text("INSERT INTO asaas_assinaturas (asaas_subscription_id, asaas_customer_id, user_id, tipo, plano, status, valor, proximo_vencimento, checkout_id, ambiente) "
                    "VALUES (:s, :c, :u, :t, :p, 'ACTIVE', :v, :n, :k, :a) ON CONFLICT (asaas_subscription_id) DO NOTHING"),
               {"s": sub_id, "c": cliente, "u": ck.user_id, "t": ck.tipo, "p": ck.plano, "v": ck.valor, "n": _dia(obj.get("nextDueDate")), "k": ck.id, "a": amb})
    db.execute(text("UPDATE asaas_checkouts SET asaas_subscription_id = :s, asaas_customer_id = COALESCE(:c, asaas_customer_id), status = CASE WHEN status IN ('ACTIVE', 'CRIANDO') THEN 'PAID' ELSE status END, atualizado_em = now() WHERE id = :k"),
               {"s": sub_id, "c": cliente, "k": ck.id})
    if cliente:
        db.execute(text("INSERT INTO asaas_clientes (user_id, asaas_customer_id, ambiente) VALUES (:u, :c, :a) ON CONFLICT (user_id, ambiente) DO UPDATE SET asaas_customer_id = :c"), {"u": ck.user_id, "c": cliente, "a": amb})
    return _vinculo(db, sub_id)


def _pode_aplicar(v) -> bool:
    return v.ambiente == "production" or ac.usuario_sandbox(v.user_id)


# ---------------------------------------------------------------- terapeuta
def _ativar_terapeuta(db, v, ini: datetime, fim: datetime, motivo: str):
    from app.models.subscription import Subscription
    from app.models.therapist_profile import TherapistProfile
    from app.models.user import User
    from app.services.notification_service import NotificationService
    perfil = db.execute(select(TherapistProfile).where(TherapistProfile.user_id == v.user_id)).scalar_one_or_none()
    user = db.get(User, v.user_id)
    if not perfil or not user:
        raise RuntimeError(f"perfil de terapeuta não encontrado para o usuário {v.user_id}")
    sub = db.execute(select(Subscription).where(Subscription.stripe_subscription_id == v.asaas_subscription_id)).scalar_one_or_none()
    if sub is None:
        sub = db.execute(select(Subscription).where(Subscription.therapist_id == perfil.id)).scalars().first()
        if sub is not None and getattr(sub, "payment_provider", None) == "apple_iap":
            sub = None
    if sub is not None and getattr(sub, "payment_provider", None) == "mercadopago" and sub.status in ("active", "past_due", "paused") and sub.plan != "basico" \
            and sub.stripe_subscription_id != v.asaas_subscription_id:
        _alertar(db, "⚠️ Terapeuta com assinatura do Mercado Pago ainda ativa assinou pelo Asaas", [
            f"Usuário {v.user_id}: plano {sub.plan} no Mercado Pago (assinatura {sub.stripe_subscription_id}) e novo plano {v.plano} no Asaas.",
            "A linha do terapeuta passou a apontar para o Asaas. CANCELE a assinatura antiga no Mercado Pago para não cobrar em dobro."])
    was_active = bool(sub and sub.status == "active" and sub.plan == v.plano and getattr(sub, "payment_provider", None) == "asaas")
    agora = datetime.now()
    if sub is None:
        sub = Subscription(therapist_id=perfil.id, plan=v.plano, status="active", stripe_subscription_id=v.asaas_subscription_id, current_period_start=ini, current_period_end=fim)
        db.add(sub)
    sub.status, sub.plan = "active", v.plano
    sub.stripe_subscription_id, sub.stripe_customer_id = v.asaas_subscription_id, v.asaas_customer_id
    sub.payment_provider = "asaas"
    sub.current_period_start, sub.current_period_end = ini, fim
    sub.cancel_at_period_end = False
    sub.updated_at = agora
    db.flush()
    _trocar_assinatura_antiga(db, v)
    if not was_active:
        try:
            NotificationService(db).notify_subscription_activated(user, NOMES.get(v.plano, v.plano))
        except Exception as e:
            print(f"⚠️ [ASAAS] notificação de ativação: {e}")
    print(f"✅ [ASAAS] terapeuta {v.user_id}: plano {v.plano} ativo até {fim:%d/%m/%Y} ({motivo})")


def _trocar_assinatura_antiga(db, v):
    """Troca de plano: depois que a nova assinatura vale, a anterior (Asaas) e cancelada la, para nao cobrar em dobro."""
    antiga = v.substitui_assinatura_id
    if not antiga or antiga == v.asaas_subscription_id:
        return
    amb = (db.execute(text("SELECT ambiente FROM asaas_assinaturas WHERE asaas_subscription_id = :s"), {"s": antiga}).scalar()) or v.ambiente
    try:
        ac.remover_assinatura(antiga, ambiente=amb)
    except ac.AsaasErro as e:
        if e.status != 404:
            _alertar(db, "⚠️ Troca de plano: não consegui cancelar a assinatura anterior no Asaas", [f"Usuário {v.user_id}", f"Assinatura anterior: {antiga}", f"Erro: {e} {e.detalhe}", "Cancele-a manualmente para não cobrar em dobro."])
            return
    db.execute(text("UPDATE asaas_assinaturas SET status = 'DELETED', atualizada_em = now() WHERE asaas_subscription_id = :s"), {"s": antiga})
    db.execute(text("UPDATE asaas_checkouts SET substitui_assinatura_id = NULL WHERE asaas_subscription_id = :s"), {"s": v.asaas_subscription_id})


# ---------------------------------------------------------------- paciente
def _plano_paciente(db, chave):
    return db.execute(text("SELECT id, chave, nome, preco_mensal, sessoes_mensais, valor_repassado_terapeuta, validade_meses, acumula_proximo_mes FROM patient_plans WHERE chave = :c"), {"c": chave}).first()


def _assinatura_paciente(db, v, plano, status, fim):
    db.execute(text("INSERT INTO patient_plan_subscriptions (patient_user_id, plan_id, mp_subscription_id, status, current_period_end, provider) VALUES (:u, :p, :s, :st, :f, 'asaas') "
                    "ON CONFLICT (mp_subscription_id) DO UPDATE SET status = :st, current_period_end = COALESCE(:f, patient_plan_subscriptions.current_period_end), updated_at = now()"),
               {"u": v.user_id, "p": plano.id, "s": v.asaas_subscription_id, "st": status, "f": _fim_do_dia(fim) if fim else None})
    return db.execute(text("SELECT id FROM patient_plan_subscriptions WHERE mp_subscription_id = :s"), {"s": v.asaas_subscription_id}).scalar()


def _creditar_pacote(db, v, pay, valor: Decimal, due: date):
    from app.services.patient_packages import _extend_previous_lots, _notify_admin, add_months
    plano = _plano_paciente(db, v.plano)
    if not plano:
        raise RuntimeError(f"plano de paciente '{v.plano}' não encontrado")
    sub_id = _assinatura_paciente(db, v, plano, "authorized", _mais_um_mes(due))
    if valor + Decimal("0.01") < Decimal(plano.preco_mensal):
        _alertar(db, "⚠️ Pacote: cobrança confirmada com valor menor que o plano", [f"Paciente {v.user_id}", f"Plano {plano.nome} (R$ {plano.preco_mensal})", f"Valor: R$ {valor}", f"Cobrança: {pay.get('id')}", "Nenhum crédito foi gerado."])
        return "valor menor que o plano: sem crédito (admin alertado)"
    pid = str(pay.get("id"))
    if db.execute(text("SELECT id FROM patient_session_lots WHERE mp_charge_id = :i OR mp_payment_id = :i"), {"i": pid}).first():
        return "cobrança já tinha lote (evento repetido)"
    agora = datetime.now(timezone.utc)
    ate = add_months(agora, plano.validade_meses)
    row = db.execute(text("INSERT INTO patient_session_lots (patient_user_id, subscription_id, plan_id, sessions_total, payout_per_session, amount_paid, valid_from, valid_until, mp_charge_id, mp_payment_id) "
                          "VALUES (:u, :sub, :p, :n, :pay, :amt, :vf, :vu, :c, :c) ON CONFLICT (mp_charge_id) DO NOTHING RETURNING id"),
                     {"u": v.user_id, "sub": sub_id, "p": plano.id, "n": plano.sessoes_mensais, "pay": plano.valor_repassado_terapeuta, "amt": valor, "vf": agora, "vu": ate, "c": pid}).first()
    if not row:
        return "cobrança já tinha lote (evento repetido)"
    if plano.acumula_proximo_mes:
        _extend_previous_lots(db, v.user_id, plano.id, row.id, ate)
    email = db.execute(text("SELECT email FROM users WHERE id = :u"), {"u": v.user_id}).scalar()
    _notify_admin(f"🎟️ Nova venda de pacote (Asaas): {plano.nome}", [f"Paciente: {email} (id {v.user_id})", f"Pacote: {plano.nome}, {plano.sessoes_mensais} sessão(ões), R$ {valor}", f"Cobrança: {pid}", f"Lote {row.id}, válido até {ate:%d/%m/%Y}."])
    print(f"🎟️ [ASAAS] lote {row.id}: paciente {v.user_id}, {plano.sessoes_mensais} sessão(ões) do {plano.chave}")
    return f"lote {row.id} criado: {plano.sessoes_mensais} sessão(ões) do {plano.nome}"


# ---------------------------------------------------------------- handlers
def h_checkout(db, amb, ev):
    ck = ev.get("checkout") or {}
    cid = str(ck.get("id") or "")
    novo = {"CHECKOUT_PAID": "PAID", "CHECKOUT_CANCELED": "CANCELED", "CHECKOUT_EXPIRED": "EXPIRED"}.get(ev.get("event"))
    if not cid or not novo:
        return "ignorado"
    r = db.execute(text("UPDATE asaas_checkouts SET status = :n, asaas_customer_id = COALESCE(:c, asaas_customer_id), atualizado_em = now() "
                        "WHERE asaas_checkout_id = :i AND ambiente = :a AND status <> 'PAID' AND (:n = 'PAID' OR status IN ('ACTIVE', 'CRIANDO')) RETURNING user_id"),
                   {"n": novo, "c": ck.get("customer"), "i": cid, "a": amb}).first()
    if not r:
        return "checkout desconhecido ou já encerrado"
    if novo == "PAID" and ck.get("customer"):
        db.execute(text("INSERT INTO asaas_clientes (user_id, asaas_customer_id, ambiente) VALUES (:u, :c, :a) ON CONFLICT (user_id, ambiente) DO UPDATE SET asaas_customer_id = :c"), {"u": r[0], "c": ck["customer"], "a": amb})
    return f"checkout {novo}"


def h_sub_criada(db, amb, ev):
    sub = ev.get("subscription") or {}
    sid = str(sub.get("id") or "")
    if not sid:
        return "sem id"
    v = _vincular(db, amb, sid, sub)
    if not v:
        _alertar(db, "⚠️ Assinatura criada no Asaas SEM pedido associado", [f"Assinatura: {sid} ({amb})", f"Cliente: {sub.get('customer')}", f"Valor: R$ {sub.get('value')}", "Confira no painel do Asaas. Para vincular: vincular_assinatura_asaas.py --assinatura ID --pedido N."])
        return "sem vínculo (admin alertado)"
    if not _pode_aplicar(v):
        return "sandbox de usuário não autorizado: nada alterado"
    prox = _dia(sub.get("nextDueDate"))
    db.execute(text("UPDATE asaas_assinaturas SET status = 'ACTIVE', proximo_vencimento = COALESCE(:n, proximo_vencimento), valor = COALESCE(:v, valor), atualizada_em = now() WHERE asaas_subscription_id = :s"), {"n": prox, "v": sub.get("value"), "s": sid})
    if v.tipo == "terapeuta" and v.plano in COM_TESTE_GRATIS and prox and prox > _hoje():
        _ativar_terapeuta(db, v, datetime.now(), _fim_do_dia(prox), "teste grátis")
        return f"teste grátis: plano {v.plano} ativo até {prox:%d/%m/%Y}"
    if v.tipo == "paciente":
        plano = _plano_paciente(db, v.plano)
        if plano:
            _assinatura_paciente(db, v, plano, "pending", prox)
    return "assinatura vinculada (aguardando a 1ª cobrança)"


def h_pagamento(db, amb, ev):
    pay = ev.get("payment") or {}
    pid, sid = str(pay.get("id") or ""), str(pay.get("subscription") or "")
    if not pid:
        return "sem id"
    if not sid:
        return "cobrança avulsa (sem assinatura): ignorada"
    v = _vincular(db, amb, sid, None, pay.get("customer"), pay)
    if not v:
        _alertar(db, "🚨 PAGAMENTO do Asaas SEM pedido associado (ninguém recebeu o plano)", [f"Cobrança {pid} da assinatura {sid} ({amb})", f"Valor: R$ {pay.get('value')}", f"Cliente: {pay.get('customer')}",
                                                                                            "Confira no painel do Asaas e vincule: vincular_assinatura_asaas.py --assinatura ID --pedido N."])
        return "sem vínculo (admin alertado)"
    if not _pode_aplicar(v):
        return "sandbox de usuário não autorizado: nada alterado"
    valor, due = _valor(pay.get("value")), _dia(pay.get("dueDate")) or _hoje()
    if not db.execute(text("INSERT INTO asaas_pagamentos (payment_id, asaas_subscription_id, user_id, tipo, valor, ambiente) VALUES (:p, :s, :u, :t, :v, :a) ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id"),
                      {"p": pid, "s": sid, "u": v.user_id, "t": v.tipo, "v": valor, "a": amb}).first():
        return "pagamento já tratado (CONFIRMED/RECEIVED repetido)"
    db.execute(text("UPDATE asaas_assinaturas SET status = 'ACTIVE', proximo_vencimento = :n, atualizada_em = now() WHERE asaas_subscription_id = :s"), {"n": _mais_um_mes(due), "s": sid})
    if v.tipo == "terapeuta":
        if valor + Decimal("0.01") < Decimal(str(v.valor or 0)):
            _alertar(db, "⚠️ Plano: cobrança confirmada com valor menor que o plano", [f"Usuário {v.user_id}", f"Plano {v.plano} (R$ {v.valor})", f"Valor: R$ {valor}", f"Cobrança {pid}", "O plano NÃO foi ativado."])
            return "valor menor que o plano: sem ativação (admin alertado)"
        fim = _fim_do_dia(_mais_um_mes(due))
        _ativar_terapeuta(db, v, datetime.combine(due, time(0, 0)), fim, "cobrança confirmada")
        return f"plano {v.plano} ativo até {fim:%d/%m/%Y}"
    return _creditar_pacote(db, v, pay, valor, due)


def h_vencida(db, amb, ev):
    pay = ev.get("payment") or {}
    v = _vinculo(db, str(pay.get("subscription") or ""))
    if not v or not _pode_aplicar(v):
        return "sem vínculo ou sandbox não autorizado: ignorado"
    if v.tipo == "terapeuta":
        n = db.execute(text("UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE stripe_subscription_id = :s AND payment_provider = 'asaas' AND status = 'active'"), {"s": v.asaas_subscription_id}).rowcount
        _alertar(db, "⚠️ Cobrança de plano vencida (Asaas)", [f"Usuário {v.user_id}, plano {v.plano}", f"Cobrança {pay.get('id')}, vencimento {pay.get('dueDate')}, R$ {pay.get('value')}"])
        return "plano marcado como em atraso" if n else "cobrança vencida (plano não estava ativo)"
    _alertar(db, "⚠️ Cobrança de pacote vencida (Asaas)", [f"Paciente {v.user_id}, plano {v.plano}", f"Cobrança {pay.get('id')}, vencimento {pay.get('dueDate')}"])
    return "cobrança de pacote vencida (admin alertado)"


def h_sub_inativada(db, amb, ev):
    sid = str((ev.get("subscription") or {}).get("id") or "")
    v = _vinculo(db, sid)
    if not v or not _pode_aplicar(v):
        return "sem vínculo ou sandbox não autorizado: ignorado"
    db.execute(text("UPDATE asaas_assinaturas SET status = 'INACTIVE', atualizada_em = now() WHERE asaas_subscription_id = :s"), {"s": sid})
    if v.tipo == "terapeuta":
        db.execute(text("UPDATE subscriptions SET status = 'paused', updated_at = now() WHERE stripe_subscription_id = :s AND payment_provider = 'asaas' AND status IN ('active', 'past_due')"), {"s": sid})
    else:
        db.execute(text("UPDATE patient_plan_subscriptions SET status = 'paused', updated_at = now() WHERE mp_subscription_id = :s AND provider = 'asaas' AND status IN ('authorized', 'pending')"), {"s": sid})
    return "assinatura pausada"


def h_sub_removida(db, amb, ev):
    sid = str((ev.get("subscription") or {}).get("id") or "")
    v = _vinculo(db, sid)
    if not v or not _pode_aplicar(v):
        return "sem vínculo ou sandbox não autorizado: ignorado"
    db.execute(text("UPDATE asaas_assinaturas SET status = 'DELETED', atualizada_em = now() WHERE asaas_subscription_id = :s"), {"s": sid})
    if v.tipo == "paciente":
        db.execute(text("UPDATE patient_plan_subscriptions SET status = 'cancelled', updated_at = now() WHERE mp_subscription_id = :s AND provider = 'asaas'"), {"s": sid})
        return "pacote cancelado (as sessões já pagas continuam valendo)"
    row = db.execute(text("SELECT id, cancel_at_period_end, current_period_end, plan FROM subscriptions WHERE stripe_subscription_id = :s AND payment_provider = 'asaas'"), {"s": sid}).first()
    if not row:
        return "plano não encontrado"
    if row.cancel_at_period_end and row.current_period_end and row.current_period_end > datetime.now():
        return f"cancelamento agendado mantido até {row.current_period_end:%d/%m/%Y}"
    db.execute(text("UPDATE subscriptions SET status = 'cancelled', plan = 'basico', cancel_at_period_end = FALSE, updated_at = now() WHERE id = :i"), {"i": row.id})
    try:
        from app.models.user import User
        from app.services.notification_service import NotificationService
        NotificationService(db).notify_subscription_cancelled(db.get(User, v.user_id), NOMES.get(row.plan, row.plan))
    except Exception as e:
        print(f"⚠️ [ASAAS] notificação de cancelamento: {e}")
    return "plano cancelado: terapeuta volta ao Básico"


def h_sub_atualizada(db, amb, ev):
    sub = ev.get("subscription") or {}
    db.execute(text("UPDATE asaas_assinaturas SET valor = COALESCE(:v, valor), proximo_vencimento = COALESCE(:n, proximo_vencimento), atualizada_em = now() WHERE asaas_subscription_id = :s"),
               {"v": sub.get("value"), "n": _dia(sub.get("nextDueDate")), "s": str(sub.get("id") or "")})
    return "assinatura sincronizada"


def h_alerta(db, amb, ev):
    pay = ev.get("payment") or {}
    v = _vinculo(db, str(pay.get("subscription") or "")) if pay.get("subscription") else None
    _alertar(db, f"⚠️ Asaas: {ev.get('event')}", [f"Cobrança {pay.get('id')} (R$ {pay.get('value')}), assinatura {pay.get('subscription')}, ambiente {amb}",
                                                   f"Usuário {v.user_id}, plano {v.plano} ({v.tipo})" if v else "Sem vínculo com um pedido nosso.", "Nenhuma alteração automática foi feita; avalie no painel do Asaas."])
    return "admin alertado"


HANDLERS = {"CHECKOUT_PAID": h_checkout, "CHECKOUT_CANCELED": h_checkout, "CHECKOUT_EXPIRED": h_checkout, "SUBSCRIPTION_CREATED": h_sub_criada, "SUBSCRIPTION_UPDATED": h_sub_atualizada,
            "SUBSCRIPTION_INACTIVATED": h_sub_inativada, "SUBSCRIPTION_DELETED": h_sub_removida, "PAYMENT_CONFIRMED": h_pagamento, "PAYMENT_RECEIVED": h_pagamento, "PAYMENT_OVERDUE": h_vencida,
            "PAYMENT_REFUNDED": h_alerta, "PAYMENT_CHARGEBACK_REQUESTED": h_alerta, "PAYMENT_CHARGEBACK_DISPUTE": h_alerta, "PAYMENT_REPROVED_BY_RISK_ANALYSIS": h_alerta, "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED": h_alerta}


def processar(db, evento: str, ambiente: str, payload: dict) -> str:
    h = HANDLERS.get(evento)
    return (h(db, ambiente, payload) if h else "tipo sem regra: apenas registrado") or "ok"
