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
from app.models.patient_profile import PatientProfile
from app.models.patient_address import PatientAddress
from app.models.therapist_address import TherapistAddress

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
# 🔥 GET PATIENT DATA BY APPOINTMENT
# ==========================

@router.get("/appointment/{appointment_id}/patient-data", response_model=dict)
def get_patient_data_by_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Retorna dados do paciente (nome, email, endereço, data de nascimento) a partir de uma sessão.
    Apenas o terapeuta da sessão pode acessar.
    """
    print(f"\n📋 Buscando dados do paciente para sessão {appointment_id}")
    
    appointment = db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    ).scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    if appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado. Esta sessão não pertence a você.")
    
    patient = db.execute(
        select(User).where(User.id == appointment.patient_user_id)
    ).scalar_one_or_none()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    patient_profile = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == patient.id)
    ).scalar_one_or_none()
    
    address = db.execute(
        select(PatientAddress)
        .where(PatientAddress.patient_id == patient_profile.id if patient_profile else 0)
        .order_by(PatientAddress.is_default.desc(), PatientAddress.id.asc())
    ).scalar_one_or_none()
    
    response = {
        "patient_id": patient.id,
        "name": patient.full_name or patient.email.split("@")[0] if patient.email else "",
        "email": patient.email,
        "cpf": patient.cpf if hasattr(patient, 'cpf') else None,
        "birth_date": patient.birth_date.isoformat() if hasattr(patient, 'birth_date') and patient.birth_date else None,
        "phone": patient_profile.phone if patient_profile else None,
        "address": {
            "street": address.street if address else None,
            "number": address.number if address else None,
            "complement": address.complement if address else None,
            "neighborhood": address.neighborhood if address else None,
            "city": address.city if address else None,
            "state": address.state if address else None,
            "zipcode": address.zipcode if address else None,
            "country": address.country if address else None,
        } if address else None
    }
    
    print(f"✅ Dados do paciente retornados: {response['name']}")
    return response


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
    try:
        print(f"\n📝 Upsert profile para usuario: {current_user.id}")
        
        existing = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if existing:
            existing.bio = payload.bio
            existing.specialties = payload.specialties
            existing.session_price = payload.session_price
            existing.experiencia = payload.experiencia
            existing.abordagem = payload.abordagem
            existing.idiomas = payload.idiomas
            existing.foto_url = payload.foto_url
            existing.updated_at = datetime.now()
            existing.phone = payload.phone
            existing.birth_date = payload.birth_date
            existing.education_level = payload.education_level
            existing.show_phone_to_patients = payload.show_phone_to_patients if payload.show_phone_to_patients is not None else False
            existing.show_birth_date_to_patients = payload.show_birth_date_to_patients if payload.show_birth_date_to_patients is not None else False
            existing.professional_registration = payload.professional_registration
            existing.treatment = payload.treatment
            existing.instagram_url = payload.instagram_url
            existing.signature_url = payload.signature_url
            existing.video_url = payload.video_url
            existing.cnpj = payload.cnpj
            existing.cpf = payload.cpf
            existing.bank_agency = payload.bank_agency
            existing.bank_account = payload.bank_account
            existing.bank_account_digit = payload.bank_account_digit
            existing.pix_key_type = payload.pix_key_type
            existing.pix_key = payload.pix_key
            existing.lgpd_consent = payload.lgpd_consent if payload.lgpd_consent is not None else False
            if payload.lgpd_consent and not existing.lgpd_consent_date:
                existing.lgpd_consent_date = datetime.now()
            existing.gender = payload.gender
            existing.ethnicity = payload.ethnicity
            existing.lgbtqia_ally = payload.lgbtqia_ally if payload.lgbtqia_ally is not None else False
            existing.lgbtqia_belonging = payload.lgbtqia_belonging if payload.lgbtqia_belonging is not None else False
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
            existing.session_duration_30min = payload.session_duration_30min if payload.session_duration_30min is not None else True
            existing.session_duration_50min = payload.session_duration_50min if payload.session_duration_50min is not None else True
            existing.cancellation_policy = payload.cancellation_policy
            
            db.commit()
            db.refresh(existing)
            print(f"✅ Perfil atualizado: {existing.id}")
            return existing

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
            phone=payload.phone,
            birth_date=payload.birth_date,
            education_level=payload.education_level,
            show_phone_to_patients=payload.show_phone_to_patients or False,
            show_birth_date_to_patients=payload.show_birth_date_to_patients or False,
            professional_registration=payload.professional_registration,
            treatment=payload.treatment,
            instagram_url=payload.instagram_url,
            signature_url=payload.signature_url,
            video_url=payload.video_url,
            cnpj=payload.cnpj,
            cpf=payload.cpf,
            bank_agency=payload.bank_agency,
            bank_account=payload.bank_account,
            bank_account_digit=payload.bank_account_digit,
            pix_key_type=payload.pix_key_type,
            pix_key=payload.pix_key,
            lgpd_consent=payload.lgpd_consent or False,
            lgpd_consent_date=datetime.now() if payload.lgpd_consent else None,
            gender=payload.gender,
            ethnicity=payload.ethnicity,
            lgbtqia_ally=payload.lgbtqia_ally or False,
            lgbtqia_belonging=payload.lgbtqia_belonging or False,
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
            session_duration_30min=payload.session_duration_30min if payload.session_duration_30min is not None else True,
            session_duration_50min=payload.session_duration_50min if payload.session_duration_50min is not None else True,
            cancellation_policy=payload.cancellation_policy,
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
# ATUALIZAR PREÇO DA SESSÃO
# ==========================

@router.patch("/me/profile/price", response_model=dict)
def update_session_price(
    price: float,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
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
# UPLOAD DE FOTO
# ==========================

@router.post("/me/profile/photo", response_model=dict)
async def upload_therapist_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
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
# BUSCA AVANÇADA
# ==========================

@router.get("/search", response_model=list[TherapistProfileOut])
def search_therapists(
    query: Optional[str] = Query(None, description="Busca por nome ou bio"),
    min_price: Optional[float] = Query(None, description="Preço mínimo"),
    max_price: Optional[float] = Query(None, description="Preço máximo"),
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
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    print(f"\n🔍 Buscando terapeutas com filtros...")
    
    query_builder = select(TherapistProfile).join(User).where(User.role == UserRole.therapist)
    
    results = db.execute(query_builder.offset(skip).limit(limit)).scalars().all()
    print(f"✅ Encontrados {len(results)} terapeutas")
    
    return results


# ==========================
# DISPONIBILIDADE - GET
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
# DISPONIBILIDADE - POST
# ==========================

@router.post("/me/availability", response_model=AvailabilityOut, status_code=201)
def create_availability(
    payload: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    print(f"\n📝 Criando disponibilidade para usuario: {current_user.id}")
    
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
# DISPONIBILIDADE - DELETE
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
# SLOTS DISPONIVEIS
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

        durations_to_generate = []
        if hasattr(therapist_profile, 'session_duration_30min') and therapist_profile.session_duration_30min:
            durations_to_generate.append(30)
        if hasattr(therapist_profile, 'session_duration_50min') and therapist_profile.session_duration_50min:
            durations_to_generate.append(50)
        
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


# ==========================
# 🔥 COMISSÕES DO TERAPEUTA
# ==========================

@router.get("/commissions", response_model=list)
def get_therapist_commissions(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Retorna todas as comissões do terapeuta logado (recebimentos líquidos)
    """
    from app.models.commission import Commission
    from app.models.therapist_profile import TherapistProfile
    from app.models.appointment import Appointment
    from app.models.user import User
    
    print(f"\n💰 Buscando comissões para terapeuta: {current_user.id}")
    
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        print(f"⚠️ Perfil não encontrado")
        return []
    
    commissions = db.execute(
        select(Commission)
        .where(Commission.therapist_id == therapist_profile.id)
        .order_by(Commission.created_at.desc())
    ).scalars().all()
    
    result = []
    for commission in commissions:
        appointment = db.get(Appointment, commission.appointment_id)
        patient = db.get(User, appointment.patient_user_id) if appointment else None
        
        result.append({
            "id": commission.id,
            "appointment_id": commission.appointment_id,
            "session_price": float(commission.session_price),
            "commission_rate": float(commission.commission_rate),
            "commission_amount": float(commission.commission_amount),
            "net_amount": float(commission.net_amount),
            "is_refund": commission.is_refund,
            "created_at": commission.created_at.isoformat(),
            "appointment": {
                "id": appointment.id if appointment else None,
                "starts_at": appointment.starts_at.isoformat() if appointment else None,
                "patient_name": patient.full_name if patient else None,
            } if appointment else None
        })
    
    print(f"✅ {len(result)} comissões encontradas")
    return result


# ==========================
# 🔥 ASSINATURA DO TERAPEUTA - GET
# ==========================

@router.get("/subscription", response_model=dict)
def get_therapist_subscription(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Retorna a assinatura atual do terapeuta
    """
    from app.models.subscription import Subscription
    from app.models.therapist_profile import TherapistProfile
    
    print(f"\n📋 Buscando assinatura para terapeuta: {current_user.id}")
    
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        print(f"⚠️ Perfil não encontrado, retornando plano essencial")
        return {
            "id": None,
            "plan": "essencial",
            "status": "active",
            "stripe_subscription_id": None,
            "current_period_start": None,
            "current_period_end": None,
            "cancel_at_period_end": False
        }
    
    subscription = db.execute(
        select(Subscription).where(Subscription.therapist_id == therapist_profile.id)
    ).scalar_one_or_none()
    
    if not subscription:
        print(f"⚠️ Nenhuma assinatura encontrada, retornando plano essencial")
        return {
            "id": None,
            "plan": "essencial",
            "status": "active",
            "stripe_subscription_id": None,
            "current_period_start": None,
            "current_period_end": None,
            "cancel_at_period_end": False
        }
    
    return {
        "id": subscription.id,
        "plan": subscription.plan,
        "status": subscription.status,
        "stripe_subscription_id": subscription.stripe_subscription_id,
        "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
        "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        "cancel_at_period_end": subscription.cancel_at_period_end
    }

# ==========================
# 🔥 ENDEREÇOS DO TERAPEUTA
# ==========================

@router.get("/me/address")
def get_therapist_addresses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Retorna todos os endereços do terapeuta logado"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    addresses = db.query(TherapistAddress).filter(TherapistAddress.therapist_id == therapist.id).all()
    
    result = []
    for addr in addresses:
        result.append({
            "id": addr.id,
            "cep": addr.cep,
            "street": addr.street,
            "number": addr.number,
            "complement": addr.complement,
            "neighborhood": addr.neighborhood,
            "city": addr.city,
            "state": addr.state,
            "country": addr.country,
            "is_default": addr.is_default,
            "created_at": addr.created_at.isoformat() if addr.created_at else None,
            "updated_at": addr.updated_at.isoformat() if addr.updated_at else None
        })
    
    return result


@router.post("/me/address")
def create_therapist_address(
    address_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Cria um novo endereço para o terapeuta"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    # Se for padrão, remover padrão dos outros
    if address_data.get("is_default"):
        db.query(TherapistAddress).filter(TherapistAddress.therapist_id == therapist.id).update({"is_default": False})
    
    new_address = TherapistAddress(
        therapist_id=therapist.id,
        cep=address_data.get("cep", ""),
        street=address_data.get("street", ""),
        number=address_data.get("number", ""),
        complement=address_data.get("complement", ""),
        neighborhood=address_data.get("neighborhood", ""),
        city=address_data.get("city", ""),
        state=address_data.get("state", ""),
        country=address_data.get("country", "Brasil"),
        is_default=address_data.get("is_default", False)
    )
    
    db.add(new_address)
    db.commit()
    db.refresh(new_address)
    
    return {"success": True, "id": new_address.id}


@router.put("/me/address/{address_id}")
def update_therapist_address(
    address_id: int,
    address_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Atualiza um endereço do terapeuta"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    address = db.query(TherapistAddress).filter(
        TherapistAddress.id == address_id,
        TherapistAddress.therapist_id == therapist.id
    ).first()
    
    if not address:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    
    # Se for padrão, remover padrão dos outros
    if address_data.get("is_default"):
        db.query(TherapistAddress).filter(TherapistAddress.therapist_id == therapist.id).update({"is_default": False})
    
    for field in ["cep", "street", "number", "complement", "neighborhood", "city", "state", "country", "is_default"]:
        if field in address_data:
            setattr(address, field, address_data[field])
    
    db.commit()
    
    return {"success": True}


@router.delete("/me/address/{address_id}")
def delete_therapist_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Remove um endereço do terapeuta"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    address = db.query(TherapistAddress).filter(
        TherapistAddress.id == address_id,
        TherapistAddress.therapist_id == therapist.id
    ).first()
    
    if not address:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    
    db.delete(address)
    db.commit()
    
    return {"success": True}


@router.put("/me/address/{address_id}/default")
def set_default_therapist_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Define um endereço como padrão"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Perfil de terapeuta não encontrado")
    
    # Remover padrão de todos
    db.query(TherapistAddress).filter(TherapistAddress.therapist_id == therapist.id).update({"is_default": False})
    
    # Definir o novo padrão
    address = db.query(TherapistAddress).filter(
        TherapistAddress.id == address_id,
        TherapistAddress.therapist_id == therapist.id
    ).first()
    
    if not address:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    
    address.is_default = True
    db.commit()
    
    return {"success": True}


# ==========================
# 🔥 ASSINATURA DO TERAPEUTA - CANCELAR
# ==========================

@router.post("/subscription/cancel", response_model=dict)
def cancel_therapist_subscription(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Cancela a assinatura do terapeuta no Stripe (cancelamento programado para fim do período)
    """
    from app.models.subscription import Subscription
    from app.models.therapist_profile import TherapistProfile
    
    print(f"\n❌ Cancelando assinatura para terapeuta: {current_user.id}")
    
    therapist_profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil do terapeuta não encontrado")
    
    subscription = db.execute(
        select(Subscription).where(Subscription.therapist_id == therapist_profile.id)
    ).scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada")
    
    if not subscription.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="Assinatura não integrada com Stripe")
    
    try:
        import stripe
        from app.core.config import settings
        
        stripe.api_key = settings.stripe_secret_key
        
        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        subscription.cancel_at_period_end = True
        db.commit()
        
        print(f"✅ Assinatura {subscription.stripe_subscription_id} será cancelada ao final do período")
        
        return {
            "success": True,
            "message": "Assinatura cancelada com sucesso. Você voltará ao plano Essencial no fim do período.",
            "will_cancel_at_period_end": True
        }
        
    except Exception as e:
        print(f"❌ Erro ao cancelar assinatura no Stripe: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao cancelar assinatura: {str(e)}")