from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from datetime import datetime, timedelta, timezone
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
    # Filtros básicos
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
    
    # Query base
    query = select(TherapistProfile)
    
    # BUSCA POR NOME
    if nome:
        termo = f"%{nome}%"
        query = query.where(
            or_(
                TherapistProfile.full_name.ilike(termo),
                TherapistProfile.specialties.ilike(termo)
            )
        )
    
    # Filtro por especialidade
    if especialidade:
        termo = f"%{especialidade}%"
        query = query.where(TherapistProfile.specialties.ilike(termo))
    
    # Filtro por abordagem
    if abordagem:
        termo = f"%{abordagem}%"
        query = query.where(TherapistProfile.abordagem.ilike(termo))
    
    # Filtro por gênero
    if genero:
        query = query.where(TherapistProfile.gender == genero)
    
    # Filtro por preço
    if preco_min is not None:
        query = query.where(TherapistProfile.session_price >= preco_min)
    if preco_max is not None:
        query = query.where(TherapistProfile.session_price <= preco_max)
    
    # Filtro por aliado LGBTQIAPN+
    if lgbtqia_ally is not None:
        query = query.where(TherapistProfile.lgbtqia_ally == lgbtqia_ally)
    
    # Filtro por duração
    if duracao_30min:
        query = query.where(TherapistProfile.session_duration_30min == True)
    if duracao_50min:
        query = query.where(TherapistProfile.session_duration_50min == True)
    
    # Ordenar por destaque e avaliação
    query = query.order_by(
        TherapistProfile.featured.desc(),
        TherapistProfile.rating.desc(),
        TherapistProfile.id
    )
    
    # Paginação
    offset = (page - 1) * limit
    terapeutas = db.execute(query.offset(offset).limit(limit)).scalars().all()
    
    print(f"✅ Encontrados {len(terapeutas)} terapeutas")
    
    return terapeutas


# ==========================
# GET PERFIL PÚBLICO
# ==========================
@router.get("/{terapeuta_id}", response_model=TherapistProfileOut)
def get_terapeuta_publico(
    terapeuta_id: int,
    db: Session = Depends(get_db)
):
    """
    Retorna os dados públicos de um terapeuta (sem autenticação)
    """
    print(f"\n📢 GET /public/terapeutas/{terapeuta_id}")
    
    # Buscar o perfil do terapeuta
    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.id == terapeuta_id)
    ).scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
    
    # Buscar o usuário apenas para o email (opcional)
    user = db.get(User, profile.user_id)
    
    # Converter o perfil para dicionário
    profile_dict = profile.__dict__.copy()
    
    # Remover campos internos do SQLAlchemy
    if '_sa_instance_state' in profile_dict:
        del profile_dict['_sa_instance_state']
    
    # Adicionar objeto user apenas com email (opcional)
    profile_dict['user'] = {
        "email": user.email if user else None
    } if user else None
    
    print(f"✅ Perfil público retornado: {profile.id}, nome: {profile.full_name}")
    return profile_dict


# ==========================
# GET SLOTS DISPONÍVEIS (PÚBLICO) - CORRIGIDO COM ISOWEEKDAY
# ==========================
@router.get("/{terapeuta_id}/slots", response_model=AvailableSlotsResponse)
def get_slots_disponiveis(
    terapeuta_id: int,
    days: int = 14,
    tz_offset: str = "-03:00",
    db: Session = Depends(get_db)
):
    """
    Retorna os slots disponíveis para um terapeuta (público)
    """
    print(f"\n📢 GET /public/terapeutas/{terapeuta_id}/slots")
    
    # Buscar o perfil do terapeuta
    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.id == terapeuta_id)
    ).scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
    
    tz = _parse_tz_offset(tz_offset)
    now = datetime.now(tz)
    range_start = now
    range_end = now + timedelta(days=days)
    range_start_utc = datetime.now(timezone.utc)
    range_end_utc = range_start_utc + timedelta(days=days)
    
    # Buscar períodos de disponibilidade
    active_periods = db.execute(
        select(AvailabilityPeriod).where(
            and_(
                AvailabilityPeriod.therapist_profile_id == profile.id,
                AvailabilityPeriod.end_date >= range_start.date(),
                AvailabilityPeriod.start_date <= range_end.date()
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
    
    # Mapear períodos com seus slots
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
    
    print(f"📋 Períodos encontrados:")
    for period, slots_by_wd in periods_with_slots.items():
        print(f"   {period.start_date} a {period.end_date}: {len(slots_by_wd)} dias com slots")
        for wd, intervals in slots_by_wd.items():
            dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
            print(f"     {dias[wd]}: {len(intervals)} intervalos")
    
    # Buscar appointments ocupados
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
    
    # Durações que o terapeuta oferece
    durations_to_generate = []
    if profile.session_duration_30min:
        durations_to_generate.append(30)
    if profile.session_duration_50min:
        durations_to_generate.append(50)
    
    if not durations_to_generate:
        durations_to_generate = [50]
    
    all_slots = []
    
    # Gerar slots para cada duração
    for duration in durations_to_generate:
        step = timedelta(minutes=duration)
        slots = []
        
        d = range_start.date()
        end_d = range_end.date()
        
        while d <= end_d:
            # 🔥 CORREÇÃO: Usar ISOWEEKDAY (1=Segunda, 7=Domingo) e converter para weekday do banco
            # Banco de dados: 0=Segunda, 1=Terça, 2=Quarta, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo
            # ISODOW: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado, 7=Domingo
            
            # Criar datetime com timezone UTC para cálculo correto
            date_utc = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
            iso_weekday = date_utc.isoweekday()  # 1=Segunda, 7=Domingo
            
            # Converter para o formato do banco (0=Segunda, 6=Domingo)
            db_weekday = iso_weekday - 1  # 0=Segunda, 6=Domingo
            
            # Encontrar o período que cobre esta data
            period_for_date = None
            slots_for_date = None
            
            for period, slots_by_wd in periods_with_slots.items():
                if period.start_date <= d <= period.end_date:
                    period_for_date = period
                    slots_for_date = slots_by_wd.get(db_weekday, [])
                    break
            
            # Log para debug
            dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
            print(f"📅 Data: {d}, ISO weekday: {iso_weekday}({dias[iso_weekday-1]}), DB weekday: {db_weekday}({dias[db_weekday]}), Slots: {len(slots_for_date)}")
            
            if not period_for_date or not slots_for_date:
                d += timedelta(days=1)
                continue
            
            for start_t, end_t in slots_for_date:
                day_start = datetime.combine(d, start_t, tzinfo=tz)
                day_end = datetime.combine(d, end_t, tzinfo=tz)
                
                if day_end <= now:
                    continue
                
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
    
    if all_slots:
        print(f"✅ Primeiros slots gerados:")
        for slot in all_slots[:5]:
            print(f"   {slot.starts_at.strftime('%Y-%m-%d %H:%M')} - {slot.ends_at.strftime('%H:%M')}")
    
    print(f"✅ Total: {len(all_slots)} slots disponíveis")
    
    return AvailableSlotsResponse(
        therapist_user_id=profile.user_id,
        range_start=range_start,
        range_end=range_end,
        slots=all_slots,
        count=len(all_slots),
    )