from fastapi import APIRouter, Depends, HTTPException, Security, Request
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_document import TherapistDocument
from app.models.therapist_validation import TherapistValidation
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/admin/therapists", tags=["admin"])


@router.get("/pending-validation")
async def get_pending_therapists(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Lista terapeutas com documentos (todos os status)"""
    
    # Buscar TODOS os documentos (não apenas pendentes)
    all_docs = db.query(TherapistDocument).all()
    
    # Agrupar por terapeuta
    therapists_map = {}
    for doc in all_docs:
        therapist = doc.therapist
        if therapist.id not in therapists_map:
            therapists_map[therapist.id] = {
                "id": therapist.id,
                "user_id": therapist.user_id,
                "name": therapist.full_name,
                "email": therapist.user.email if therapist.user else None,
                "validation_status": therapist.validation_status,
                "documents": []
            }
        therapists_map[therapist.id]["documents"].append({
            "id": doc.id,
            "type": doc.document_type,
            "url": doc.document_url,
            "filename": doc.original_filename,
            "validation_status": doc.validation_status,
            "uploaded_at": doc.uploaded_at,
            "rejection_reason": doc.rejection_reason if hasattr(doc, 'rejection_reason') else None
        })
    
    return list(therapists_map.values())


@router.post("/validate-document/{document_id}")
async def validate_document(
    document_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Admin aprova/reprova/solicita reenvio de um documento específico"""
    
    body = await request.json()
    status = body.get("status")
    rejection_reason = body.get("rejection_reason")
    
    print(f"📝 Validando documento {document_id} - Status: {status}")
    
    if status not in ["approved", "rejected", "need_reupload"]:
        raise HTTPException(status_code=400, detail="Status inválido")
    
    document = db.query(TherapistDocument).filter(
        TherapistDocument.id == document_id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    
    # Atualizar documento
    document.validation_status = status
    document.validated_by = current_user.id
    document.validated_at = datetime.now()
    if rejection_reason:
        document.rejection_reason = rejection_reason
    
    db.commit()
    
    # Verificar se todos os documentos do terapeuta estão aprovados
    therapist = document.therapist
    all_docs = db.query(TherapistDocument).filter(
        TherapistDocument.therapist_id == therapist.id
    ).all()
    
    all_approved = all(doc.validation_status == "approved" for doc in all_docs)
    has_rejected = any(doc.validation_status == "rejected" for doc in all_docs)
    has_pending = any(doc.validation_status == "pending" for doc in all_docs)
    
    # Atualizar status geral do terapeuta
    if all_approved:
        therapist.validation_status = "approved"
        therapist.is_verified = True
    elif has_rejected:
        therapist.validation_status = "rejected"
        therapist.is_verified = False
    elif has_pending:
        therapist.validation_status = "pending"
        therapist.is_verified = False
    else:
        therapist.validation_status = "pending"
        therapist.is_verified = False
    
    db.commit()
    
    # Notificar terapeuta
    therapist_user = db.query(User).filter(User.id == therapist.user_id).first()
    notification_service = NotificationService(db)
    
    doc_type_name = "Diploma" if document.document_type == "diploma" else "Registro Profissional"
    
    if status == "approved":
        title = f"Documento aprovado: {doc_type_name}"
        message = f"Seu documento {doc_type_name} foi aprovado!"
        action_link = "/therapist/documents"
    elif status == "rejected":
        title = f"Documento reprovado: {doc_type_name}"
        message = f"Seu documento {doc_type_name} foi reprovado. Motivo: {rejection_reason}"
        action_link = "/therapist/documents"
    else:  # need_reupload
        title = f"Reenvio solicitado: {doc_type_name}"
        message = f"Seu documento {doc_type_name} está ilegível. Por favor, envie uma nova cópia."
        action_link = "/therapist/documents"
    
    notification_service.create_notification(
        user_id=therapist_user.id,
        notification_type="document_validation",
        title=title,
        message=message,
        action_link=action_link
    )
    
    return {
        "success": True,
        "message": f"Documento {doc_type_name} {status} com sucesso.",
        "therapist_status": therapist.validation_status
    }