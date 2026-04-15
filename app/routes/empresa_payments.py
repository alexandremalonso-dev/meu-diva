from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from decimal import Decimal

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.therapist_profile import TherapistProfile  # ← CORRIGIDO
from app.models.commission import Commission
from app.models.therapist_payment import TherapistPayment

router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])

# Schemas
class PaymentResponse(BaseModel):
    id: int
    therapist_id: int
    therapist_name: str
    therapist_email: str
    therapist_foto_url: Optional[str]
    pix_key: Optional[str]
    period_start: str
    period_end: str
    total_commission_amount: float
    status: str
    payment_method: Optional[str]
    invoice_url: Optional[str]
    paid_at: Optional[str]
    notes: Optional[str]
    created_at: str

    class Config:
        from_attributes = True

class MarkPaidRequest(BaseModel):
    payment_method: Optional[str] = "pix"
    notes: Optional[str] = None

# Endpoints
@router.get("/", response_model=List[PaymentResponse])
async def get_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todos os pagamentos aos terapeutas (apenas admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso permitido apenas para administradores"
        )
    
    payments = db.query(TherapistPayment).order_by(
        TherapistPayment.period_start.desc()
    ).all()
    
    result = []
    for payment in payments:
        therapist = db.query(TherapistProfile).filter(
            TherapistProfile.id == payment.therapist_id
        ).first()
        
        # Buscar email do usuário associado
        therapist_email = ""
        if therapist and therapist.user_id:
            user = db.query(User).filter(User.id == therapist.user_id).first()
            therapist_email = user.email if user else ""
        
        result.append(PaymentResponse(
            id=payment.id,
            therapist_id=payment.therapist_id,
            therapist_name=therapist.full_name if therapist else "Terapeuta",
            therapist_email=therapist_email,
            therapist_foto_url=therapist.foto_url if therapist else None,
            pix_key=therapist.pix_key if therapist else None,
            period_start=payment.period_start.isoformat(),
            period_end=payment.period_end.isoformat(),
            total_commission_amount=float(payment.total_commission_amount),
            status=payment.status,
            payment_method=payment.payment_method,
            invoice_url=payment.invoice_url,
            paid_at=payment.paid_at.isoformat() if payment.paid_at else None,
            notes=payment.notes,
            created_at=payment.created_at.isoformat()
        ))
    
    return result


@router.post("/{payment_id}/mark-paid")
async def mark_payment_as_paid(
    payment_id: int,
    request: MarkPaidRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Marca um pagamento como pago (apenas admin)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso permitido apenas para administradores"
        )
    
    payment = db.query(TherapistPayment).filter(
        TherapistPayment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pagamento não encontrado"
        )
    
    if payment.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pagamento já foi marcado como pago"
        )
    
    payment.status = "paid"
    payment.payment_method = request.payment_method
    payment.paid_at = datetime.now()
    payment.notes = request.notes
    payment.updated_at = datetime.now()
    
    db.commit()
    db.refresh(payment)
    
    return {"message": "Pagamento marcado como pago com sucesso"}


@router.post("/generate")
async def generate_payments(
    period_start: str,
    period_end: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gera pagamentos para todos os terapeutas baseado nas comissões do período"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso permitido apenas para administradores"
        )
    
    start_date = datetime.strptime(period_start, "%Y-%m-%d").date()
    end_date = datetime.strptime(period_end, "%Y-%m-%d").date()
    
    # Buscar todos os terapeutas
    therapists = db.query(TherapistProfile).all()
    
    created_count = 0
    for therapist in therapists:
        # Calcular total de comissões do período
        commissions = db.query(Commission).filter(
            Commission.therapist_id == therapist.id,
            Commission.created_at >= start_date,
            Commission.created_at <= end_date,
            Commission.is_refund == False
        ).all()
        
        total_amount = sum(c.commission_amount for c in commissions)
        
        if total_amount == 0:
            continue
        
        # Verificar se já existe pagamento para este período
        existing = db.query(TherapistPayment).filter(
            TherapistPayment.therapist_id == therapist.id,
            TherapistPayment.period_start == start_date,
            TherapistPayment.period_end == end_date
        ).first()
        
        if existing:
            continue
        
        # Criar pagamento
        payment = TherapistPayment(
            therapist_id=therapist.id,
            period_start=start_date,
            period_end=end_date,
            total_commission_amount=total_amount,
            status="pending"
        )
        db.add(payment)
        created_count += 1
    
    db.commit()
    
    return {
        "message": f"{created_count} pagamentos gerados com sucesso",
        "created_count": created_count
    }