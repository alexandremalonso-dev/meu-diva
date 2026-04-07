from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from datetime import datetime, timedelta, timezone, date as date_type
from typing import Optional, List

from app.db.database import get_db
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.availability import AvailabilityPeriod, AvailabilitySlot
from app.models.appointment import Appointment
from app.core.appointment_status import AppointmentStatus
from app.schemas.therapist import TherapistProfileOut
from app.schemas.slots import AvailableSlot, AvailableSlotsResponse

# 🔥 CRÍTICO: DEFINIR O ROUTER AQUI!
router = APIRouter(prefix="/public/terapeutas", tags=["público"])


# ==========================
# HELPERS
# ==========================
def _parse_tz_offset(tz_offset: str) -> timezone:
    try:
        sign = 1
        s = tz_offset.strip()
        if s.startswith("-"):
            sign = -1
            s = s[1:]
        elif s.startswith("+"):
            s = s[1:]

        hh, mm = s.split(":")
        delta = timedelta(hours=int(hh), minutes=int(mm))
        return timezone(sign * delta)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="tz_offset invalido. Use formato: -03:00, +00:00, +02:30"
        )


def _overlaps(s1: datetime, e1: datetime, s2: datetime, e2: datetime) -> bool:
    return s1 < e2 and e1 > s2


# ==========================
# LISTAR TERAPEUTAS COM FILTROS
# ==========================
@router.get("", response_model=List[TherapistProfileOut])
def listar_terapeutas_publicos(
    db: Session = Depends(get_db),
    nome: Optional[str] = Query(None, description="Buscar por nome ou especialidade"),
    especialidade: Optional[str] = Query(None, description="Filtrar por especialidade"),
    abordagem: Optional[str] = Query(None, description="Filtrar por abordagem terapêutica"),
    genero: Optional[str] = Query(None, description="Filtrar por gênero"),
    preco_min: Optional[float] = Query(None, description="Preço mínimo"),
    preco_max: Optional[float] = Query(None, description="Preço máximo"),
    lgbtqia_ally: Optional[bool] = Query(None, description="Aliado LGBTQIAPN+"),
    duracao_30min: Optional[bool] = Query(None, description="Sessão de 30 minutos"),
    duracao_50min: Optional[bool] = Query(None, description="Sessão de 50 minutos"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Lista terapeutas públicos com filtros avançados
    """
    print(f"\n📋 GET /public/terapeutas - Listando terapeutas")
    print(f"   Filtros: nome={nome}, especialidade={especialidade}, abordagem={abordagem}, genero={genero}")

    query = select(TherapistProfile)

    if nome:
        termo = f"%{nome}%"
        query = query.where(
            or_(
                TherapistProfile.full_name.ilike(termo),
                TherapistProfile.specialties.ilike(termo)
            )
        )
    if especialidade:
        query = query.where(TherapistProfile.specialties.ilike(f"%{especialidade}%"))
    if abordagem:
        query = query.where(TherapistProfile.abordagem.ilike(f"%{abordagem}%"))
    if genero:
        query = query.where(TherapistProfile.gender == genero)
    if preco_min is not None:
        query = query.where(TherapistProfile.session_price >= preco_min)
    if preco_max is not None:
        query = query.where(TherapistProfile.session_price <= preco_max)
    if lgbtqia_ally is not None:
        query = query.where(TherapistProfile.lgbtqia_ally == lgbtqia_ally)
    if duracao_30min:
        query = query.where(TherapistProfile.session_duration_30min == True)
    if duracao_50min:
        query = query.where(TherapistProfile.session_duration_50min == True)

    # Ordenação inicial (featured e rating)
    query = query.order_by(
        TherapistProfile.featured.desc(),
        TherapistProfile.rating.desc(),
        TherapistProfile.id
    )

    offset = (page - 1) * limit
    terapeutas = db.execute(query.offset(offset).limit(limit)).scalars().all()

    # 🔥 Ordenação por prioridade de plano (Premium > Profissional > Essencial)
    from app.services.plan_priority import get_therapist_plan, PLAN_PRIORITY
    
    def get_plan_priority(therapist):
        plan = get_therapist_plan(therapist.user_id, db)
        return PLAN_PRIORITY.get(plan, 1)
    
    # Ordenar terapeutas por prioridade do plano (maior prioridade primeiro)
    terapeutas_ordenados = sorted(terapeutas, key=get_plan_priority, reverse=True)

    print(f"✅ Encontrados {len(terapeutas_ordenados)} terapeutas")
    return terapeutas_ordenados


# ==========================
# GET PERFIL PÚBLICO
# ==========================
@router.get("/{terapeuta_id}", response_model=TherapistProfileOut)
def get_terapeuta_publico(
    terapeuta_id: int,
    db: Session = Depends(get_db)
):
    print(f"\n📢 GET /public/terapeutas/{terapeuta_id}")

    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.id == terapeuta_id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")

    user = db.get(User, profile.user_id)

    profile_dict = profile.__dict__.copy()
    if '_sa_instance_state' in profile_dict:
        del profile_dict['_sa_instance_state']

    profile_dict['instagram_url'] = profile.instagram_url
    profile_dict['video_url'] = profile.video_url
    profile_dict['user'] = {"email": user.email if user else None} if user else None

    print(f"✅ Perfil público retornado: {profile.id}, nome: {profile.full_name}")
    return profile_dict


# ==========================
# GET SLOTS DISPONÍVEIS (PÚBLICO)
# ==========================
@router.get("/{terapeuta_id}/slots", response_model=AvailableSlotsResponse)
def get_slots_disponiveis(
    terapeuta_id: int,
    start_date: Optional[str] = Query(None, description="Data de início (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data de fim (YYYY-MM-DD)"),
    days: int = Query(30, description="Número de dias a partir de hoje (usado se start/end não informados)"),
    tz_offset: str = "-03:00",
    db: Session = Depends(get_db)
):
    """
    Retorna os slots disponíveis para um terapeuta.
    - Se start_date e end_date informados: busca no intervalo exato (inclusive ambos os dias)
    - Se não informados: busca os próximos 'days' dias
    """
    print(f"\n📢 GET /public/terapeutas/{terapeuta_id}/slots")
    print(f"   Parâmetros: start_date={start_date}, end_date={end_date}, days={days}")

    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.id == terapeuta_id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")

    tz = _parse_tz_offset(tz_offset)
    now = datetime.now(tz)

    # ✅ CORREÇÃO PRINCIPAL:
    # range_start / range_end  → usados para resposta e filtragem de appointments (com hora)
    # loop_start_date / loop_end_date → datas puras para o loop de geração de slots (sem hora)
    if start_date and end_date:
        try:
            # range_start: início do dia informado
            range_start = datetime.strptime(start_date, "%Y-%m-%d").replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=tz
            )
            # range_end: fim do último dia informado (23:59:59) — usado apenas na query SQL
            range_end = datetime.strptime(end_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999, tzinfo=tz
            )
            # ✅ datas puras para o loop — sem - timedelta(seconds=1), sem distorção
            loop_start_date: date_type = range_start.date()
            loop_end_date: date_type = datetime.strptime(end_date, "%Y-%m-%d").date()
            print(f"📅 Intervalo personalizado: {loop_start_date} a {loop_end_date} (inclusive)")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    else:
        range_start = now
        range_end = now + timedelta(days=days)
        loop_start_date = range_start.date()
        loop_end_date = range_end.date()
        print(f"📅 Intervalo padrão ({days} dias): {loop_start_date} a {loop_end_date}")

    range_start_utc = range_start.astimezone(timezone.utc)
    range_end_utc = range_end.astimezone(timezone.utc)

    # Buscar períodos de disponibilidade
    active_periods = db.execute(
        select(AvailabilityPeriod).where(
            and_(
                AvailabilityPeriod.therapist_profile_id == profile.id,
                AvailabilityPeriod.end_date >= loop_start_date,
                AvailabilityPeriod.start_date <= loop_end_date
            )
        )
    ).scalars().all()

    if not active_periods:
        print("⚠️ Nenhum período de disponibilidade encontrado")
        return AvailableSlotsResponse(
            therapist_user_id=profile.user_id,
            range_start=range_start,
            range_end=range_end,
            slots=[],
            count=0,
        )

    # Mapear períodos com seus slots por dia da semana
    periods_with_slots = {}
    for period in active_periods:
        slots = db.execute(
            select(AvailabilitySlot).where(AvailabilitySlot.period_id == period.id)
        ).scalars().all()

        slots_by_weekday = {}
        for slot in slots:
            slots_by_weekday.setdefault(slot.weekday, []).append(
                (slot.start_time, slot.end_time)
            )
        periods_with_slots[period] = slots_by_weekday

    print(f"📋 Períodos encontrados: {len(periods_with_slots)}")
    for period, slots_by_wd in periods_with_slots.items():
        dias_nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
        print(f"   {period.start_date} → {period.end_date}")
        for wd, intervals in slots_by_wd.items():
            print(f"     {dias_nomes[wd]}: {len(intervals)} intervalo(s)")

    # Buscar appointments já ocupados no período
    busy_appts = db.execute(
        select(Appointment).where(
            and_(
                Appointment.therapist_user_id == profile.user_id,
                Appointment.status.in_([
                    AppointmentStatus.scheduled,
                    AppointmentStatus.confirmed,
                    AppointmentStatus.proposed,
                ]),
                Appointment.starts_at < range_end_utc,
                Appointment.ends_at > range_start_utc,
            )
        )
    ).scalars().all()

    busy_windows = [
        (a.starts_at.astimezone(tz), a.ends_at.astimezone(tz))
        for a in busy_appts
    ]

    # Durações oferecidas pelo terapeuta
    durations_to_generate = []
    if profile.session_duration_30min:
        durations_to_generate.append(30)
    if profile.session_duration_50min:
        durations_to_generate.append(50)
    if not durations_to_generate:
        durations_to_generate = [50]

    all_slots = []
    dias_nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

    for duration in durations_to_generate:
        step = timedelta(minutes=duration)
        slots = []

        # ✅ Loop usa loop_end_date (date puro) — sem risco de corte por timezone
        d = loop_start_date
        while d <= loop_end_date:
            iso_weekday = d.isoweekday()   # 1=Segunda ... 7=Domingo
            db_weekday = iso_weekday - 1   # 0=Segunda ... 6=Domingo

            # Encontrar período que cobre esta data
            period_for_date = None
            slots_for_date = []

            for period, slots_by_wd in periods_with_slots.items():
                if period.start_date <= d <= period.end_date:
                    period_for_date = period
                    slots_for_date = slots_by_wd.get(db_weekday, [])
                    break

            if not period_for_date or not slots_for_date:
                d += timedelta(days=1)
                continue

            for start_t, end_t in slots_for_date:
                day_start = datetime.combine(d, start_t, tzinfo=tz)
                day_end = datetime.combine(d, end_t, tzinfo=tz)

                # Pula blocos já encerrados
                if day_end <= now:
                    continue

                # Não gerar slots antes do início do range
                if day_start < range_start:
                    day_start = range_start

                cursor = day_start
                while cursor + step <= day_end:
                    s = cursor
                    e = cursor + step
                    if all(not _overlaps(s, e, bs, be) for bs, be in busy_windows):
                        slots.append(
                            AvailableSlot(
                                starts_at=s,
                                ends_at=e,
                                duration_minutes=duration,
                            )
                        )
                    cursor += step

            d += timedelta(days=1)

        all_slots.extend(slots)

    all_slots.sort(key=lambda x: x.starts_at)

    print(f"✅ Total: {len(all_slots)} slots gerados de {loop_start_date} a {loop_end_date}")
    if all_slots:
        print(f"   Primeiro: {all_slots[0].starts_at.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Último:   {all_slots[-1].starts_at.strftime('%Y-%m-%d %H:%M')}")

    return AvailableSlotsResponse(
        therapist_user_id=profile.user_id,
        range_start=range_start,
        range_end=range_end,
        slots=all_slots,
        count=len(all_slots),
    )