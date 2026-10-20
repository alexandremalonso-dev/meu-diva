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


def _avisar_admins_documento_enviado(db, therapist_user, profile_id: int, document_type: str):
    """🔔 Avisa cada admin ativo (no sino) que há documento para validar.
    Agrupa por terapeuta: se já existe um aviso NÃO lido deste terapeuta, atualiza em vez de criar outro.
    Quem chama protege com try/except: um erro aqui nunca pode derrubar o envio do documento."""
    from datetime import datetime as _dt
    from app.services import notification_service as _ns
    NotificationService = _ns.NotificationService
    Notification = getattr(_ns, "Notification", None)
    if Notification is None:
        from app.models.notification import Notification
    nomes = {"diploma": "o diploma", "registration": "o registro profissional"}
    nome = getattr(therapist_user, "full_name", None) or getattr(therapist_user, "email", None) or "Um terapeuta"
    servico = NotificationService(db)
    admins = db.query(User).filter(User.role == UserRole.admin, User.is_active == True).all()
    for admin in admins:
        abertos = db.query(Notification).filter(
            Notification.user_id == admin.id,
            Notification.type == "document_submitted",
            Notification.is_read == False
        ).all()
        atual = next((n for n in abertos if isinstance(n.data, dict) and n.data.get("therapist_id") == profile_id), None)
        tipos = [document_type]
        if atual is not None:
            tipos = sorted(set(list(atual.data.get("document_types") or []) + [document_type]))
        texto = f"{nome} enviou {' e '.join(nomes.get(t, t) for t in tipos)} para validação."
        dados = {"therapist_id": profile_id, "therapist_user_id": therapist_user.id, "document_types": tipos}
        if atual is not None:
            atual.message = texto
            atual.data = dados
            atual.created_at = _dt.utcnow()
            db.commit()
        else:
            servico.create_notification(
                user_id=admin.id,
                notification_type="document_submitted",
                title="Documentos para validação",
                message=texto,
                data=dados,
                action_link="/admin/therapists/validation"
            )


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

    # 🔥 Se já existe documento do mesmo tipo, atualizar em vez de inserir
    existing = db.query(TherapistDocument).filter(
        TherapistDocument.therapist_id == therapist_profile.id,
        TherapistDocument.document_type == document_type
    ).first()

    if existing:
        # Remove arquivo antigo do disco
        old_path = os.path.join(UPLOAD_DIR, existing.document_url.split("/")[-1])
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception as e:
                print(f"⚠️ Não foi possível remover arquivo antigo: {e}")

        # 🔥 Atualiza o registro existente em vez de deletar e inserir
        existing.document_url = f"/uploads/therapist_documents/{filename}"
        existing.original_filename = file.filename
        existing.validation_status = "pending"
        existing.validated_by = None
        existing.validated_at = None
        existing.rejection_reason = None
        existing.uploaded_at = datetime.now()
        db.commit()
        db.refresh(existing)

        print(f"✅ Documento atualizado: {file_path}")
    else:
        # Cria novo registro
        doc = TherapistDocument(
            therapist_id=therapist_profile.id,
            document_type=document_type,
            document_url=f"/uploads/therapist_documents/{filename}",
            original_filename=file.filename,
            validation_status="pending"
        )
        db.add(doc)
        db.commit()

        print(f"✅ Documento criado: {file_path}")

    # Atualizar status do terapeuta para pendente
    therapist_profile.validation_status = "pending"
    db.commit()

    # 🔔 Avisa os admins (sino) que há documento para validar. Nunca derruba o envio se a notificação falhar.
    try:
        _avisar_admins_documento_enviado(db, current_user, therapist_profile.id, document_type)
    except Exception as e:
        print(f"⚠️ Não foi possível avisar os admins sobre o documento enviado: {e}")
        try:
            db.rollback()
        except Exception:
            pass

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