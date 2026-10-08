"""
Pacotes de sessões do paciente.

Assinatura no Mercado Pago -> a cada COBRANÇA APROVADA entra um lote de sessões com validade.

Regras:
- O lote só nasce de uma cobrança aprovada (nunca pela simples criação da assinatura).
- Idempotente por cobrança: webhook repetido não duplica (mp_charge_id é único, e o mesmo
  pagamento com outro id também é reconhecido).
- O lote vale 1 mês a partir da aprovação; sessão não usada expira.
- O paciente só é identificado pelo external_reference "patient_<user_id>_plan_<chave>".
  Assinatura sem essa referência (por exemplo, feita por um link mpago.la) NÃO gera crédito:
  o admin é avisado por e-mail e pode conceder o crédito pela ferramenta manual.
- Todo pagamento aprovado que NÃO vira crédito gera um alerta por e-mail ao admin.
"""
import calendar
import html
import os
import re
import threading
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import text

REF_RE = re.compile(r"^patient_(\d+)_plan_([a-z0-9_]+)$")


def _parse_dt(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def add_months(dt: datetime, n: int) -> datetime:
    """Soma n meses mantendo o dia (em mês mais curto cai no último dia: 31/01 + 1 mês = 28/02)."""
    n = max(1, int(n or 1))
    total = dt.month - 1 + n
    year = dt.year + total // 12
    month = total % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def add_one_month(dt: datetime) -> datetime:
    return add_months(dt, 1)


def _extend_previous_lots(db, patient_user_id: int, plan_id: int, new_lot_id: int, new_valid_until) -> int:
    """
    Plano que ACUMULA: as sessões não usadas dos lotes anteriores (ainda válidos) do mesmo plano passam
    a valer até o fim do novo lote, em vez de expirar. Devolve quantos lotes foram estendidos.
    """
    r = db.execute(text(
        "UPDATE patient_session_lots SET valid_until = :vu "
        "WHERE patient_user_id = :u AND plan_id = :p AND id <> :n "
        "AND valid_until > now() AND valid_until < :vu"
    ), {"vu": new_valid_until, "u": patient_user_id, "p": plan_id, "n": new_lot_id})
    return r.rowcount or 0


# ==========================
# ALERTAS POR E-MAIL (em segundo plano: nunca atrasam nem derrubam o webhook)
# ==========================
def _send_alert(subject: str, corpo: str) -> bool:
    try:
        from app.services.email_service import email_service
        para = os.getenv("PAYMENT_ALERT_EMAIL") or "contato@meudivaonline.com"
        ok = bool(email_service._send_email(to_email=para, subject=subject, html_content=corpo))
        if not ok:
            print(f"⚠️ [PACOTE] o envio do alerta '{subject}' não foi confirmado")
        return ok
    except Exception as e:
        print(f"⚠️ [PACOTE] não foi possível enviar o alerta '{subject}': {e}")
        return False


def _notify_admin(subject: str, lines) -> None:
    try:
        corpo = (
            "<div style='font-family:Arial,sans-serif;max-width:560px'>"
            + "".join(f"<p style='color:#444;line-height:1.5'>{html.escape(str(l))}</p>" for l in lines)
            + "</div>"
        )
        threading.Thread(target=_send_alert, args=(subject, corpo), daemon=True).start()
    except Exception as e:
        print(f"⚠️ [PACOTE] falha ao preparar o alerta '{subject}': {e}")


def _approved(charge) -> bool:
    return bool(charge) and ((charge.get("payment") or {}).get("status") == "approved")


# ==========================
# EVENTOS DO MERCADO PAGO
# ==========================
def handle_patient_package_event(db, preapproval: dict, charge, mp_subscription_id: str) -> bool:
    """
    Trata um evento do Mercado Pago de um plano de PACIENTE.
    Retorna False se o plano não é de paciente (quem chamou segue o fluxo normal).
    Retorna True se o evento era de plano de paciente (tratado ou deliberadamente ignorado).
    Erros são propagados para quem chamou decidir (o webhook responde 500 para o MP reenviar).
    """
    mp_plan_id = (preapproval.get("preapproval_plan_id") or "").strip()
    if not mp_plan_id:
        return False

    plan = db.execute(
        text(
            "SELECT id, chave, nome, preco_mensal, sessoes_mensais, valor_repassado_terapeuta, "
            "validade_meses, acumula_proximo_mes FROM patient_plans WHERE mp_plan_id = :m"
        ),
        {"m": mp_plan_id},
    ).first()
    if not plan:
        return False

    # A partir daqui o evento é de plano de paciente: sempre devolve True.
    pagou = _approved(charge)
    ref = (preapproval.get("external_reference") or "").strip()
    m = REF_RE.match(ref)
    if not m:
        print(
            f"⚠️ [PACOTE] assinatura {mp_subscription_id} do plano {plan.chave} SEM identificação do paciente "
            f"(external_reference={ref!r}, payer_email={preapproval.get('payer_email')!r}). "
            f"Nenhum crédito foi gerado. Conferir manualmente."
        )
        if pagou:
            _notify_admin("⚠️ Pacote: pagamento aprovado SEM identificação do paciente", [
                f"Plano: {plan.nome}",
                f"Assinatura no Mercado Pago: {mp_subscription_id}",
                f"Cobrança: {charge.get('id')} (pagamento {(charge.get('payment') or {}).get('id')})",
                f"E-mail do pagador: {preapproval.get('payer_email')}",
                "Nenhum crédito foi gerado. Confira no painel do Mercado Pago e, se o pagamento é de um paciente, use a ferramenta de crédito manual.",
            ])
        return True

    user_id, chave_ref = int(m.group(1)), m.group(2)
    if chave_ref != plan.chave:
        print(f"⚠️ [PACOTE] referência {ref!r} não bate com o plano {plan.chave} da assinatura {mp_subscription_id}. Ignorado.")
        if pagou:
            _notify_admin("⚠️ Pacote: referência não confere com o plano", [
                f"Referência: {ref}", f"Plano da assinatura: {plan.chave}", f"Assinatura: {mp_subscription_id}",
                "Nenhum crédito foi gerado.",
            ])
        return True

    user = db.execute(text("SELECT id, email, role::text AS role FROM users WHERE id = :u"), {"u": user_id}).first()
    if not user or str(user.role).lower() != "patient":
        print(f"⚠️ [PACOTE] usuário {user_id} não é paciente (role={getattr(user, 'role', None)}). Ignorado.")
        if pagou:
            _notify_admin("⚠️ Pacote: pagamento de usuário que não é paciente", [
                f"Usuário: {user_id}", f"Plano: {plan.nome}", f"Assinatura: {mp_subscription_id}", "Nenhum crédito foi gerado.",
            ])
        return True

    now = datetime.now(timezone.utc)
    mp_status = preapproval.get("status") or "unknown"
    next_dt = _parse_dt(preapproval.get("next_payment_date"))

    db.execute(
        text(
            """
            INSERT INTO patient_plan_subscriptions (patient_user_id, plan_id, mp_subscription_id, status, current_period_end)
            VALUES (:u, :p, :s, :st, :ne)
            ON CONFLICT (mp_subscription_id) DO UPDATE
              SET status = :st,
                  current_period_end = COALESCE(:ne, patient_plan_subscriptions.current_period_end),
                  updated_at = now()
            """
        ),
        {"u": user_id, "p": plan.id, "s": mp_subscription_id, "st": mp_status, "ne": next_dt},
    )
    sub_id = db.execute(
        text("SELECT id FROM patient_plan_subscriptions WHERE mp_subscription_id = :s"),
        {"s": mp_subscription_id},
    ).scalar()

    if charge is None:
        db.commit()
        print(f"📦 [PACOTE] assinatura {mp_subscription_id} (paciente {user_id}, {plan.chave}): status={mp_status}")
        return True

    # ---- cobrança ----
    pay = charge.get("payment") or {}
    charge_id = str(charge.get("id") or "").strip()
    pay_status = pay.get("status")
    if not charge_id:
        db.commit()
        print(f"⚠️ [PACOTE] cobrança sem id na assinatura {mp_subscription_id}. Ignorada.")
        return True
    if pay_status != "approved":
        db.commit()
        print(f"💳 [PACOTE] cobrança {charge_id} do paciente {user_id}: pagamento={pay_status} (sem crédito)")
        return True

    try:
        amount = Decimal(str(charge.get("transaction_amount") or 0))
    except InvalidOperation:
        amount = Decimal("0")
    preco = Decimal(plan.preco_mensal)
    if amount + Decimal("0.01") < preco:
        db.commit()
        print(f"⚠️ [PACOTE] cobrança {charge_id}: valor {amount} menor que o plano {preco}. Sem crédito, conferir.")
        _notify_admin("⚠️ Pacote: cobrança aprovada com valor menor que o plano", [
            f"Paciente: {user.email} (id {user_id})", f"Plano: {plan.nome} (R$ {preco})", f"Valor cobrado: R$ {amount}",
            f"Cobrança: {charge_id}", "Nenhum crédito foi gerado.",
        ])
        return True

    # O mesmo pagamento pode chegar com outro id (cobrança x pagamento): reconhece os dois.
    pay_id = str(pay.get("id")) if pay.get("id") else None
    ids = [i for i in (charge_id, pay_id) if i]
    dup = db.execute(
        text("SELECT id FROM patient_session_lots WHERE mp_charge_id = ANY(:ids) OR mp_payment_id = ANY(:ids)"),
        {"ids": ids},
    ).first()
    if dup:
        db.commit()
        print(f"ℹ️ [PACOTE] cobrança {charge_id} já tinha lote {dup.id} (evento repetido ignorado)")
        return True

    valido_ate = add_months(now, plan.validade_meses)
    row = db.execute(
        text(
            """
            INSERT INTO patient_session_lots
              (patient_user_id, subscription_id, plan_id, sessions_total, payout_per_session,
               amount_paid, valid_from, valid_until, mp_charge_id, mp_payment_id)
            VALUES (:u, :sub, :p, :n, :pay, :amt, :vf, :vu, :c, :pid)
            ON CONFLICT (mp_charge_id) DO NOTHING
            RETURNING id
            """
        ),
        {
            "u": user_id, "sub": sub_id, "p": plan.id, "n": plan.sessoes_mensais,
            "pay": plan.valor_repassado_terapeuta, "amt": amount, "vf": now, "vu": valido_ate,
            "c": charge_id, "pid": pay_id,
        },
    ).first()
    estendidos = 0
    if row and plan.acumula_proximo_mes:
        estendidos = _extend_previous_lots(db, user_id, plan.id, row.id, valido_ate)
    db.commit()

    if row:
        print(f"🎟️ [PACOTE] lote {row.id} criado: paciente {user_id}, {plan.sessoes_mensais} sessão(ões) do {plan.chave}, cobrança {charge_id}"
              + (f" ({estendidos} lote(s) anterior(es) estendido(s): o plano acumula)" if estendidos else ""))
        _notify_admin(f"🎟️ Nova venda de pacote: {plan.nome}", [
            f"Paciente: {user.email} (id {user_id})",
            f"Pacote: {plan.nome}, {plan.sessoes_mensais} sessão(ões), R$ {amount}",
            f"Cobrança: {charge_id}",
            f"Lote {row.id}, válido até {valido_ate.strftime('%d/%m/%Y')}.",
        ])
    else:
        print(f"ℹ️ [PACOTE] cobrança {charge_id} já tinha lote (evento repetido ignorado)")
    return True


# ==========================
# CRÉDITO MANUAL (pagamento aprovado que não virou crédito)
# ==========================
def grant_lot_manually(db, patient_user_id: int, plan_chave: str, charge_id: str, amount=None, apply: bool = False) -> dict:
    """
    Cria o lote de uma cobrança que foi paga mas não virou crédito. Idempotente: se já existe lote
    para esse id (como id da cobrança ou do pagamento), não cria outro.
    Com apply=False só simula.
    """
    charge_id = (charge_id or "").strip()
    if not charge_id:
        return {"ok": False, "message": "Informe o ID da cobrança ou do pagamento no Mercado Pago.", "lot_id": None}

    plan = db.execute(text(
        "SELECT id, chave, nome, preco_mensal, sessoes_mensais, valor_repassado_terapeuta, validade_meses, acumula_proximo_mes FROM patient_plans WHERE chave = :c"
    ), {"c": (plan_chave or "").strip().lower()}).first()
    if not plan:
        return {"ok": False, "message": f"Plano '{plan_chave}' não existe.", "lot_id": None}

    user = db.execute(text("SELECT id, email, role::text AS role FROM users WHERE id = :u"), {"u": patient_user_id}).first()
    if not user or str(user.role).lower() != "patient":
        return {"ok": False, "message": f"O usuário {patient_user_id} não existe ou não é paciente.", "lot_id": None}

    dup = db.execute(text(
        "SELECT id FROM patient_session_lots WHERE mp_charge_id = :c OR mp_payment_id = :c"
    ), {"c": charge_id}).first()
    if dup:
        return {"ok": False, "message": f"Já existe o lote {dup.id} para esse ID. Nada a fazer.", "lot_id": dup.id}

    try:
        amt = Decimal(str(amount)) if amount is not None else Decimal(plan.preco_mensal)
    except InvalidOperation:
        return {"ok": False, "message": "Valor inválido.", "lot_id": None}

    now = datetime.now(timezone.utc)
    ate = add_months(now, plan.validade_meses)
    resumo = (f"{plan.sessoes_mensais} sessão(ões) do {plan.nome} para {user.email} (id {user.id}), "
              f"R$ {amt}, válidas até {ate.strftime('%d/%m/%Y')}")
    if not apply:
        return {"ok": True, "message": f"SIMULAÇÃO: criaria {resumo}. Use --apply para gravar.", "lot_id": None}

    sub_id = db.execute(text(
        "SELECT id FROM patient_plan_subscriptions WHERE patient_user_id = :u ORDER BY created_at DESC LIMIT 1"
    ), {"u": patient_user_id}).scalar()
    row = db.execute(text(
        """
        INSERT INTO patient_session_lots
          (patient_user_id, subscription_id, plan_id, sessions_total, payout_per_session,
           amount_paid, valid_from, valid_until, mp_charge_id, mp_payment_id)
        VALUES (:u, :sub, :p, :n, :pay, :amt, :vf, :vu, :c, :c)
        ON CONFLICT (mp_charge_id) DO NOTHING
        RETURNING id
        """
    ), {"u": patient_user_id, "sub": sub_id, "p": plan.id, "n": plan.sessoes_mensais,
        "pay": plan.valor_repassado_terapeuta, "amt": amt, "vf": now, "vu": ate, "c": charge_id}).first()
    if row and plan.acumula_proximo_mes:
        _extend_previous_lots(db, patient_user_id, plan.id, row.id, ate)
    db.commit()
    if not row:
        return {"ok": False, "message": "Já existia um lote para esse ID. Nada a fazer.", "lot_id": None}
    print(f"🎟️ [PACOTE] crédito MANUAL: lote {row.id}, {resumo}")
    _notify_admin("🎟️ Crédito manual de pacote", [f"Lote {row.id}: {resumo}", f"ID informado: {charge_id}"])
    return {"ok": True, "message": f"Lote {row.id} criado: {resumo}.", "lot_id": row.id}
