from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_documento import EmpresaDocumento

router = APIRouter(prefix="/empresa/documents", tags=["Empresa Documents"])


@router.get("")
def get_empresa_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna a lista de documentos da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    documentos = db.query(EmpresaDocumento).filter(
        EmpresaDocumento.empresa_id == empresa.id
    ).order_by(EmpresaDocumento.created_at.desc()).all()
    
    return [
        {
            "id": doc.id,
            "type": doc.type,
            "url": doc.url,
            "filename": doc.filename,
            "validation_status": doc.validation_status,
            "rejection_reason": doc.rejection_reason,
            "uploaded_at": doc.created_at.isoformat() if doc.created_at else None
        }
        for doc in documentos
    ]


@router.post("/upload")
async def upload_empresa_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload de documento da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # Criar diretório se não existir
    upload_dir = f"uploads/empresas/{empresa.id}/documentos"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Gerar nome único
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_filename = f"{document_type}_{timestamp}_{file.filename}"
    filepath = os.path.join(upload_dir, safe_filename)
    
    # Salvar arquivo
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    url = f"/{filepath}"
    
    # Salvar no banco
    novo_documento = EmpresaDocumento(
        empresa_id=empresa.id,
        type=document_type,
        url=url,
        filename=file.filename,
        validation_status="pending"
    )
    db.add(novo_documento)
    db.commit()
    db.refresh(novo_documento)
    
    return {
        "success": True,
        "message": "Documento enviado com sucesso",
        "document": {
            "id": novo_documento.id,
            "type": novo_documento.type,
            "filename": novo_documento.filename,
            "validation_status": novo_documento.validation_status
        }
    }