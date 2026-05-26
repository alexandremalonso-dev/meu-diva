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
from app.services.email_service import email_service

router = APIRouter(prefix="/admin/therapists", tags=["admin"])


@router.get("/pending-validation")
async def get_pending_therapists(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Lista terapeutas com documentos (todos os status)"""

    all_docs = db.query(TherapistDocument).all()

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
        therapist.verified = True  # 🔥 sincroniza com o campo usado no frontend
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

    # Notificar terapeuta via sistema de notificações
    therapist_user = db.query(User).filter(User.id == therapist.user_id).first()
    notification_service = NotificationService(db)

    doc_type_name = "Diploma" if document.document_type == "diploma" else "Registro Profissional"

    if status == "approved":
        title = f"Documento aprovado: {doc_type_name}"
        message = f"Seu documento {doc_type_name} foi aprovado!"
        action_link = "/therapist/documents/required"
    elif status == "rejected":
        title = f"Documento reprovado: {doc_type_name}"
        message = f"Seu documento {doc_type_name} foi reprovado. Motivo: {rejection_reason}"
        action_link = "/therapist/documents/required"
    else:  # need_reupload
        title = f"Reenvio solicitado: {doc_type_name}"
        message = f"Seu documento {doc_type_name} está ilegível. Por favor, envie uma nova cópia."
        action_link = "/therapist/documents/required"

    notification_service.create_notification(
        user_id=therapist_user.id,
        notification_type="document_validation",
        title=title,
        message=message,
        action_link=action_link
    )

    # 🔥 NOTIFICAÇÃO POR E-MAIL
    if therapist_user and therapist_user.email:
        try:
            nome = therapist.full_name or therapist_user.full_name or "Terapeuta"
            logo_url = "https://meudivaonline.com/wp-content/uploads/favicon-meudiva.png"
            app_url = "https://app.meudivaonline.com"

            if status == "approved":
                # E-mail de aprovação — verde, celebratório
                # Verifica se TODOS os documentos foram aprovados para o e-mail de perfil completo
                if all_approved:
                    subject = "✅ Perfil verificado! Você recebeu o selo de Terapeuta Verificado"
                    titulo_email = "Parabéns! Seu perfil foi verificado ✅"
                    corpo = f"""
                        <p style="color:#555;line-height:1.6;margin:0 0 16px;">
                            Todos os seus documentos foram analisados e <strong>aprovados</strong> pela nossa equipe.
                        </p>
                        <p style="color:#555;line-height:1.6;margin:0 0 20px;">
                            Você agora possui o <strong>Selo de Terapeuta Verificado ✅</strong> no seu perfil,
                            o que aumenta a confiança dos pacientes e suas chances de agendamento.
                        </p>
                        <div style="background:#f0fdf4;border-left:4px solid #16A34A;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                            <p style="color:#16A34A;font-weight:700;margin:0 0 8px;">✅ Documento aprovado:</p>
                            <p style="color:#555;margin:0;">{doc_type_name}</p>
                        </div>
                    """
                else:
                    subject = f"✅ Documento aprovado: {doc_type_name} — Meu Divã"
                    titulo_email = f"Documento aprovado: {doc_type_name} ✅"
                    corpo = f"""
                        <p style="color:#555;line-height:1.6;margin:0 0 16px;">
                            Seu documento <strong>{doc_type_name}</strong> foi analisado e <strong>aprovado</strong> pela nossa equipe.
                        </p>
                        <div style="background:#f0fdf4;border-left:4px solid #16A34A;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                            <p style="color:#16A34A;font-weight:700;margin:0 0 8px;">✅ Aprovado:</p>
                            <p style="color:#555;margin:0;">{doc_type_name}</p>
                        </div>
                        <p style="color:#555;line-height:1.6;margin:0 0 20px;">
                            Aguardamos a aprovação dos demais documentos para concluir sua verificação.
                        </p>
                    """
                cor_header = "#16A34A"

            elif status == "rejected":
                subject = f"❌ Documento reprovado: {doc_type_name} — Meu Divã"
                titulo_email = f"Documento reprovado: {doc_type_name}"
                cor_header = "#E03673"
                corpo = f"""
                    <p style="color:#555;line-height:1.6;margin:0 0 16px;">
                        Infelizmente seu documento <strong>{doc_type_name}</strong> foi <strong>reprovado</strong> pela nossa equipe.
                    </p>
                    <div style="background:#fff1f2;border-left:4px solid #E03673;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                        <p style="color:#E03673;font-weight:700;margin:0 0 8px;">❌ Motivo da reprovação:</p>
                        <p style="color:#555;margin:0;">{rejection_reason or 'Documento inválido ou ilegível.'}</p>
                    </div>
                    <p style="color:#555;line-height:1.6;margin:0 0 20px;">
                        Por favor, corrija o problema e envie um novo documento através do seu painel.
                    </p>
                """

            else:  # need_reupload
                subject = f"⚠️ Reenvio necessário: {doc_type_name} — Meu Divã"
                titulo_email = f"Reenvio necessário: {doc_type_name}"
                cor_header = "#F59E0B"
                corpo = f"""
                    <p style="color:#555;line-height:1.6;margin:0 0 16px;">
                        Seu documento <strong>{doc_type_name}</strong> está ilegível ou com problemas de qualidade.
                    </p>
                    <div style="background:#fffbeb;border-left:4px solid #F59E0B;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                        <p style="color:#F59E0B;font-weight:700;margin:0 0 8px;">⚠️ Por favor, reenvie:</p>
                        <p style="color:#555;margin:0;">Certifique-se de enviar um arquivo legível, sem cortes e com boa resolução.</p>
                    </div>
                    <p style="color:#555;line-height:1.6;margin:0 0 20px;">
                        Acesse seu painel para enviar um novo arquivo.
                    </p>
                """

            html = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
                <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <div style="background:{cor_header};padding:20px 24px;display:flex;align-items:center;gap:12px;">
                        <img src="{logo_url}" alt="Meu Divã" style="width:40px;height:40px;border-radius:8px;object-fit:contain;background:white;padding:2px;">
                        <span style="color:white;font-size:1.2rem;font-weight:700;">Meu Divã</span>
                    </div>

                    <!-- Corpo -->
                    <div style="padding:28px 24px;">
                        <h2 style="color:#333;margin:0 0 20px;">{titulo_email}</h2>
                        <p style="color:#555;line-height:1.6;margin:0 0 16px;">Olá, <strong>{nome}</strong>!</p>
                        {corpo}

                        <!-- Botão -->
                        <a href="{app_url}/therapist/documents/required"
                           style="display:inline-block;background:#2F80D3;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.95rem;">
                            Ver meus documentos →
                        </a>

                        <p style="margin-top:28px;color:#888;font-size:0.85rem;line-height:1.6;">
                            Em caso de dúvidas, entre em contato com nossa equipe.<br>
                            <strong>Time Meu Divã</strong>
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="border-top:1px solid #eee;padding:16px 24px;text-align:center;">
                        <img src="{logo_url}" alt="Meu Divã" style="width:28px;height:28px;border-radius:6px;object-fit:contain;vertical-align:middle;margin-right:8px;">
                        <span style="color:#aaa;font-size:0.78rem;">Meu Divã · contato@meudivaonline.com</span>
                    </div>
                </div>
            </body>
            </html>
            """

            email_service._send_email(
                to_email=therapist_user.email,
                subject=subject,
                html_content=html
            )
            print(f"✅ E-mail de validação enviado para {therapist_user.email} - status: {status}")

        except Exception as e:
            print(f"⚠️ Erro ao enviar e-mail de validação: {e}")
            # Não interrompe o fluxo

    return {
        "success": True,
        "message": f"Documento {doc_type_name} {status} com sucesso.",
        "therapist_status": therapist.validation_status
    }