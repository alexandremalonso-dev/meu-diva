from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Security, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
import traceback
import os
import shutil
import uuid

router = APIRouter(prefix="/therapists", tags=["therapists"])

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.auth import get_current_user
from app.core.appointment_status import AppointmentStatus

from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.appointment import Appointment

from app.schemas.therapist import (
    TherapistProfileUpsert,
    TherapistProfileOut,
)

from app.schemas.therapist_availability import (
    AvailabilityCreate,
    AvailabilityOut,
)

from app.schemas.calendar import TherapistCalendarOut, BusyBlock
from app.schemas.slots import AvailableSlot, AvailableSlotsResponse

# ==========================
# CONFIGURAÇÃO DE UPLOAD
# ==========================
UPLOAD_DIR = "uploads/therapists"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

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
# 🔥 GET PROFILE
# ==========================
@router.get("/me/profile", response_model=TherapistProfileOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna o perfil do terapeuta logado (GET)
    """
    print(f"\n📡 GET /therapists/me/profile - Usuário: {current_user.id}")
    
    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not profile:
        print("⚠️ Perfil não encontrado, criando perfil padrão...")
        profile = TherapistProfile(
            user_id=current_user.id,
            bio=None,
            specialties=None,
            session_price=None,
            experiencia=None,
            abordagem=None,
            idiomas=None,
            foto_url=None,
            rating=0.0,
            reviews_count=0,
            sessions_count=0,
            created_at=datetime.now(),
            gender=None,
            ethnicity=None,
            lgbtqia_ally=False,
            formation=None,
            approaches=None,
            specialties_list=None,
            reasons=None,
            service_types=None,
            languages_list=None,
            rating_distribution=None,
            total_sessions=0,
            verified=False,
            featured=False,
            session_duration_30min=True,
            session_duration_50min=True,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        print(f"✅ Perfil padrão criado via GET: {profile.id}")

    return profile


# ==========================
# 🔥 POST PROFILE (UPSERT)
# ==========================
@router.post("/me/profile", response_model=TherapistProfileOut)
def upsert_profile(
    payload: TherapistProfileUpsert,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Atualiza ou cria o perfil do terapeuta com todos os campos da busca avançada
    """
    try:
        print(f"\n📝 Upsert profile para usuario: {current_user.id}")
        print(f"Payload recebido: {payload}")
        
        existing = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if existing:
            # Atualizar campos existentes
            existing.bio = payload.bio
            existing.specialties = payload.specialties
            existing.session_price = payload.session_price
            existing.experiencia = payload.experiencia
            existing.abordagem = payload.abordagem
            existing.idiomas = payload.idiomas
            existing.foto_url = payload.foto_url
            existing.updated_at = datetime.now()
            
            # 🔥 NOVOS CAMPOS PARA BUSCA
            existing.gender = payload.gender
            existing.ethnicity = payload.ethnicity
            existing.lgbtqia_ally = payload.lgbtqia_ally if payload.lgbtqia_ally is not None else False
            existing.formation = payload.formation
            existing.approaches = payload.approaches
            existing.specialties_list = payload.specialties_list
            existing.reasons = payload.reasons
            existing.service_types = payload.service_types
            existing.languages_list = payload.languages_list
            existing.rating_distribution = payload.rating_distribution
            existing.total_sessions = payload.total_sessions if payload.total_sessions is not None else 0
            existing.verified = payload.verified if payload.verified is not None else False
            existing.featured = payload.featured if payload.featured is not None else False
            
            # 🔥 DURAÇÃO DAS SESSÕES
            existing.session_duration_30min = payload.session_duration_30min if payload.session_duration_30min is not None else True
            existing.session_duration_50min = payload.session_duration_50min if payload.session_duration_50min is not None else True
            
            db.commit()
            db.refresh(existing)
            print(f"✅ Perfil atualizado: {existing.id}")
            return existing

        # Criar com todos os campos
        profile = TherapistProfile(
            user_id=current_user.id,
            bio=payload.bio,
            specialties=payload.specialties,
            session_price=payload.session_price,
            experiencia=payload.experiencia,
            abordagem=payload.abordagem,
            idiomas=payload.idiomas,
            foto_url=payload.foto_url,
            created_at=datetime.now(),
            rating=0.0,
            reviews_count=0,
            sessions_count=0,
            # 🔥 NOVOS CAMPOS
            gender=payload.gender,
            ethnicity=payload.ethnicity,
            lgbtqia_ally=payload.lgbtqia_ally or False,
            formation=payload.formation,
            approaches=payload.approaches,
            specialties_list=payload.specialties_list,
            reasons=payload.reasons,
            service_types=payload.service_types,
            languages_list=payload.languages_list,
            rating_distribution=payload.rating_distribution,
            total_sessions=payload.total_sessions or 0,
            verified=payload.verified or False,
            featured=payload.featured or False,
            # 🔥 DURAÇÃO DAS SESSÕES
            session_duration_30min=payload.session_duration_30min if payload.session_duration_30min is not None else True,
            session_duration_50min=payload.session_duration_50min if payload.session_duration_50min is not None else True,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        print(f"✅ Perfil criado: {profile.id}")
        return profile
    except Exception as e:
        print(f"❌ Erro em upsert_profile: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# ATUALIZAR PREÇO DA SESSÃO (COM AUDITORIA)
# ==========================

@router.patch("/me/profile/price", response_model=dict)
def update_session_price(
    price: float,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Terapeuta define seu preço por sessão (endpoint dedicado)
    """
    print(f"\n💰 Atualizando preço da sessão - Usuário: {current_user.id}")
    
    try:
        profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Perfil do terapeuta não encontrado")
        
        if price <= 0:
            raise HTTPException(status_code=400, detail="Preço deve ser maior que zero")
        
        if price > 10000:
            raise HTTPException(status_code=400, detail="Preço máximo por sessão é R$ 10.000,00")
        
        old_price = profile.session_price
        profile.session_price = price
        profile.updated_at = datetime.now()
        
        from app.core.audit import get_audit_service
        audit = get_audit_service(db, current_user, request)
        audit.log_price_change(profile, old_price, price)
        
        db.commit()
        
        print(f"✅ Preço atualizado: R$ {old_price} → R$ {price}")
        
        return {
            "message": "Preço da sessão atualizado com sucesso",
            "session_price": price,
            "formatted": f"R$ {price:.2f}".replace('.', ',')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao atualizar preço: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# UPLOAD DE FOTO DO TERAPEUTA
# ==========================

@router.post("/me/profile/photo", response_model=dict)
async def upload_therapist_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Faz upload da foto do terapeuta
    """
    print(f"\n📸 POST /therapists/me/profile/photo - Usuário: {current_user.id}")
    
    try:
        profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Perfil do terapeuta não encontrado")
        
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Formato de arquivo não permitido. Use JPG, PNG ou WEBP")
        
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 5MB")
        
        await file.seek(0)
        
        if profile.foto_url:
            old_file_path = os.path.join(UPLOAD_DIR, os.path.basename(profile.foto_url))
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
                print(f"🗑️ Foto antiga removida: {old_file_path}")
        
        unique_filename = f"therapist_{current_user.id}_{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        foto_url = f"/uploads/therapists/{unique_filename}"
        profile.foto_url = foto_url
        profile.updated_at = datetime.now()
        
        db.commit()
        
        print(f"✅ Foto salva: {foto_url}")
        return {"foto_url": foto_url, "message": "Foto atualizada com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao fazer upload: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao fazer upload: {str(e)}")


# ==========================
# LISTAR TERAPEUTAS
# ==========================

@router.get("", response_model=list[TherapistProfileOut])
def list_therapists(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Lista todos os terapeutas com todos os campos (incluindo os novos)
    """
    try:
        print("\n📋 Listando todos os terapeutas")
        profiles = db.execute(
            select(TherapistProfile)
            .join(User)
            .where(User.role == UserRole.therapist)
        ).scalars().all()
        print(f"✅ {len(profiles)} terapeutas encontrados")
        return profiles
    except Exception as e:
        print(f"❌ Erro ao listar terapeutas: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro ao listar terapeutas")


# ==========================
# BUSCA AVANÇADA DE TERAPEUTAS
# ==========================

@router.get("/search", response_model=list[TherapistProfileOut])
def search_therapists(
    # Filtros básicos
    query: Optional[str] = Query(None, description="Busca por nome ou bio"),
    min_price: Optional[float] = Query(None, description="Preço mínimo"),
    max_price: Optional[float] = Query(None, description="Preço máximo"),
    
    # 🔥 NOVOS FILTROS
    gender: Optional[str] = Query(None, description="Gênero"),
    ethnicity: Optional[str] = Query(None, description="Etnia"),
    lgbtqia_ally: Optional[bool] = Query(None, description="Aliado LGBTQIAPN+"),
    formation: Optional[str] = Query(None, description="Formação"),
    approach: Optional[str] = Query(None, description="Abordagem terapêutica"),
    specialty: Optional[str] = Query(None, description="Especialidade"),
    reason: Optional[str] = Query(None, description="Motivo de atendimento"),
    service_type: Optional[str] = Query(None, description="Tipo de serviço"),
    language: Optional[str] = Query(None, description="Idioma"),
    verified: Optional[bool] = Query(None, description="Apenas verificados"),
    featured: Optional[bool] = Query(None, description="Apenas destaque"),
    
    # Paginação
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Busca avançada de terapeutas com múltiplos filtros
    """
    print(f"\n🔍 Buscando terapeutas com filtros...")
    
    query_builder = select(TherapistProfile).join(User).where(User.role == UserRole.therapist)
    
    # TODO: Implementar filtros específicos
    results = db.execute(query_builder.offset(skip).limit(limit)).scalars().all()
    print(f"✅ Encontrados {len(results)} terapeutas")
    
    return results


# ==========================
# DISPONIBILIDADE - GET (LISTAR)
# ==========================

@router.get("/me/availability", response_model=list[AvailabilityOut])
def list_my_availability(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    print(f"\n📋 Listando disponibilidades para usuario: {current_user.id}")
    
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            print(f"⚠️ Perfil nao encontrado, retornando lista vazia")
            return []
        
        rows = db.execute(
            select(TherapistAvailability)
            .where(TherapistAvailability.therapist_profile_id == therapist_profile.id)
            .order_by(TherapistAvailability.weekday, TherapistAvailability.start_time)
        ).scalars().all()
        
        print(f"✅ {len(rows)} disponibilidades encontradas")
        return rows
        
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        return []


# ==========================
# DISPONIBILIDADE - POST (CRIAR)
# ==========================

@router.post("/me/availability", response_model=AvailabilityOut, status_code=201)
def create_availability(
    payload: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    print(f"\n📝 Criando disponibilidade para usuario: {current_user.id}")
    print(f"Payload: {payload}")
    
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta nao encontrado")
        
        if payload.weekday < 0 or payload.weekday > 6:
            raise HTTPException(status_code=400, detail="Dia da semana deve ser entre 0 e 6")
        
        if payload.start_time >= payload.end_time:
            raise HTTPException(status_code=400, detail="Horario de inicio deve ser anterior ao fim")
        
        existing = db.execute(
            select(TherapistAvailability).where(
                TherapistAvailability.therapist_profile_id == therapist_profile.id,
                TherapistAvailability.weekday == payload.weekday,
                TherapistAvailability.start_time == payload.start_time
            )
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Este horario ja esta cadastrado")
        
        availability = TherapistAvailability(
            therapist_profile_id=therapist_profile.id,
            weekday=payload.weekday,
            start_time=payload.start_time,
            end_time=payload.end_time,
        )
        
        db.add(availability)
        db.commit()
        db.refresh(availability)
        
        print(f"✅ Disponibilidade criada com ID: {availability.id}")
        return availability
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# DISPONIBILIDADE - DELETE (REMOVER)
# ==========================

@router.delete("/me/availability/{availability_id}", status_code=204)
def delete_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    print(f"\n🗑️ Removendo disponibilidade ID: {availability_id}")
    
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta nao encontrado")
        
        availability = db.get(TherapistAvailability, availability_id)
        
        if not availability:
            raise HTTPException(status_code=404, detail="Disponibilidade nao encontrada")
        
        if availability.therapist_profile_id != therapist_profile.id:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        db.delete(availability)
        db.commit()
        
        print("✅ Disponibilidade removida")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# 🔥 SLOTS DISPONIVEIS (COM SUPORTE A MÚLTIPLAS DURAÇÕES)
# ==========================

@router.get("/{therapist_user_id}/available-slots", response_model=AvailableSlotsResponse)
def available_slots(
    therapist_user_id: int,
    days: int = Query(default=14, ge=1, le=60),
    duration_minutes: int = Query(default=50, ge=15, le=180),
    tz_offset: str = Query(default="-03:00"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    try:
        print(f"\n⏰ Calculando slots para terapeuta {therapist_user_id}")
        
        tz = _parse_tz_offset(tz_offset)

        therapist_exists = db.execute(
            select(User).where(
                User.id == therapist_user_id,
                User.role == UserRole.therapist
            )
        ).scalar_one_or_none()

        if not therapist_exists:
            raise HTTPException(status_code=404, detail="Terapeuta nao encontrado")

        therapist_profile = db.execute(
            select(TherapistProfile).where(
                TherapistProfile.user_id == therapist_user_id
            )
        ).scalar_one_or_none()

        if not therapist_profile:
            raise HTTPException(status_code=404, detail="Perfil do terapeuta nao encontrado")

        # 🔥 DETERMINAR QUAIS DURAÇÕES GERAR
        durations_to_generate = []
        if hasattr(therapist_profile, 'session_duration_30min') and therapist_profile.session_duration_30min:
            durations_to_generate.append(30)
        if hasattr(therapist_profile, 'session_duration_50min') and therapist_profile.session_duration_50min:
            durations_to_generate.append(50)
        
        # Se nenhuma estiver marcada, usar 50min como padrão
        if not durations_to_generate:
            durations_to_generate = [50]

        now_utc = datetime.now(timezone.utc)
        range_start_utc = now_utc
        range_end_utc = now_utc + timedelta(days=days)

        range_start = datetime.now(tz)
        range_end = range_start + timedelta(days=days)

        av_rows = db.execute(
            select(TherapistAvailability).where(
                TherapistAvailability.therapist_profile_id == therapist_profile.id
            )
        ).scalars().all()

        if not av_rows:
            return AvailableSlotsResponse(
                therapist_user_id=therapist_user_id,
                range_start=range_start,
                range_end=range_end,
                slots=[],
                count=0,
            )

        av_by_weekday: dict[int, list[TherapistAvailability]] = {}
        for av in av_rows:
            av_by_weekday.setdefault(av.weekday, []).append(av)

        busy_appts = db.execute(
            select(Appointment).where(
                and_(
                    Appointment.therapist_user_id == therapist_user_id,
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

        all_slots = []

        # 🔥 GERAR SLOTS PARA CADA DURAÇÃO
        for duration in durations_to_generate:
            step = timedelta(minutes=duration)
            slots = []

            d = range_start.date()
            end_d = range_end.date()

            while d <= end_d:
                weekday = datetime(d.year, d.month, d.day, tzinfo=tz).weekday()
                day_windows = av_by_weekday.get(weekday, [])

                for w in day_windows:
                    w_start = datetime.combine(d, w.start_time, tzinfo=tz)
                    w_end = datetime.combine(d, w.end_time, tzinfo=tz)

                    if w_end <= range_start or w_start >= range_end:
                        continue

                    cursor = max(w_start, range_start)
                    last_end = min(w_end, range_end)

                    while cursor + step <= last_end:
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
        print(f"✅ {len(all_slots)} slots calculados (durações: {durations_to_generate})")

        return AvailableSlotsResponse(
            therapist_user_id=therapist_user_id,
            range_start=range_start,
            range_end=range_end,
            slots=all_slots,
            count=len(all_slots),
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em available_slots: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# CALENDARIO
# ==========================

@router.get("/{therapist_user_id}/calendar", response_model=TherapistCalendarOut)
def therapist_calendar(
    therapist_user_id: int,
    days: int = 14,
    tz_offset: str = "-03:00",
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    try:
        print(f"\n📅 Gerando calendario para terapeuta {therapist_user_id}")
        
        if current_user.role != UserRole.admin and current_user.id != therapist_user_id:
            raise HTTPException(status_code=403, detail="Acesso negado")

        if days < 1 or days > 60:
            raise HTTPException(status_code=422, detail="days deve estar entre 1 e 60")

        tz = _parse_tz_offset(tz_offset)

        range_start = datetime.now(tz)
        range_end = range_start + timedelta(days=days)

        appts = db.execute(
            select(Appointment)
            .where(
                Appointment.therapist_user_id == therapist_user_id,
                Appointment.starts_at >= range_start,
                Appointment.starts_at < range_end,
            )
            .order_by(Appointment.starts_at.asc())
        ).scalars().all()

        busy = []
        for a in appts:
            if a.status in (
                AppointmentStatus.scheduled,
                AppointmentStatus.confirmed,
                AppointmentStatus.proposed,
            ):
                busy.append(
                    BusyBlock(
                        starts_at=a.starts_at.astimezone(tz),
                        ends_at=a.ends_at.astimezone(tz),
                        reason="appointment",
                    )
                )

        print(f"✅ Calendario gerado com {len(busy)} blocos ocupados")
        
        return TherapistCalendarOut(
            therapist_user_id=therapist_user_id,
            range_start=range_start,
            range_end=range_end,
            appointments=appts,
            busy_blocks=busy,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em therapist_calendar: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")