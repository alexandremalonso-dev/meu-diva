from fastapi import APIRouter, Depends, HTTPException, Security, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from datetime import datetime
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_document import TherapistDocument

router = APIRouter(prefix="/therapist/documents", tags=["therapist"])

UPLOAD_DIR = "uploads/therapist_documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Terapeuta envia documento para validação"""
    
    print(f"📄 Upload recebido: type={document_type}, file={file.filename}")
    
    if document_type not in ["diploma", "registration"]:
        raise HTTPException(status_code=400, detail="Tipo de documento inválido")
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos")
    
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    # Salvar arquivo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"therapist_{therapist_profile.id}_{document_type}_{timestamp}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    # Verificar se já existe documento do mesmo tipo
    existing = db.query(TherapistDocument).filter(
        TherapistDocument.therapist_id == therapist_profile.id,
        TherapistDocument.document_type == document_type
    ).first()
    
    if existing:
        old_path = os.path.join(UPLOAD_DIR, existing.document_url.split("/")[-1])
        if os.path.exists(old_path):
            os.remove(old_path)
        db.delete(existing)
    
    # Criar registro
    doc = TherapistDocument(
        therapist_id=therapist_profile.id,
        document_type=document_type,
        document_url=f"/uploads/therapist_documents/{filename}",
        original_filename=file.filename,
        validation_status="pending"
    )
    db.add(doc)
    
    # Atualizar status do terapeuta
    therapist_profile.validation_status = "pending"
    
    db.commit()
    
    print(f"✅ Documento salvo: {file_path}")
    
    return {
        "success": True,
        "message": f"Documento {document_type} enviado com sucesso."
    }


@router.get("/status")
async def get_document_status(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """Retorna o status dos documentos do terapeuta"""
    
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == current_user.id
    ).first()
    
    if not therapist_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    documents = db.query(TherapistDocument).filter(
        TherapistDocument.therapist_id == therapist_profile.id
    ).all()
    
    result = {
        "validation_status": therapist_profile.validation_status,
        "is_verified": therapist_profile.is_verified,
        "documents": [
            {
                "id": doc.id,
                "type": doc.document_type,
                "filename": doc.original_filename,
                "url": doc.document_url,
                "uploaded_at": doc.uploaded_at,
                "validation_status": doc.validation_status,
                "rejection_reason": doc.rejection_reason if hasattr(doc, 'rejection_reason') else None
            }
            for doc in documents
        ]
    }
    
    return result