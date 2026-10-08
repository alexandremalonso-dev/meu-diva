
# ==========================
# 🔥 TRIGGER MANUAL DO SCHEDULER (ADMIN)
# ==========================
@router.post("/trigger-document-check")
def trigger_document_check(
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Dispara manualmente a verificação de documentos pendentes"""
    import threading
    from app.services.scheduler import check_therapists_without_documents
    thread = threading.Thread(target=check_therapists_without_documents, daemon=True)
    thread.start()
    return {"message": "Verificação iniciada em background"}
