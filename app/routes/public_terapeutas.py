from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func, cast, String
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
from app.services.plan_priority import get_therapist_plan, PLAN_PRIORITY

router = APIRouter(prefix="/public/terapeutas", tags=["público"])

# 🔥 Mesmos planos elegíveis do endpoint /api/therapists/me/vanity-url
VANITY_URL_ELIGIBLE_PLANS = {"profissional", "premium"}


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


def _db_weekday_to_python(db_weekday: int) -> int:
    return (db_weekday - 1) % 7


def _perfil_completo(t: TherapistProfile) -> bool:
    """Retorna True se o perfil tem foto, preço e bio preenchidos"""
    tem_foto = bool(t.foto_url and t.foto_url.strip())
    tem_preco = bool(t.session_price and t.session_price > 0)
    tem_bio = bool(t.bio and t.bio.strip())
    return tem_foto and tem_preco and tem_bio


def _buscar_terapeuta_por_identifier(identifier: str, db: Session) -> Optional[TherapistProfile]:
    """
    Busca terapeuta por ID numérico (sempre válido) ou por slug (URL
    personalizada — só válido enquanto o plano for Profissional/Premium).
    Aplica também o filtro de validação/conta ativa (mesmo critério da
    listagem pública) para não expor perfis não aprovados via link direto.
    """
    if identifier.isdigit():
        profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.id == int(identifier))
        ).scalar_one_or_none()
    else:
        profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.slug == identifier)
        ).scalar_one_or_none()

        if not profile:
            return None

        # 🔥 slug só resolve se o plano atual ainda for elegível
        plan = get_therapist_plan(profile.user_id, db)
        if plan not in VANITY_URL_ELIGIBLE_PLANS:
            return None

    if not profile:
        return None

    # 🔥 mesmo critério de aprovação/conta ativa usado na listagem pública
    if profile.validation_status != "approved":
        return None

    user = db.get(User, profile.user_id)
    if not user or not user.is_active:
        return None

    return profile


# ==========================
# 🔒 PRIVACIDADE DA API PÚBLICA: contato só para PACIENTE LOGADO (e só se o terapeuta marcou "mostrar");
# a assinatura e o e-mail do terapeuta nunca saem por aqui.
# ==========================
def _usuario_opcional(request, db):
    """Usuário logado (token de acesso válido) ou None. Nunca levanta erro: visitante e Google são anônimos."""
    try:
        from app.core.security import get_token_from_request, decode_token
        token = get_token_from_request(request)
        if not token:
            return None
        payload = decode_token(token)
        if payload.get("type") != "access" or not payload.get("sub"):
            return None
        return db.get(User, int(payload["sub"]))
    except Exception:
        return None


def _eh_paciente(usuario) -> bool:
    if not usuario:
        return False
    papel = getattr(usuario, "role", None)
    return str(getattr(papel, "value", papel)).lower() == "patient"


def _sanear_publico(d: dict, ver_contato: bool) -> dict:
    d = dict(d)
    d["signature_url"] = None
    # 🔒 identificação e dados financeiros do terapeuta nunca saem pela API pública (nem para paciente logado)
    for _campo in ("cpf", "cnpj", "cpf_masked", "bank_agency", "bank_account", "bank_account_digit", "pix_key_type", "pix_key"):
        if _campo in d:
            d[_campo] = None
    if not (ver_contato and d.get("show_phone_to_patients") and d.get("phone")):
        d["phone"] = None
        d["show_phone_to_patients"] = False
    if not (ver_contato and d.get("show_birth_date_to_patients") and d.get("birth_date")):
        d["birth_date"] = None
        d["show_birth_date_to_patients"] = False
    return d


def _publico_dict(t, ver_contato: bool = False) -> dict:
    return _sanear_publico(TherapistProfileOut.model_validate(t, from_attributes=True).model_dump(), ver_contato)


from starlette.requests import Request


# ==========================
# 🔒 ORDEM DOS PLANOS NA BUSCA (do mais alto para o mais baixo): Premium > Profissional > Essencial > Básico.
# O PLAN_PRIORITY (usado em outros pontos) tem Essencial = Básico = 1; a busca usa esta escala própria.
# ==========================
PLAN_RANK_BUSCA = {"premium": 4, "profissional": 3, "essencial": 2, "basico": 1}


# ==========================
# LISTAR TERAPEUTAS COM FILTROS
# ==========================
@router.get("", response_model=List[TherapistProfileOut])
def listar_terapeutas_publicos(
    response: Response,
    db: Session = Depends(get_db),
    nome: Optional[str] = Query(None, description="Buscar por nome ou especialidade"),
    especialidade: Optional[str] = Query(None, description="Filtrar por especialidade"),
    abordagem: Optional[str] = Query(None, description="Filtrar por abordagem terapêutica"),
    modalidade: Optional[str] = Query(None, description="Filtrar por modalidade de atendimento"),
    genero: Optional[str] = Query(None, description="Filtrar por gênero"),
    preco_min: Optional[float] = Query(None, description="Preço mínimo"),
    preco_max: Optional[float] = Query(None, description="Preço máximo"),
    lgbtqia_ally: Optional[bool] = Query(None, description="Aliado LGBTQIAPN+"),
    duracao_30min: Optional[bool] = Query(None, description="Sessão de 30 minutos"),
    duracao_50min: Optional[bool] = Query(None, description="Sessão de 50 minutos"),
    disponivel_agora: Optional[bool] = Query(None, description="Disponível para atendimento imediato"),
    aceita_corporativo: Optional[bool] = Query(None, description="Aceita plano empresa"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: bool = Query(False, description="Força modo de busca paginada (usado pela página /busca, mesmo sem filtros marcados)"),
):
    print(f"\n📋 GET /public/terapeutas - limit={limit}")

    # 🔥 Só terapeutas com documentos aprovados e conta ativa aparecem
    # na busca pública.
    # 🔥 Não exige mais validation_status == "approved" aqui — perfis
    # não verificados agora aparecem na busca, só que por último (regra
    # de ordenação abaixo cuida disso).
    # 🔥 Exclui contas de teste/revisão (ex: Apple Reviewer) da busca pública.
    TEST_ACCOUNT_EMAILS = ["reviewer.therapist@meudivaonline.com"]
    query = select(TherapistProfile).join(
        User, User.id == TherapistProfile.user_id
    ).where(
        and_(
            User.is_active == True,
            User.email.notin_(TEST_ACCOUNT_EMAILS)
        )
    )

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
    if modalidade:
        query = query.where(cast(TherapistProfile.service_modalities, String).ilike(f'%"{modalidade}"%'))
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
    # 🔥 Filtros adicionados
    if disponivel_agora:
        query = query.where(TherapistProfile.is_available_now == True)
    if aceita_corporativo:
        query = query.where(TherapistProfile.accepts_corporate_sessions == True)

    # Busca SEM limit do banco — ordena tudo no Python depois
    terapeutas = db.execute(query).scalars().all()

    def get_plan_priority(therapist):
        plan = get_therapist_plan(therapist.user_id, db)
        return PLAN_RANK_BUSCA.get(str(plan or "").strip().lower(), 1)

    def tem_foto(therapist) -> bool:
        return bool(therapist.foto_url and therapist.foto_url.strip())

    # 🔥 IDs de terapeutas com pelo menos 1 período de disponibilidade
    # ainda válido (não vencido) — usado na regra de ordenação abaixo.
    hoje = date_type.today()
    ids_com_disponibilidade = {
        row[0] for row in db.execute(
            select(AvailabilityPeriod.therapist_profile_id)
            .where(AvailabilityPeriod.end_date >= hoje)
            .distinct()
        ).all()
    }

    def tem_disponibilidade(therapist) -> bool:
        return therapist.id in ids_com_disponibilidade

    # 🔥 Regras de negócio da busca pública:
    # 1) Pagos sempre no topo, em ordem de plano — MAS só enquanto o
    #    perfil estiver COMPLETO (verificado + foto + disponibilidade).
    #    Pagar não garante topo sozinho: falta algum pré-requisito, o
    #    perfil cai pro grupo de baixo até completar tudo.
    # 2) Perfis sem foto não aparecem — SALVO se forem pagos
    # 3) Empate no mesmo plano: melhor rating primeiro, depois alfabético
    # 4) Pagos têm prioridade DENTRO do grupo de perfis completos
    # 5) Não verificados aparecem por último (mas aparecem)
    # 🔥 Extra: entre os perfis incompletos, ter disponibilidade pesa
    # mais que pagar — quem atende agora vem antes de quem não atende,
    # independente de plano.
    def eh_perfil_completo_para_ranking(therapist) -> bool:
        is_verified = therapist.validation_status == "approved"
        return is_verified and tem_foto(therapist) and tem_disponibilidade(therapist)

    def sort_key(therapist):
        plan_priority = get_plan_priority(therapist)
        rating = float(therapist.rating or 0)
        nome_para_ordenar = (therapist.full_name or "").lower()
        completo = eh_perfil_completo_para_ranking(therapist)
        disponivel = tem_disponibilidade(therapist)

        if completo:
            # Grupo de cima: ordena por plano, depois rating, depois nome
            return (
                0,                     # grupo "completo" vem antes
                -plan_priority,
                -rating,
                nome_para_ordenar,
            )
        else:
            # Grupo de baixo: disponibilidade pesa mais que plano
            return (
                1,                     # grupo "incompleto" vem depois
                0 if disponivel else 1,
                -plan_priority,        # entre quem tem (ou não tem) horário, o plano decide
                -rating,
                nome_para_ordenar,
            )

    is_search = search or any([nome, especialidade, abordagem, modalidade, genero, preco_min, preco_max,
                     lgbtqia_ally, duracao_30min, duracao_50min])

    if is_search:
        # 🔥 BUSCA: aplica a regra 2 (sem foto só aparece se for pago)
        elegiveis = [
            t for t in terapeutas
            if tem_foto(t) or get_plan_priority(t) > 1
        ]
        terapeutas_ordenados = sorted(elegiveis, key=sort_key)
    else:
        # 🔥 HOMEPAGE / WORDPRESS: só perfis completos (foto + preço + bio), limite 10
        completos = [t for t in terapeutas if _perfil_completo(t)]
        terapeutas_ordenados = sorted(completos, key=sort_key)[:10]

    # 🔥 Total ANTES de cortar pela página — sem isso o front não
    # consegue calcular quantas páginas existem de verdade (só via
    # header, pra não quebrar o formato da resposta que já é usado em
    # outros lugares como lista simples).
    total_count = len(terapeutas_ordenados)
    response.headers["X-Total-Count"] = str(total_count)

    # Paginação para busca
    if is_search:
        offset = (page - 1) * limit
        terapeutas_ordenados = terapeutas_ordenados[offset:offset + limit]

    print(f"✅ Retornando {len(terapeutas_ordenados)} terapeutas de {total_count} (is_search={is_search})")
    return [_publico_dict(t, False) for t in terapeutas_ordenados]


# ==========================
# 🔎 LISTA ENXUTA PARA O MAPA DO SITE (SEO): só quem pode ser indexado
# (aprovado, conta ativa, perfil completo e fora da conta de teste)
# ==========================
@router.get("/seo/mapa")
def mapa_seo_terapeutas(db: Session = Depends(get_db)):
    contas_teste = ["reviewer.therapist@meudivaonline.com"]
    linhas = db.execute(
        select(TherapistProfile).join(User, User.id == TherapistProfile.user_id).where(
            and_(User.is_active == True, User.email.notin_(contas_teste), TherapistProfile.validation_status == "approved")
        )
    ).scalars().all()
    saida = []
    for t in linhas:
        if not _perfil_completo(t):
            continue
        quando = getattr(t, "updated_at", None)
        saida.append({"id": t.id, "atualizado_em": quando.isoformat() if quando else None})
    return saida


# ==========================
# GET PERFIL PÚBLICO (aceita ID numérico OU slug/vanity URL)
# ==========================
@router.get("/{identifier}", response_model=TherapistProfileOut)
def get_terapeuta_publico(
    identifier: str,
    request: Request,
    db: Session = Depends(get_db)
):
    print(f"\n📢 GET /public/terapeutas/{identifier}")

    profile = _buscar_terapeuta_por_identifier(identifier, db)

    if not profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")

    user = db.get(User, profile.user_id)

    profile_dict = profile.__dict__.copy()
    if '_sa_instance_state' in profile_dict:
        del profile_dict['_sa_instance_state']

    profile_dict['instagram_url'] = profile.instagram_url
    profile_dict['video_url'] = profile.video_url
    profile_dict['user'] = {"email": ""} if user else None  # 🔒 o e-mail do terapeuta nunca sai na API pública

    visitante = _usuario_opcional(request, db)
    profile_dict = _sanear_publico(profile_dict, _eh_paciente(visitante))

    print(f"✅ Perfil público retornado: {profile.id}, nome: {profile.full_name}")
    return profile_dict


# ==========================
# GET SLOTS DISPONÍVEIS (PÚBLICO) — aceita ID numérico OU slug
# ==========================
@router.get("/{identifier}/slots", response_model=AvailableSlotsResponse)
def get_slots_disponiveis(
    identifier: str,
    start_date: Optional[str] = Query(None, description="Data de início (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data de fim (YYYY-MM-DD)"),
    days: int = Query(30, description="Número de dias a partir de hoje (usado se start/end não informados)"),
    tz_offset: str = "-03:00",
    db: Session = Depends(get_db)
):
    print(f"\n📢 GET /public/terapeutas/{identifier}/slots")

    profile = _buscar_terapeuta_por_identifier(identifier, db)

    if not profile:
        raise HTTPException(status_code=404, detail="Terapeuta não encontrado")

    tz = _parse_tz_offset(tz_offset)
    now = datetime.now(tz)

    if start_date and end_date:
        try:
            range_start = datetime.strptime(start_date, "%Y-%m-%d").replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=tz
            )
            range_end = datetime.strptime(end_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, microsecond=999999, tzinfo=tz
            )
            loop_start_date: date_type = range_start.date()
            loop_end_date: date_type = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    else:
        range_start = now
        range_end = now + timedelta(days=days)
        loop_start_date = range_start.date()
        loop_end_date = range_end.date()

    range_start_utc = range_start.astimezone(timezone.utc)
    range_end_utc = range_end.astimezone(timezone.utc)

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
        return AvailableSlotsResponse(
            therapist_user_id=profile.user_id,
            range_start=range_start,
            range_end=range_end,
            slots=[],
            count=0,
        )

    periods_with_slots = {}
    for period in active_periods:
        slots = db.execute(
            select(AvailabilitySlot).where(AvailabilitySlot.period_id == period.id)
        ).scalars().all()

        slots_by_weekday = {}
        for slot in slots:
            python_weekday = _db_weekday_to_python(slot.weekday)
            slots_by_weekday.setdefault(python_weekday, []).append(
                (slot.start_time, slot.end_time)
            )
        periods_with_slots[period] = slots_by_weekday

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

    # 🔥 Granularidade da agenda pública:
    # - custom_session_duration definida → usa só ela (permite 45min, 40min etc,
    #   não só os dois valores fixos abaixo)
    # - Aceita ambas → slots de 30 em 30 (menor granularidade; paciente escolhe duração no modal)
    # - Só 30min → slots de 30 em 30
    # - Só 50min → slots de 50 em 50
    if profile.custom_session_duration:
        durations_to_generate = [profile.custom_session_duration]
    elif profile.session_duration_30min:
        durations_to_generate = [30]
    elif profile.session_duration_50min:
        durations_to_generate = [50]
    else:
        durations_to_generate = [50]
    if not durations_to_generate:
        durations_to_generate = [50]

    all_slots = []

    weekdays_available = set()
    for slots_by_wd in periods_with_slots.values():
        weekdays_available.update(slots_by_wd.keys())

    for duration in durations_to_generate:
        step = timedelta(minutes=duration)

        for weekday in weekdays_available:
            current_date = loop_start_date
            days_ahead = (weekday - current_date.weekday()) % 7
            first_date = current_date + timedelta(days=days_ahead)

            d = first_date
            while d <= loop_end_date:
                period_for_date = None
                slots_for_date = []

                for period, slots_by_wd in periods_with_slots.items():
                    if period.start_date <= d <= period.end_date:
                        period_for_date = period
                        slots_for_date = slots_by_wd.get(weekday, [])
                        break

                if period_for_date and slots_for_date:
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
                                all_slots.append(
                                    AvailableSlot(
                                        starts_at=s,
                                        ends_at=e,
                                        duration_minutes=duration,
                                    )
                                )
                            cursor += step

                d += timedelta(days=7)

    all_slots.sort(key=lambda x: x.starts_at)

    print(f"✅ Total: {len(all_slots)} slots gerados")
    return AvailableSlotsResponse(
        therapist_user_id=profile.user_id,
        range_start=range_start,
        range_end=range_end,
        slots=all_slots,
        count=len(all_slots),
    )
