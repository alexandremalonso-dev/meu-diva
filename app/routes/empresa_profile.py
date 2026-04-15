from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional, List
import shutil
import os
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile

router = APIRouter(prefix="/empresa/profile", tags=["Empresa Profile"])


@router.get("/me")
def get_empresa_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna o perfil da empresa do usuário logado"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not profile:
        # Criar perfil básico se não existir
        profile = EmpresaProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or "",
            corporate_name=current_user.full_name or ""
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.full_name,
        "phone": profile.phone,
        "cnpj": profile.cnpj,
        "corporate_name": profile.corporate_name,
        "trading_name": profile.trading_name,
        "state_registration": profile.state_registration,
        "municipal_registration": profile.municipal_registration,
        "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
        "education_level": profile.education_level,
        "foto_url": profile.foto_url,
        "department": profile.department,
        "position": profile.position,
        "cpf": profile.cpf,
        "responsible_email": profile.responsible_email,
        "responsible_phone": profile.responsible_phone,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        "lgpd_consent": profile.lgpd_consent,
        "lgpd_consent_date": profile.lgpd_consent_date.isoformat() if profile.lgpd_consent_date else None
    }


@router.post("/me")
def update_empresa_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza o perfil da empresa do usuário logado"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not profile:
        profile = EmpresaProfile(
            user_id=current_user.id,
            full_name=profile_data.get("full_name", current_user.full_name or "")
        )
        db.add(profile)
    
    # Atualizar campos
    fields = ["full_name", "phone", "cnpj", "corporate_name", "trading_name", 
              "state_registration", "municipal_registration", "birth_date", 
              "education_level", "foto_url", "department", "position", 
              "cpf", "responsible_email", "responsible_phone", "lgpd_consent"]
    
    for field in fields:
        if field in profile_data and profile_data[field] is not None:
            if field == "birth_date" and profile_data[field]:
                setattr(profile, field, datetime.strptime(profile_data[field], "%Y-%m-%d").date())
            elif field == "lgpd_consent":
                setattr(profile, field, profile_data[field])
                if profile_data[field] and not profile.lgpd_consent_date:
                    setattr(profile, "lgpd_consent_date", datetime.now())
            else:
                setattr(profile, field, profile_data[field])
    
    db.commit()
    db.refresh(profile)
    
    return {"message": "Perfil atualizado com sucesso"}


@router.post("/upload-foto")
async def upload_empresa_foto(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload da logo/foto da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    # Criar diretório se não existir
    upload_dir = "uploads/empresas"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Gerar nome único
    extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"empresa_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extension}"
    filepath = os.path.join(upload_dir, filename)
    
    # Salvar arquivo
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    foto_url = f"/{filepath}"
    
    # Atualizar perfil
    profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if profile:
        profile.foto_url = foto_url
        db.commit()
    else:
        profile = EmpresaProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or "",
            foto_url=foto_url
        )
        db.add(profile)
        db.commit()
    
    return {"foto_url": foto_url}


# ==========================
# ENDPOINTS PARA DOCUMENTOS DA EMPRESA
# ==========================

@router.get("/documents")
def get_empresa_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna a lista de documentos da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    # Por enquanto retorna lista vazia
    return []


@router.post("/documents/upload")
async def upload_empresa_document(
    file: UploadFile = File(...),
    document_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload de documento da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    # Por enquanto retorna placeholder
    return {"success": True, "message": "Documento enviado com sucesso", "document": {"id": 1, "type": document_type, "filename": file.filename, "validation_status": "pending"}}


# ==========================
# ENDPOINTS PARA ENDEREÇOS DA EMPRESA
# ==========================

@router.get("/enderecos")
def get_empresa_enderecos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna a lista de endereços da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    # Por enquanto retorna lista vazia
    return []


@router.post("/lgpd")
def update_lgpd_consent(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza o consentimento LGPD da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not profile:
        profile = EmpresaProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or ""
        )
        db.add(profile)
    
    profile.lgpd_consent = data.get("consent", False)
    if profile.lgpd_consent and not profile.lgpd_consent_date:
        profile.lgpd_consent_date = datetime.now()
    
    db.commit()
    
    return {"success": True, "message": "Preferências de privacidade atualizadas"}