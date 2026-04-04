from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
import os
import shutil
import uuid

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.admin_profile import AdminProfile
from app.schemas.admin_profile import AdminProfileCreate, AdminProfileUpdate, AdminProfileOut

# Configuração de upload
UPLOAD_DIR = "uploads/admins"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

router = APIRouter(prefix="/admin/profile", tags=["admin"])


def save_upload_file(upload_file: UploadFile, user_id: int) -> str:
    """Salva o arquivo de upload e retorna a URL"""
    
    # Validar extensão
    file_ext = os.path.splitext(upload_file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de arquivo não permitido. Use JPG, PNG, GIF ou WEBP")
    
    # Ler conteúdo para validar tamanho
    file_content = upload_file.file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 5MB")
    
    # Resetar o ponteiro do arquivo
    upload_file.file.seek(0)
    
    # Gerar nome único
    unique_filename = f"admin_{user_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Salvar arquivo
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    # Retornar URL relativa
    return f"/uploads/admins/{unique_filename}"


@router.get("/me", response_model=AdminProfileOut)
def get_my_admin_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Retorna o perfil do admin logado"""
    profile = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    
    if not profile:
        # Criar perfil padrão se não existir
        profile = AdminProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or current_user.email,
            created_at=datetime.now()
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    return profile


@router.post("/me", response_model=AdminProfileOut)
def upsert_admin_profile(
    profile_data: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Cria ou atualiza o perfil do admin"""
    
    profile = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    
    if not profile:
        # Criar novo perfil
        profile = AdminProfile(
            user_id=current_user.id,
            full_name=profile_data.full_name or current_user.full_name or current_user.email,
            phone=profile_data.phone,
            cpf=profile_data.cpf,
            birth_date=profile_data.birth_date,
            education_level=profile_data.education_level,
            foto_url=profile_data.foto_url,
            department=profile_data.department,
            position=profile_data.position
        )
        db.add(profile)
    else:
        # Atualizar perfil existente
        if profile_data.full_name is not None:
            profile.full_name = profile_data.full_name
        if profile_data.phone is not None:
            profile.phone = profile_data.phone
        if profile_data.cpf is not None:
            profile.cpf = profile_data.cpf
        if profile_data.birth_date is not None:
            profile.birth_date = profile_data.birth_date
        if profile_data.education_level is not None:
            profile.education_level = profile_data.education_level
        if profile_data.foto_url is not None:
            profile.foto_url = profile_data.foto_url
        if profile_data.department is not None:
            profile.department = profile_data.department
        if profile_data.position is not None:
            profile.position = profile_data.position
        profile.updated_at = datetime.now()
    
    db.commit()
    db.refresh(profile)
    
    return profile


@router.post("/upload-foto")
async def upload_admin_foto(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """
    Faz upload da foto de perfil do administrador
    """
    print(f"\n📸 POST /api/admin/profile/upload-foto - Usuário: {current_user.id}")
    print(f"📦 Arquivo: {file.filename}")
    
    try:
        # Buscar perfil
        profile = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
        
        if not profile:
            # Criar perfil padrão se não existir
            profile = AdminProfile(
                user_id=current_user.id,
                full_name=current_user.full_name or current_user.email,
                created_at=datetime.now()
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        
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
        return {"success": True, "foto_url": foto_url}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao fazer upload: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao fazer upload: {str(e)}")


@router.delete("/foto")
def delete_admin_foto(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """
    Remove a foto de perfil do administrador
    """
    print(f"\n🗑️ DELETE /api/admin/profile/foto - Usuário: {current_user.id}")
    
    try:
        profile = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Perfil não encontrado")
        
        # Remover arquivo
        if profile.foto_url:
            file_path = os.path.join(UPLOAD_DIR, os.path.basename(profile.foto_url))
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"🗑️ Foto removida: {file_path}")
        
        # Limpar URL no banco
        profile.foto_url = None
        profile.updated_at = datetime.now()
        db.commit()
        
        return {"success": True, "message": "Foto removida com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao remover foto: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno ao remover foto: {str(e)}")

@router.post("/me", response_model=AdminProfileOut)
def upsert_admin_profile(
    profile_data: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Cria ou atualiza o perfil do admin"""
    
    profile = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    
    if not profile:
        # Criar novo perfil
        profile = AdminProfile(
            user_id=current_user.id,
            full_name=profile_data.full_name or current_user.full_name or current_user.email,
            phone=profile_data.phone,
            cpf=profile_data.cpf,
            birth_date=profile_data.birth_date,
            education_level=profile_data.education_level,
            foto_url=profile_data.foto_url,
            department=profile_data.department,
            position=profile_data.position
        )
        db.add(profile)
    else:
        # Atualizar perfil existente
        if profile_data.full_name is not None:
            profile.full_name = profile_data.full_name
        if profile_data.phone is not None:
            profile.phone = profile_data.phone
        if profile_data.cpf is not None:
            profile.cpf = profile_data.cpf
        if profile_data.birth_date is not None:
            profile.birth_date = profile_data.birth_date
        if profile_data.education_level is not None:
            profile.education_level = profile_data.education_level
        if profile_data.foto_url is not None:
            profile.foto_url = profile_data.foto_url
        if profile_data.department is not None:
            profile.department = profile_data.department
        if profile_data.position is not None:
            profile.position = profile_data.position
        profile.updated_at = datetime.now()
    
    db.commit()
    db.refresh(profile)
    
    return profile