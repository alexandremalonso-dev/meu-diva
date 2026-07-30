import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, update
from typing import List, Optional
import uuid

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.patient_address import PatientAddress
from app.models.patient_goal import PatientGoal
from app.models.goal_types import GoalType
from app.models.medical_record import MedicalRecord

from app.schemas.patient.profile import (
    PatientProfileOut,
    PatientProfileUpdate,
    PatientPhotoResponse
)
from app.schemas.patient.address import (
    PatientAddressCreate,
    PatientAddressUpdate,
    PatientAddressOut
)
from app.schemas.patient.goal import (
    PatientGoalCreate,
    PatientGoalUpdate,
    PatientGoalOut,
    GoalTypeOut
)
from app.schemas.medical_record import MedicalRecordOut

# Configuração de upload
UPLOAD_DIR = "uploads/patients"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

router = APIRouter(prefix="/patient", tags=["patient"])

# ============================================
# HELPERS
# ============================================
def get_patient_profile_or_404(db: Session, user_id: int) -> PatientProfile:
    profile = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")
    return profile

def save_upload_file(upload_file: UploadFile, user_id: int) -> str:
    file_ext = os.path.splitext(upload_file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de arquivo não permitido. Use JPG, PNG ou WEBP")
    file_content = upload_file.file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 5MB")
    upload_file.file.seek(0)
    unique_filename = f"patient_{user_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    backend_url = os.getenv("BACKEND_URL", "https://api.meudivaonline.com")
    return f"{backend_url}/uploads/patients/{unique_filename}"

# ============================================
# PROFILE ENDPOINTS
# ============================================

@router.get("/profile", response_model=PatientProfileOut)
def get_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    print(f"\n📋 GET /patient/profile - Usuário: {current_user.id}")
    try:
        profile = db.execute(
            select(PatientProfile).where(PatientProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if not profile:
            print("👤 Perfil não encontrado, criando perfil padrão...")
            user_full_name = current_user.full_name
            profile = PatientProfile(
                user_id=current_user.id,
                full_name=user_full_name or "",
                email=current_user.email,
                timezone="America/Sao_Paulo",
                preferred_language="pt-BR"
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

            if profile.full_name and not current_user.full_name:
                db.execute(
                    update(User)
                    .where(User.id == current_user.id)
                    .values(full_name=profile.full_name)
                )
                db.commit()
                print(f"✅ Nome sincronizado de patient_profile para users: {profile.full_name}")

            print(f"✅ Perfil padrão criado: ID {profile.id}")

            # 🔥 Criar wallet automaticamente para o novo paciente
            from app.models.wallet import Wallet
            existing_wallet = db.execute(select(Wallet).where(Wallet.patient_id == profile.id)).scalar_one_or_none()
            if not existing_wallet:
                db.add(Wallet(patient_id=profile.id, balance=0))
                db.commit()
                print(f"✅ Wallet criada automaticamente para paciente: {profile.id}")

        addresses = db.execute(
            select(PatientAddress).where(PatientAddress.patient_id == profile.id)
        ).scalars().all()

        goals = db.execute(
            select(PatientGoal).where(
                PatientGoal.patient_id == profile.id,
                PatientGoal.is_active == True
            )
        ).scalars().all()

        result = {
            "id": profile.id,
            "user_id": profile.user_id,
            "full_name": profile.full_name,
            "email": profile.email,
            "phone": profile.phone,
            "cpf": profile.cpf,
            "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
            "education_level": profile.education_level,
            "foto_url": profile.foto_url,
            "timezone": profile.timezone,
            "preferred_language": profile.preferred_language,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at,
            "addresses": addresses,
            "goals": goals
        }

        print(f"✅ Perfil encontrado/criado: ID {profile.id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao buscar perfil: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao buscar perfil: {str(e)}")

@router.put("/profile", response_model=PatientProfileOut)
def update_patient_profile(
    profile_data: PatientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    print(f"\n📝 PUT /patient/profile - Usuário: {current_user.id}")
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        update_data = profile_data.model_dump(exclude_unset=True)
        if 'cpf' in update_data and update_data['cpf'] == '':
            update_data['cpf'] = None
        name_updated = False
        new_name = None
        for field, value in update_data.items():
            if hasattr(profile, field):
                setattr(profile, field, value)
                if field == 'full_name' and value:
                    name_updated = True
                    new_name = value
        profile.updated_at = datetime.now()
        db.commit()
        db.refresh(profile)
        if name_updated and new_name:
            db.execute(update(User).where(User.id == current_user.id).values(full_name=new_name))
            db.commit()
            print(f"✅ Nome sincronizado com tabela users: {new_name}")
        addresses = db.execute(select(PatientAddress).where(PatientAddress.patient_id == profile.id)).scalars().all()
        goals = db.execute(select(PatientGoal).where(PatientGoal.patient_id == profile.id, PatientGoal.is_active == True)).scalars().all()
        result = {
            "id": profile.id, "user_id": profile.user_id, "full_name": profile.full_name,
            "email": profile.email, "phone": profile.phone, "cpf": profile.cpf,
            "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
            "education_level": profile.education_level, "foto_url": profile.foto_url,
            "timezone": profile.timezone, "preferred_language": profile.preferred_language,
            "created_at": profile.created_at, "updated_at": profile.updated_at,
            "addresses": addresses, "goals": goals
        }
        print(f"✅ Perfil atualizado: ID {profile.id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar perfil: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao atualizar perfil: {str(e)}")

@router.post("/profile/photo", response_model=PatientPhotoResponse)
async def upload_patient_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    print(f"\n📸 POST /patient/profile/photo - Usuário: {current_user.id}")
    print(f"📦 Arquivo: {file.filename}")
    try:
        from app.core.storage import StorageService
        storage_service = StorageService()
        profile = get_patient_profile_or_404(db, current_user.id)
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Formato não permitido. Use JPG, PNG ou WEBP")
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 5MB")
        foto_url = storage_service.upload_file(
            file_content=file_content,
            folder="patients",
            content_type=file.content_type or "image/jpeg"
        )
        profile.foto_url = foto_url
        profile.updated_at = datetime.now()
        db.commit()
        print(f"✅ Foto salva: {foto_url}")
        return PatientPhotoResponse(foto_url=foto_url)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao fazer upload: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao fazer upload: {str(e)}")

# ============================================
# COMPLAINT ENDPOINT
# ============================================

from pydantic import BaseModel

class ComplaintRequest(BaseModel):
    complaint: str

@router.post("/sessions/{appointment_id}/complaint")
def save_patient_complaint(
    appointment_id: int,
    complaint_data: ComplaintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    print(f"\n📝 POST /patient/sessions/{appointment_id}/complaint - Usuário: {current_user.id}")
    complaint = complaint_data.complaint
    if not complaint or not complaint.strip():
        raise HTTPException(status_code=400, detail="Queixa é obrigatória")
    try:
        from app.models.appointment import Appointment
        appointment = db.execute(
            select(Appointment).where(Appointment.id == appointment_id, Appointment.patient_user_id == current_user.id)
        ).scalar_one_or_none()
        if not appointment:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        medical_record = db.execute(select(MedicalRecord).where(MedicalRecord.appointment_id == appointment_id)).scalar_one_or_none()
        if not medical_record:
            medical_record = MedicalRecord(appointment_id=appointment_id, patient_reasons=[complaint.strip()], session_not_occurred=False)
            db.add(medical_record)
        else:
            current_reasons = medical_record.patient_reasons or []
            if isinstance(current_reasons, str): current_reasons = [current_reasons]
            elif not isinstance(current_reasons, list): current_reasons = []
            if complaint.strip() not in current_reasons: current_reasons.append(complaint.strip())
            medical_record.patient_reasons = current_reasons
            medical_record.updated_at = datetime.now()
        db.commit()
        db.refresh(medical_record)
        return {"success": True, "message": "Queixa registrada com sucesso", "appointment_id": appointment_id, "complaints": medical_record.patient_reasons}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao salvar queixa: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao salvar queixa: {str(e)}")

# ============================================
# GOALS ENDPOINTS
# ============================================

@router.get("/goals/types", response_model=List[GoalTypeOut])
def list_goal_types(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        types = db.execute(select(GoalType).where(GoalType.is_active == True)).scalars().all()
        return types
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.get("/goals", response_model=List[PatientGoalOut])
def list_goals(active_only: bool = True, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        query = select(PatientGoal).where(PatientGoal.patient_id == profile.id)
        if active_only: query = query.where(PatientGoal.is_active == True)
        return db.execute(query).scalars().all()
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro interno ao listar objetivos")

@router.post("/goals", response_model=PatientGoalOut, status_code=201)
def create_goal(goal_data: PatientGoalCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        goal = PatientGoal(patient_id=profile.id, **goal_data.model_dump())
        db.add(goal); db.commit(); db.refresh(goal)
        return goal
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao criar objetivo")

@router.put("/goals/{goal_id}", response_model=PatientGoalOut)
def update_goal(goal_id: int, goal_data: PatientGoalUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        goal = db.get(PatientGoal, goal_id)
        if not goal or goal.patient_id != profile.id: raise HTTPException(status_code=404, detail="Objetivo não encontrado")
        for field, value in goal_data.model_dump(exclude_unset=True).items():
            if hasattr(goal, field): setattr(goal, field, value)
        db.commit(); db.refresh(goal)
        return goal
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao atualizar objetivo")

@router.delete("/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        goal = db.get(PatientGoal, goal_id)
        if not goal or goal.patient_id != profile.id: raise HTTPException(status_code=404, detail="Objetivo não encontrado")
        db.delete(goal); db.commit()
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao remover objetivo")

# ============================================
# ADDRESS ENDPOINTS
# ============================================

@router.get("/profile/address", response_model=List[PatientAddressOut])
def list_addresses(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        return db.execute(select(PatientAddress).where(PatientAddress.patient_id == profile.id)).scalars().all()
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro interno ao listar endereços")

@router.post("/profile/address", response_model=PatientAddressOut, status_code=201)
def create_address(address_data: PatientAddressCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        if address_data.is_default:
            db.execute(update(PatientAddress).where(PatientAddress.patient_id == profile.id).values(is_default=False))
        address = PatientAddress(patient_id=profile.id, **address_data.model_dump())
        db.add(address); db.commit(); db.refresh(address)
        return address
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao criar endereço")

@router.put("/profile/address/{address_id}", response_model=PatientAddressOut)
def update_address(address_id: int, address_data: PatientAddressUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        address = db.get(PatientAddress, address_id)
        if not address or address.patient_id != profile.id: raise HTTPException(status_code=404, detail="Endereço não encontrado")
        if address_data.is_default and not address.is_default:
            db.execute(update(PatientAddress).where(PatientAddress.patient_id == profile.id).values(is_default=False))
        for field, value in address_data.model_dump(exclude_unset=True).items():
            if hasattr(address, field): setattr(address, field, value)
        db.commit(); db.refresh(address)
        return address
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao atualizar endereço")

@router.delete("/profile/address/{address_id}", status_code=204)
def delete_address(address_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        address = db.get(PatientAddress, address_id)
        if not address or address.patient_id != profile.id: raise HTTPException(status_code=404, detail="Endereço não encontrado")
        db.delete(address); db.commit()
    except HTTPException: raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erro interno ao remover endereço")

# ============================================
# FAVORITOS
# ============================================

from app.models.patient_favorite import PatientFavorite
from app.models.therapist_profile import TherapistProfile

@router.post("/favorites/{therapist_profile_id}", status_code=201)
def add_favorite(therapist_profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    profile = get_patient_profile_or_404(db, current_user.id)
    therapist = db.get(TherapistProfile, therapist_profile_id)
    if not therapist: raise HTTPException(status_code=404, detail="Terapeuta não encontrado")
    existing = db.execute(select(PatientFavorite).where(PatientFavorite.patient_id == profile.id, PatientFavorite.therapist_id == therapist_profile_id)).scalar_one_or_none()
    if existing: return {"is_favorite": True, "message": "Já está nos favoritos"}
    db.add(PatientFavorite(patient_id=profile.id, therapist_id=therapist_profile_id)); db.commit()
    return {"is_favorite": True, "message": "Adicionado aos favoritos"}

@router.delete("/favorites/{therapist_profile_id}", status_code=200)
def remove_favorite(therapist_profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    profile = get_patient_profile_or_404(db, current_user.id)
    favorite = db.execute(select(PatientFavorite).where(PatientFavorite.patient_id == profile.id, PatientFavorite.therapist_id == therapist_profile_id)).scalar_one_or_none()
    if not favorite: return {"is_favorite": False, "message": "Não estava nos favoritos"}
    db.delete(favorite); db.commit()
    return {"is_favorite": False, "message": "Removido dos favoritos"}

@router.get("/favorites/{therapist_profile_id}")
def check_favorite(therapist_profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    profile = get_patient_profile_or_404(db, current_user.id)
    existing = db.execute(select(PatientFavorite).where(PatientFavorite.patient_id == profile.id, PatientFavorite.therapist_id == therapist_profile_id)).scalar_one_or_none()
    return {"is_favorite": existing is not None}

@router.get("/favorites")
def list_favorites(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.patient))):
    profile = get_patient_profile_or_404(db, current_user.id)
    favorites = db.execute(select(PatientFavorite).where(PatientFavorite.patient_id == profile.id)).scalars().all()
    therapist_ids = [f.therapist_id for f in favorites]
    therapists = db.execute(select(TherapistProfile).where(TherapistProfile.id.in_(therapist_ids))).scalars().all()
    return [{"id": t.id, "user_id": t.user_id, "full_name": t.full_name, "foto_url": t.foto_url, "specialties": t.specialties, "session_price": t.session_price, "rating": t.rating} for t in therapists]
