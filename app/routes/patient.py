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
    """Busca o perfil do paciente ou retorna 404"""
    profile = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    ).scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")
    
    return profile

def save_upload_file(upload_file: UploadFile, user_id: int) -> str:
    """Salva o arquivo de upload e retorna a URL"""
    
    # Validar extensão
    file_ext = os.path.splitext(upload_file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de arquivo não permitido. Use JPG, PNG ou WEBP")
    
    # Validar tamanho (ler conteúdo para verificar)
    file_content = upload_file.file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 5MB")
    
    # Resetar o ponteiro do arquivo
    upload_file.file.seek(0)
    
    # Gerar nome único
    unique_filename = f"patient_{user_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Salvar arquivo
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    # Retornar URL relativa
    return f"/uploads/patients/{unique_filename}"

# ============================================
# PROFILE ENDPOINTS
# ============================================

@router.get("/profile", response_model=PatientProfileOut)
def get_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Retorna o perfil completo do paciente logado
    Cria automaticamente se não existir (igual ao terapeuta)
    """
    print(f"\n📋 GET /patient/profile - Usuário: {current_user.id}")
    
    try:
        # Buscar perfil
        profile = db.execute(
            select(PatientProfile).where(PatientProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        # 🔥 SE NÃO EXISTIR, CRIAR AUTOMATICAMENTE
        if not profile:
            print("👤 Perfil não encontrado, criando perfil padrão...")
            profile = PatientProfile(
                user_id=current_user.id,
                full_name=current_user.full_name or "",
                email=current_user.email,
                timezone="America/Sao_Paulo",
                preferred_language="pt-BR"
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            print(f"✅ Perfil padrão criado: ID {profile.id}")
        
        # Buscar endereços
        addresses = db.execute(
            select(PatientAddress).where(PatientAddress.patient_id == profile.id)
        ).scalars().all()
        
        # Buscar objetivos ativos
        goals = db.execute(
            select(PatientGoal).where(
                PatientGoal.patient_id == profile.id,
                PatientGoal.is_active == True
            )
        ).scalars().all()
        
        # Montar resultado completo
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
    """
    Atualiza os dados do perfil do paciente
    """
    print(f"\n📝 PUT /patient/profile - Usuário: {current_user.id}")
    print(f"📦 Dados recebidos: {profile_data.model_dump(exclude_unset=True)}")
    
    try:
        # Buscar perfil
        profile = get_patient_profile_or_404(db, current_user.id)
        
        # 🔥 TRATAMENTO ESPECIAL PARA CPF VAZIO
        update_data = profile_data.model_dump(exclude_unset=True)
        
        # Se CPF for string vazia, converter para None para evitar violação de unique
        if 'cpf' in update_data and update_data['cpf'] == '':
            update_data['cpf'] = None
        
        for field, value in update_data.items():
            if hasattr(profile, field):
                setattr(profile, field, value)
            else:
                print(f"⚠️ Campo ignorado: {field} não existe no modelo")
        
        profile.updated_at = datetime.now()
        
        db.commit()
        db.refresh(profile)
        
        # Buscar relacionamentos para retornar
        addresses = db.execute(
            select(PatientAddress).where(PatientAddress.patient_id == profile.id)
        ).scalars().all()
        
        goals = db.execute(
            select(PatientGoal).where(
                PatientGoal.patient_id == profile.id,
                PatientGoal.is_active == True
            )
        ).scalars().all()
        
        # Montar resultado completo
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
        
        print(f"✅ Perfil atualizado: ID {profile.id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar perfil: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao atualizar perfil: {str(e)}")

@router.post("/profile/photo", response_model=PatientPhotoResponse)
async def upload_patient_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Faz upload da foto do paciente
    """
    print(f"\n📸 POST /patient/profile/photo - Usuário: {current_user.id}")
    print(f"📦 Arquivo: {file.filename}")
    
    try:
        # Buscar perfil
        profile = get_patient_profile_or_404(db, current_user.id)
        
        # Remover foto antiga se existir
        if profile.foto_url:
            old_file_path = os.path.join(UPLOAD_DIR, os.path.basename(profile.foto_url))
            if os.path.exists(old_file_path):
                os.remove(old_file_path)
                print(f"🗑️ Foto antiga removida: {old_file_path}")
        
        # Salvar nova foto
        foto_url = save_upload_file(file, current_user.id)
        
        # Atualizar perfil
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao fazer upload: {str(e)}")

# ============================================
# COMPLAINT ENDPOINT (QUEIXA DO PACIENTE) - CORRIGIDO
# ============================================

from pydantic import BaseModel

class ComplaintRequest(BaseModel):
    complaint: str

@router.post("/sessions/{appointment_id}/complaint")
def save_patient_complaint(
    appointment_id: int,
    complaint_data: ComplaintRequest,  # 🔥 USAR PYDANTIC MODEL
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Salva a queixa do paciente para uma sessão
    """
    print(f"\n📝 POST /patient/sessions/{appointment_id}/complaint - Usuário: {current_user.id}")
    print(f"📦 Dados recebidos: {complaint_data.complaint}")
    
    complaint = complaint_data.complaint
    
    if not complaint or not complaint.strip():
        print("❌ Nenhuma queixa fornecida no payload")
        raise HTTPException(status_code=400, detail="Queixa é obrigatória")
    
    try:
        # Verificar se o appointment existe e pertence ao paciente
        from app.models.appointment import Appointment
        
        appointment = db.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.patient_user_id == current_user.id
            )
        ).scalar_one_or_none()
        
        if not appointment:
            print(f"❌ Sessão {appointment_id} não encontrada ou não pertence ao paciente {current_user.id}")
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        print(f"✅ Sessão encontrada: ID {appointment.id}, Terapeuta: {appointment.therapist_user_id}")
        
        # Buscar ou criar prontuário
        medical_record = db.execute(
            select(MedicalRecord).where(MedicalRecord.appointment_id == appointment_id)
        ).scalar_one_or_none()
        
        if not medical_record:
            # Criar prontuário com a queixa
            medical_record = MedicalRecord(
                appointment_id=appointment_id,
                patient_reasons=[complaint.strip()],
                session_not_occurred=False
            )
            db.add(medical_record)
            print(f"✅ Novo prontuário criado para sessão {appointment_id}")
        else:
            # Atualizar queixa existente
            current_reasons = medical_record.patient_reasons or []
            if isinstance(current_reasons, str):
                current_reasons = [current_reasons]
            elif not isinstance(current_reasons, list):
                current_reasons = []
            
            # Adicionar nova queixa (evitar duplicatas exatas)
            if complaint.strip() not in current_reasons:
                current_reasons.append(complaint.strip())
            
            medical_record.patient_reasons = current_reasons
            medical_record.updated_at = datetime.now()
            print(f"✅ Prontuário atualizado para sessão {appointment_id}")
        
        db.commit()
        db.refresh(medical_record)
        
        print(f"✅ Queixa salva com sucesso! Total de queixas: {len(medical_record.patient_reasons)}")
        
        # 🔥 Retornar resposta completa
        return {
            "success": True,
            "message": "Queixa registrada com sucesso",
            "appointment_id": appointment_id,
            "complaints": medical_record.patient_reasons
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao salvar queixa: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao salvar queixa: {str(e)}")
    
# ============================================
# GOALS ENDPOINTS
# ============================================

@router.get("/goals/types", response_model=List[GoalTypeOut])
def list_goal_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Lista todos os tipos de objetivo disponíveis
    """
    print(f"\n📋 GET /patient/goals/types - Usuário: {current_user.id}")
    
    try:
        # Buscar todos os tipos de objetivo ativos
        types = db.execute(
            select(GoalType).where(GoalType.is_active == True)
        ).scalars().all()
        
        print(f"✅ Encontrados {len(types)} tipos de objetivo")
        return types
        
    except Exception as e:
        print(f"❌ Erro ao listar tipos de objetivo: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@router.get("/goals", response_model=List[PatientGoalOut])
def list_goals(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Lista os objetivos do paciente
    """
    print(f"\n📋 GET /patient/goals - Usuário: {current_user.id}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        query = select(PatientGoal).where(PatientGoal.patient_id == profile.id)
        if active_only:
            query = query.where(PatientGoal.is_active == True)
        
        goals = db.execute(query).scalars().all()
        
        print(f"✅ Encontrados {len(goals)} objetivos")
        return goals
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao listar objetivos: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao listar objetivos")

@router.post("/goals", response_model=PatientGoalOut, status_code=201)
def create_goal(
    goal_data: PatientGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Adiciona um novo objetivo terapêutico
    """
    print(f"\n📝 POST /patient/goals - Usuário: {current_user.id}")
    print(f"📦 Dados: {goal_data.model_dump()}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        # Verificar se o tipo de objetivo existe (validação)
        goal_type_exists = db.execute(
            select(GoalType).where(GoalType.name == goal_data.goal_type)
        ).scalar_one_or_none()
        
        if not goal_type_exists:
            print(f"⚠️ Tipo de objetivo '{goal_data.goal_type}' não encontrado na tabela goal_types")
            # Não vamos bloquear, apenas avisar
        
        goal = PatientGoal(
            patient_id=profile.id,
            **goal_data.model_dump()
        )
        
        db.add(goal)
        db.commit()
        db.refresh(goal)
        
        print(f"✅ Objetivo criado: ID {goal.id}, tipo: {goal.goal_type}")
        return goal
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao criar objetivo: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao criar objetivo")

@router.put("/goals/{goal_id}", response_model=PatientGoalOut)
def update_goal(
    goal_id: int,
    goal_data: PatientGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Atualiza um objetivo (ex: marcar como concluído)
    """
    print(f"\n📝 PUT /patient/goals/{goal_id} - Usuário: {current_user.id}")
    print(f"📦 Dados: {goal_data.model_dump(exclude_unset=True)}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        goal = db.get(PatientGoal, goal_id)
        if not goal or goal.patient_id != profile.id:
            raise HTTPException(status_code=404, detail="Objetivo não encontrado")
        
        update_data = goal_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(goal, field):
                setattr(goal, field, value)
        
        db.commit()
        db.refresh(goal)
        
        print(f"✅ Objetivo atualizado: ID {goal.id}")
        return goal
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar objetivo: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao atualizar objetivo")

@router.delete("/goals/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Remove um objetivo
    """
    print(f"\n🗑️ DELETE /patient/goals/{goal_id} - Usuário: {current_user.id}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        goal = db.get(PatientGoal, goal_id)
        if not goal or goal.patient_id != profile.id:
            raise HTTPException(status_code=404, detail="Objetivo não encontrado")
        
        db.delete(goal)
        db.commit()
        
        print(f"✅ Objetivo removido: ID {goal_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao remover objetivo: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao remover objetivo")

# ============================================
# ADDRESS ENDPOINTS
# ============================================

@router.get("/profile/address", response_model=List[PatientAddressOut])
def list_addresses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Lista todos os endereços do paciente
    """
    print(f"\n📋 GET /patient/profile/address - Usuário: {current_user.id}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        addresses = db.execute(
            select(PatientAddress).where(PatientAddress.patient_id == profile.id)
        ).scalars().all()
        
        print(f"✅ Encontrados {len(addresses)} endereços")
        return addresses
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao listar endereços: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao listar endereços")

@router.post("/profile/address", response_model=PatientAddressOut, status_code=201)
def create_address(
    address_data: PatientAddressCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Adiciona um novo endereço para o paciente
    """
    print(f"\n📝 POST /patient/profile/address - Usuário: {current_user.id}")
    print(f"📦 Dados: {address_data.model_dump()}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        # Se for default, remover default dos outros
        if address_data.is_default:
            db.execute(
                update(PatientAddress)
                .where(PatientAddress.patient_id == profile.id)
                .values(is_default=False)
            )
        
        # Criar novo endereço
        address = PatientAddress(
            patient_id=profile.id,
            **address_data.model_dump()
        )
        
        db.add(address)
        db.commit()
        db.refresh(address)
        
        print(f"✅ Endereço criado: ID {address.id}")
        return address
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao criar endereço: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao criar endereço")

@router.put("/profile/address/{address_id}", response_model=PatientAddressOut)
def update_address(
    address_id: int,
    address_data: PatientAddressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Atualiza um endereço existente
    """
    print(f"\n📝 PUT /patient/profile/address/{address_id} - Usuário: {current_user.id}")
    print(f"📦 Dados: {address_data.model_dump(exclude_unset=True)}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        # Buscar endereço
        address = db.get(PatientAddress, address_id)
        if not address or address.patient_id != profile.id:
            raise HTTPException(status_code=404, detail="Endereço não encontrado")
        
        # Se for default, remover default dos outros
        if address_data.is_default and not address.is_default:
            db.execute(
                update(PatientAddress)
                .where(PatientAddress.patient_id == profile.id)
                .values(is_default=False)
            )
        
        # Atualizar campos
        update_data = address_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(address, field):
                setattr(address, field, value)
        
        db.commit()
        db.refresh(address)
        
        print(f"✅ Endereço atualizado: ID {address.id}")
        return address
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao atualizar endereço: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao atualizar endereço")

@router.delete("/profile/address/{address_id}", status_code=204)
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.patient))
):
    """
    Remove um endereço
    """
    print(f"\n🗑️ DELETE /patient/profile/address/{address_id} - Usuário: {current_user.id}")
    
    try:
        profile = get_patient_profile_or_404(db, current_user.id)
        
        address = db.get(PatientAddress, address_id)
        if not address or address.patient_id != profile.id:
            raise HTTPException(status_code=404, detail="Endereço não encontrado")
        
        db.delete(address)
        db.commit()
        
        print(f"✅ Endereço removido: ID {address_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao remover endereço: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao remover endereço")