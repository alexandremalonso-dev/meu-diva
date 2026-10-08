"""
Agendamento com crédito de pacote (plano do paciente) e repasse ao terapeuta.

Segue a lógica do plano empresa, com as regras do fluxo normal de agendamento:
- usa o crédito quando o paciente tem lote válido E o terapeuta aceita sessões corporativas
  (accepts_corporate_sessions). Caso contrário devolve None e o fluxo normal (pagamento) segue.
- a consulta nasce CONFIRMADA (o crédito é o pagamento), com Jitsi, e-mails e notificações.
  Por nascer confirmada, o débito de carteira do endpoint de status nunca se aplica a ela.
- o saldo é calculado pelo STATUS das consultas (cancelada devolve o crédito) e o lote é
  travado na gravação, então duas marcações simultâneas não gastam o mesmo crédito.
- o repasse ao terapeuta (valor fixo do plano) é registrado quando a sessão é concluída ou o
  paciente falta, por uma rotina horária que olha o status (não depende de endpoint).
- se algo inesperado der errado, devolve None e o fluxo normal segue (nunca um erro 500 por causa do pacote).
"""
import traceback
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import select, and_, text
from sqlalchemy.exc import IntegrityError

BR_TZ = timezone(timedelta(hours=-3))

# Cancelada ou recusada devolve o crédito; qualquer outro status continua consumindo.
NAO_CONSUMIDOS_SQL = "('cancelled_by_patient','cancelled_by_therapist','cancelled_by_admin','declined')"


def try_book_with_package(payload, request, db, current_user):
    """
    Devolve o dicionário da consulta (como o fluxo normal) quando agendou com crédito,
    ou None quando não se aplica (o chamador segue o fluxo normal).
    HTTPException (horário indisponível, conflito) é propagada.
    """
    try:
        return _try_book(payload, request, db, current_user)
    except HTTPException:
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"❌ [PACOTE] erro inesperado no agendamento com crédito (segue o fluxo normal): {e}")
        traceback.print_exc()
        return None


def _try_book(payload, request, db, current_user):
    from app.models.appointment import Appointment
    from app.models.therapist_profile import TherapistProfile
    from app.models.availability import AvailabilityPeriod, AvailabilitySlot
    from app.models.appointment_event import AppointmentEvent
    from app.core.appointment_event_type import AppointmentEventType
    from app.core.appointment_status import AppointmentStatus

    # 1) o paciente tem algum lote válido? (consulta barata: quem não tem segue o fluxo normal)
    tem_lote = db.execute(text(
        "SELECT 1 FROM patient_session_lots "
        "WHERE patient_user_id = :u AND valid_from <= now() AND valid_until > now() LIMIT 1"
    ), {"u": current_user.id}).first()
    if not tem_lote:
        return None
    if payload.therapist_user_id == current_user.id:
        return None

    # 2) o terapeuta aceita sessões corporativas (a mesma regra do plano empresa)?
    # A flag é lida direto da coluna do banco: o modelo ORM do terapeuta não a declara.
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == payload.therapist_user_id)
    ).scalar_one_or_none()
    aceita = db.execute(
        text("SELECT accepts_corporate_sessions FROM therapist_profiles WHERE user_id = :t"),
        {"t": payload.therapist_user_id},
    ).scalar()
    if not therapist_profile or not aceita:
        return None

    # 3) mesmas validações de horário do fluxo normal
    starts_at = payload.starts_at
    ends_at = payload.ends_at
    starts_local = starts_at.astimezone(BR_TZ)
    ends_local = ends_at.astimezone(BR_TZ)
    db_weekday = (starts_local.weekday() + 1) % 7  # convenção do banco: domingo = 0
    start_t = starts_local.time()
    end_t = ends_local.time()

    if not getattr(therapist_profile, "is_available_now", False):
        periods = db.execute(select(AvailabilityPeriod).where(and_(
            AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
            AvailabilityPeriod.start_date <= starts_local.date(),
            AvailabilityPeriod.end_date >= starts_local.date(),
        ))).scalars().all()
        disponivel = False
        for period in periods:
            slot = db.execute(select(AvailabilitySlot).where(and_(
                AvailabilitySlot.period_id == period.id,
                AvailabilitySlot.weekday == db_weekday,
                AvailabilitySlot.start_time <= start_t,
                AvailabilitySlot.end_time >= end_t,
            ))).scalars().first()
            if slot:
                disponivel = True
                break
        if not disponivel:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

    conflito = db.execute(select(Appointment).where(and_(
        Appointment.therapist_user_id == payload.therapist_user_id,
        Appointment.status.in_([
            AppointmentStatus.scheduled, AppointmentStatus.confirmed,
            AppointmentStatus.proposed, AppointmentStatus.pending_payment,
        ]),
        starts_at < Appointment.ends_at,
        ends_at > Appointment.starts_at,
    ))).scalars().first()
    if conflito:
        raise HTTPException(status_code=409, detail="Horário já ocupado")

    # 4) escolhe o lote que vence primeiro e ainda tem crédito (travando as linhas)
    # o valor do terapeuta é o que está no plano AGORA (como no plano empresa); o do lote só serve de reserva
    lotes = db.execute(text(
        "SELECT l.id, l.sessions_total, COALESCE(p.valor_repassado_terapeuta, l.payout_per_session) AS payout_per_session "
        "FROM patient_session_lots l LEFT JOIN patient_plans p ON p.id = l.plan_id "
        "WHERE l.patient_user_id = :u AND l.valid_from <= now() AND l.valid_until >= :ends "
        "ORDER BY l.valid_until, l.id FOR UPDATE OF l"
    ), {"u": current_user.id, "ends": ends_at}).all()
    escolhido = None
    usadas = 0
    for lote in lotes:
        usadas = db.execute(text(
            "SELECT count(*) FROM patient_session_uses su JOIN appointments a ON a.id = su.appointment_id "
            f"WHERE su.lot_id = :l AND a.status::text NOT IN {NAO_CONSUMIDOS_SQL}"
        ), {"l": lote.id}).scalar()
        if usadas < lote.sessions_total:
            escolhido = lote
            break
    if not escolhido:
        db.rollback()  # solta os travos: sem crédito para essa data, o fluxo normal segue
        return None

    # 5) cria a consulta já confirmada e liga ao lote
    try:
        appt = Appointment(
            patient_user_id=current_user.id,
            therapist_user_id=therapist_profile.user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.confirmed,
            session_price=escolhido.payout_per_session,  # como no plano empresa: o valor do terapeuta
            duration_minutes=getattr(payload, "duration_minutes", None) or 50,
        )
        db.add(appt)
        db.flush()
        db.execute(text("INSERT INTO patient_session_uses (lot_id, appointment_id) VALUES (:l, :a)"),
                   {"l": escolhido.id, "a": appt.id})
        db.add(AppointmentEvent(
            appointment_id=appt.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.created,
            old_status=None,
            new_status=appt.status.value,
        ))
        db.commit()
        db.refresh(appt)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao criar agendamento")

    result = {
        "id": appt.id,
        "patient_user_id": appt.patient_user_id,
        "therapist_user_id": appt.therapist_user_id,
        "starts_at": appt.starts_at,
        "ends_at": appt.ends_at,
        "status": appt.status.value,
        "session_price": float(appt.session_price or 0),
        "duration_minutes": appt.duration_minutes,
        "needs_payment": False,
        "insufficient_balance": False,
        "required_amount": 0,
        "current_balance": 0,
        "paid_with_package": True,
        "message": "Sessão agendada com o seu pacote.",
    }
    print(f"🎟️ [PACOTE] consulta {appt.id} marcada com crédito (paciente {current_user.id}, lote {escolhido.id}, "
          f"{escolhido.sessions_total - usadas - 1} restante(s) no lote)")

    # 6) Jitsi + e-mails + notificações (a mesma rotina do fluxo normal) e evento de tela; nada disso derruba a marcação
    try:
        from app.routes import appointments as _ap
        _ap._send_confirmation_emails_and_meet_and_notifications(appt, db)
        create_event = getattr(_ap, "create_event", None)
        emit_event = getattr(_ap, "emit_event", None)
        EventType = getattr(_ap, "EventType", None)
        if create_event and emit_event and EventType:
            from app.models.user import User
            paciente = db.get(User, appt.patient_user_id)
            emit_event(create_event(
                event_type=EventType.APPOINTMENT_CREATED,
                payload={
                    "appointment_id": appt.id,
                    "patient_id": appt.patient_user_id,
                    "patient_name": paciente.full_name if paciente else None,
                    "starts_at": appt.starts_at.isoformat(),
                    "status": appt.status.value,
                },
                target_user_ids=[appt.therapist_user_id],
            ))
    except Exception as e:
        print(f"⚠️ [PACOTE] consulta {appt.id} marcada, mas a notificação falhou: {e}")

    return result


# ==========================
# REPASSE AO TERAPEUTA
# ==========================
def settle_package_payouts(limit: int = 200) -> int:
    """
    Registra o repasse (valor do plano LIDO NO BANCO NA HORA, comissão 0%) das sessões de pacote CONCLUÍDAS ou em que
    o paciente faltou (no_show), como o fluxo normal, que não devolve o valor ao terapeuta em falta.
    Usa a mesma função do pagamento normal (register_commission), então entra nos relatórios e na
    carteira do terapeuta. Cada sessão é paga uma única vez (marcador payout_registered_at).
    """
    from app.db.database import SessionLocal
    db = SessionLocal()
    feitos = 0
    try:
        pendentes = db.execute(text(
            """
            SELECT su.id AS use_id, su.appointment_id,
                   COALESCE(p.valor_repassado_terapeuta, l.payout_per_session) AS payout_per_session,
                   a.therapist_user_id, a.patient_user_id
              FROM patient_session_uses su
              JOIN patient_session_lots l ON l.id = su.lot_id
              LEFT JOIN patient_plans p ON p.id = l.plan_id
              JOIN appointments a ON a.id = su.appointment_id
             WHERE su.payout_registered_at IS NULL
               AND a.status::text IN ('completed', 'no_show')
             ORDER BY su.id
             LIMIT :n
            """
        ), {"n": limit}).all()
        if not pendentes:
            return 0

        from app.routes.payments import register_commission
        for r in pendentes:
            try:
                # trava a linha e confere de novo (outro processo pode ter pago agora)
                alvo = db.execute(text(
                    "SELECT id FROM patient_session_uses WHERE id = :i AND payout_registered_at IS NULL "
                    "FOR UPDATE SKIP LOCKED"
                ), {"i": r.use_id}).first()
                if not alvo:
                    continue
                perfil = db.execute(text("SELECT 1 FROM therapist_profiles WHERE user_id = :t"),
                                    {"t": r.therapist_user_id}).first()
                if not perfil:
                    print(f"⚠️ [PACOTE] repasse da consulta {r.appointment_id} adiado: terapeuta {r.therapist_user_id} sem perfil")
                    db.rollback()
                    continue
                register_commission(
                    appointment_id=r.appointment_id,
                    therapist_user_id=r.therapist_user_id,
                    patient_user_id=r.patient_user_id,
                    session_price=float(r.payout_per_session),
                    commission_rate=0.0,
                    db=db,
                )
                db.execute(text("UPDATE patient_session_uses SET payout_registered_at = now() WHERE id = :i"),
                           {"i": r.use_id})
                db.commit()  # repasse e marcador na MESMA transação
                feitos += 1
                print(f"💰 [PACOTE] repasse de R$ {float(r.payout_per_session):.2f} registrado: consulta {r.appointment_id}, terapeuta {r.therapist_user_id}")
            except Exception as e:
                db.rollback()
                print(f"❌ [PACOTE] falha no repasse da consulta {r.appointment_id} (tenta de novo na próxima hora): {e}")
        return feitos
    except Exception as e:
        print(f"❌ [PACOTE] erro na rotina de repasse: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return feitos
    finally:
        db.close()


# ==========================
# REAGENDAMENTO DE SESSÃO DE PACOTE
# ==========================
def reschedule_package_session(original, payload, db, current_user):
    """
    Reagenda uma sessão marcada com PACOTE: a nova consulta herda o MESMO crédito (mesmo lote),
    a original passa a 'rescheduled' e nada é cobrado. É chamada pelo reagendamento normal
    DEPOIS das checagens dele (permissão, 'só uma vez', sessão não finalizada).
    """
    try:
        return _reschedule(original, payload, db, current_user)
    except HTTPException:
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"❌ [PACOTE] erro ao reagendar a consulta {getattr(original, 'id', None)}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Não foi possível reagendar esta sessão agora. Tente de novo em instantes.")


def _reschedule(original, payload, db, current_user):
    from app.models.appointment import Appointment
    from app.models.therapist_profile import TherapistProfile
    from app.models.availability import AvailabilityPeriod, AvailabilitySlot
    from app.models.appointment_event import AppointmentEvent
    from app.core.appointment_event_type import AppointmentEventType
    from app.core.appointment_status import AppointmentStatus
    from app.core.roles import UserRole

    # o crédito desta sessão (trava a linha: dois reagendamentos simultâneos não duplicam o uso)
    uso = db.execute(text(
        "SELECT su.id, su.lot_id, l.valid_until FROM patient_session_uses su "
        "JOIN patient_session_lots l ON l.id = su.lot_id "
        "WHERE su.appointment_id = :a FOR UPDATE OF su"
    ), {"a": original.id}).first()
    if not uso:
        raise HTTPException(status_code=409, detail="Esta sessão mudou enquanto você reagendava. Atualize a página.")

    starts_at = payload.starts_at
    ends_at = payload.ends_at
    is_therapist = current_user.id == original.therapist_user_id
    is_admin = getattr(current_user, "role", None) == UserRole.admin

    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == original.therapist_user_id)
    ).scalar_one_or_none()
    if not therapist_profile:
        raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")

    # o novo horário precisa caber na validade do pacote
    if uso.valid_until < ends_at:
        ate = uso.valid_until.astimezone(BR_TZ).strftime("%d/%m/%Y")
        raise HTTPException(status_code=400, detail=f"O novo horário é depois da validade do seu pacote ({ate}). Escolha uma data até lá.")

    # mesmas regras de horário do reagendamento normal (terapeuta/admin podem forçar)
    force = getattr(payload, "force", False)
    if not (force and (is_therapist or is_admin)):
        starts_local = starts_at.astimezone(BR_TZ)
        ends_local = ends_at.astimezone(BR_TZ)
        db_weekday = (starts_local.weekday() + 1) % 7
        start_t, end_t = starts_local.time(), ends_local.time()
        periods = db.execute(select(AvailabilityPeriod).where(and_(
            AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
            AvailabilityPeriod.start_date <= starts_local.date(),
            AvailabilityPeriod.end_date >= starts_local.date(),
        ))).scalars().all()
        disponivel = False
        for period in periods:
            slot = db.execute(select(AvailabilitySlot).where(and_(
                AvailabilitySlot.period_id == period.id,
                AvailabilitySlot.weekday == db_weekday,
                AvailabilitySlot.start_time <= start_t,
                AvailabilitySlot.end_time >= end_t,
            ))).scalars().first()
            if slot:
                disponivel = True
                break
        if not disponivel:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

    conflito = db.execute(select(Appointment).where(and_(
        Appointment.id != original.id,
        Appointment.therapist_user_id == original.therapist_user_id,
        Appointment.status.in_([
            AppointmentStatus.scheduled, AppointmentStatus.confirmed,
            AppointmentStatus.proposed, AppointmentStatus.pending_payment,
        ]),
        starts_at < Appointment.ends_at,
        ends_at > Appointment.starts_at,
    ))).scalars().first()
    if conflito:
        raise HTTPException(status_code=409, detail="Horário já ocupado")

    try:
        nova = Appointment(
            patient_user_id=original.patient_user_id,
            therapist_user_id=original.therapist_user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.confirmed,
            session_price=original.session_price,
            duration_minutes=original.duration_minutes or 50,
            rescheduled_from_id=original.id,
        )
        db.add(nova)
        db.flush()
        # o crédito passa para a nova consulta (o saldo do lote não muda)
        db.execute(text("UPDATE patient_session_uses SET appointment_id = :n WHERE id = :u"),
                   {"n": nova.id, "u": uso.id})
        status_antigo = original.status
        original.status = AppointmentStatus.rescheduled
        db.add(AppointmentEvent(
            appointment_id=nova.id, actor_user_id=current_user.id,
            event_type=AppointmentEventType.created, old_status=None, new_status=nova.status.value,
        ))
        db.add(AppointmentEvent(
            appointment_id=original.id, actor_user_id=current_user.id,
            event_type=AppointmentEventType.status_changed,
            old_status=status_antigo.value if status_antigo else None,
            new_status=AppointmentStatus.rescheduled.value,
        ))
        db.commit()
        db.refresh(nova)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflito ao reagendar")

    resultado = {
        "id": nova.id,
        "patient_user_id": nova.patient_user_id,
        "therapist_user_id": nova.therapist_user_id,
        "starts_at": nova.starts_at,
        "ends_at": nova.ends_at,
        "status": nova.status.value,
        "session_price": float(nova.session_price or 0),
        "duration_minutes": nova.duration_minutes,
        "rescheduled_from_id": nova.rescheduled_from_id,
        "needs_payment": False,
        "insufficient_balance": False,
        "required_amount": 0,
        "current_balance": 0,
        "paid_with_package": True,
        "message": "Sessão reagendada. Seu crédito foi mantido.",
    }
    print(f"🔁 [PACOTE] consulta {original.id} reagendada para {nova.id} (crédito mantido, lote {uso.lot_id})")

    try:
        from app.routes import appointments as _ap
        _ap._send_confirmation_emails_and_meet_and_notifications(nova, db)
        create_event = getattr(_ap, "create_event", None)
        emit_event = getattr(_ap, "emit_event", None)
        EventType = getattr(_ap, "EventType", None)
        if create_event and emit_event and EventType:
            from app.models.user import User
            paciente = db.get(User, nova.patient_user_id)
            emit_event(create_event(
                event_type=EventType.APPOINTMENT_CREATED,
                payload={
                    "appointment_id": nova.id,
                    "patient_id": nova.patient_user_id,
                    "patient_name": paciente.full_name if paciente else None,
                    "starts_at": nova.starts_at.isoformat(),
                    "status": nova.status.value,
                },
                target_user_ids=[nova.therapist_user_id],
            ))
    except Exception as e:
        print(f"⚠️ [PACOTE] consulta {nova.id} reagendada, mas a notificação falhou: {e}")

    return resultado
