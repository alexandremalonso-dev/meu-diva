from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.db.database import get_db  # 🔥 CORRIGIDO
from app.core.auth import get_current_user
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_invoice import TherapistInvoice, InvoiceStatus 

router = APIRouter(prefix="/therapist/invoices", tags=["Therapist Invoices"])

def get_therapist_profile(user_id: int, db: Session) -> TherapistProfile:
    """Obtém o perfil do terapeuta ou retorna erro"""
    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == user_id
    ).first()
    if not therapist:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso permitido apenas para terapeutas"
        )
    return therapist

@router.get("", response_model=dict)
async def get_my_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna todas as notas fiscais do terapeuta logado"""
    therapist = get_therapist_profile(current_user.id, db)
    
    invoices = db.query(TherapistInvoice).filter(
        TherapistInvoice.therapist_id == therapist.id
    ).order_by(
        TherapistInvoice.year.desc(),
        TherapistInvoice.month.desc()
    ).all()
    
    # Calcular resumo
    total_pending_amount = 0.0
    total_approved_amount = 0.0
    pending_count = 0
    approved_count = 0
    
    for inv in invoices:
        amount = float(inv.amount)
        if inv.status == InvoiceStatus.PENDING:
            total_pending_amount += amount
            pending_count += 1
        elif inv.status == InvoiceStatus.APPROVED:
            total_approved_amount += amount
            approved_count += 1
    
    return {
        "invoices": [
            {
                "id": inv.id,
                "year": inv.year,
                "month": inv.month,
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat(),
                "invoice_url": inv.invoice_url,
                "amount": float(inv.amount),
                "status": inv.status.value,
                "admin_notes": inv.admin_notes,
                "created_at": inv.created_at.isoformat() if inv.created_at else None
            }
            for inv in invoices
        ],
        "summary": {
            "total_pending_amount": total_pending_amount,
            "total_approved_amount": total_approved_amount,
            "pending_invoices": pending_count,
            "approved_invoices": approved_count
        }
    }

@router.post("/upload", response_model=dict)
async def upload_invoice(
    file: UploadFile = File(...),
    invoice_number: str = Form(...),
    invoice_date: str = Form(...),
    year: int = Form(...),
    month: int = Form(...),
    amount: float = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Envia uma nova nota fiscal para um período"""
    from app.services.invoice_service import save_invoice_file
    
    therapist = get_therapist_profile(current_user.id, db)
    
    # Validar período
    if month < 0 or month > 11:
        raise HTTPException(status_code=400, detail="Mês inválido")
    
    # Verificar se já existe invoice para este período
    existing = db.query(TherapistInvoice).filter(
        TherapistInvoice.therapist_id == therapist.id,
        TherapistInvoice.year == year,
        TherapistInvoice.month == month
    ).first()
    
    if existing and existing.status != InvoiceStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível alterar uma nota {existing.status.value}"
        )
    
    if existing:
        db.delete(existing)
        db.flush()
    
    # Salvar arquivo
    try:
        invoice_date_parsed = datetime.strptime(invoice_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use YYYY-MM-DD")
    
    file_url = await save_invoice_file(file, therapist.id, invoice_number)
    
    new_invoice = TherapistInvoice(
        therapist_id=therapist.id,
        year=year,
        month=month,
        invoice_number=invoice_number,
        invoice_date=invoice_date_parsed,
        invoice_url=file_url,
        amount=amount,
        status=InvoiceStatus.PENDING
    )
    
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    
    return {
        "success": True,
        "message": "Nota fiscal enviada com sucesso",
        "invoice_id": new_invoice.id
    }