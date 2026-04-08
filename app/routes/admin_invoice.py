from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_invoice import TherapistInvoice, InvoiceStatus

router = APIRouter(prefix="/admin/invoices", tags=["Admin Invoices"])

class InvoiceReviewRequest(BaseModel):
    admin_notes: Optional[str] = None


@router.get("", response_model=List[dict])
async def get_all_invoices(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles([UserRole.admin])),
    db: Session = Depends(get_db)
):
    """Admin: Lista todas as notas fiscais"""
    
    query = db.query(TherapistInvoice)
    
    if status_filter:
        query = query.filter(TherapistInvoice.status == status_filter)
    
    invoices = query.order_by(TherapistInvoice.created_at.desc()).all()
    
    return [
        {
            "id": inv.id,
            "therapist_id": inv.therapist_id,
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
    ]


@router.get("/pending", response_model=List[dict])
async def get_pending_invoices(
    current_user: User = Depends(require_roles([UserRole.admin])),
    db: Session = Depends(get_db)
):
    """Admin: Lista apenas notas pendentes"""
    
    invoices = db.query(TherapistInvoice).filter(
        TherapistInvoice.status == InvoiceStatus.PENDING
    ).order_by(TherapistInvoice.created_at.asc()).all()
    
    return [
        {
            "id": inv.id,
            "therapist_id": inv.therapist_id,
            "year": inv.year,
            "month": inv.month,
            "invoice_number": inv.invoice_number,
            "amount": float(inv.amount),
            "created_at": inv.created_at.isoformat() if inv.created_at else None
        }
        for inv in invoices
    ]


@router.post("/{invoice_id}/approve")
async def approve_invoice(
    invoice_id: int,
    review: InvoiceReviewRequest,
    current_user: User = Depends(require_roles([UserRole.admin])),
    db: Session = Depends(get_db)
):
    """Admin: Aprova uma nota fiscal"""
    
    invoice = db.query(TherapistInvoice).filter(
        TherapistInvoice.id == invoice_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada")
    
    if invoice.status != InvoiceStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Nota fiscal já está {invoice.status.value}"
        )
    
    invoice.status = InvoiceStatus.APPROVED
    invoice.admin_notes = review.admin_notes
    invoice.reviewed_by = current_user.id
    invoice.reviewed_at = datetime.now()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Nota fiscal aprovada com sucesso",
        "invoice_id": invoice_id
    }


@router.post("/{invoice_id}/reject")
async def reject_invoice(
    invoice_id: int,
    review: InvoiceReviewRequest,
    current_user: User = Depends(require_roles([UserRole.admin])),
    db: Session = Depends(get_db)
):
    """Admin: Rejeita uma nota fiscal"""
    
    if not review.admin_notes or len(review.admin_notes.strip()) < 3:
        raise HTTPException(
            status_code=400,
            detail="É necessário informar o motivo da rejeição (mínimo 3 caracteres)"
        )
    
    invoice = db.query(TherapistInvoice).filter(
        TherapistInvoice.id == invoice_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada")
    
    if invoice.status != InvoiceStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Nota fiscal já está {invoice.status.value}"
        )
    
    invoice.status = InvoiceStatus.REJECTED
    invoice.admin_notes = review.admin_notes
    invoice.reviewed_by = current_user.id
    invoice.reviewed_at = datetime.now()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Nota fiscal rejeitada",
        "invoice_id": invoice_id
    }


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    current_user: User = Depends(require_roles([UserRole.admin])),
    db: Session = Depends(get_db)
):
    """Admin: Busca detalhes de uma nota fiscal específica"""
    
    invoice = db.query(TherapistInvoice).filter(
        TherapistInvoice.id == invoice_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada")
    
    from app.models.therapist_profile import TherapistProfile
    
    therapist = db.query(TherapistProfile).filter(
        TherapistProfile.id == invoice.therapist_id
    ).first()
    
    therapist_name = None
    therapist_email = None
    if therapist:
        user = db.query(User).filter(User.id == therapist.user_id).first()
        if user:
            therapist_name = user.full_name or user.email
            therapist_email = user.email
    
    return {
        "id": invoice.id,
        "therapist_id": invoice.therapist_id,
        "therapist_name": therapist_name,
        "therapist_email": therapist_email,
        "year": invoice.year,
        "month": invoice.month,
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.isoformat(),
        "invoice_url": invoice.invoice_url,
        "amount": float(invoice.amount),
        "status": invoice.status.value,
        "admin_notes": invoice.admin_notes,
        "reviewed_by": invoice.reviewed_by,
        "reviewed_at": invoice.reviewed_at.isoformat() if invoice.reviewed_at else None,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None
    }