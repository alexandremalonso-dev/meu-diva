from fastapi import APIRouter, Depends, HTTPException, Query, Security  # 🔥 ADICIONAR Security AQUI!
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from typing import Optional, List

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.auth import get_current_user
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit", tags=["auditoria"])

@router.get("/price-changes", response_model=List[dict])
def get_price_change_history(
    therapist_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin, UserRole.therapist]))  # 🔥 AGORA FUNCIONA
):
    # ... resto do código
    """
    Retorna histórico de alterações de preço
    """
    print(f"\n📋 Consultando histórico de preços - Usuário: {current_user.id}")
    
    query = select(AuditLog).where(AuditLog.action_type == "price_change")
    
    if current_user.role != UserRole.admin:
        # Terapeuta só vê suas próprias alterações
        query = query.where(AuditLog.user_id == current_user.id)
    
    if therapist_id and current_user.role == UserRole.admin:
        query = query.where(AuditLog.therapist_profile_id == therapist_id)
    
    logs = db.execute(
        query.order_by(desc(AuditLog.timestamp)).limit(limit)
    ).scalars().all()
    
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "therapist_id": log.therapist_profile_id,
            "old_price": float(log.old_value) if log.old_value else None,
            "new_price": float(log.new_value) if log.new_value else None,
            "description": log.description,
            "user_role": log.user_role
        })
    
    return result

@router.get("/insufficient-balance", response_model=List[dict])
def get_insufficient_balance_attempts(
    patient_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """
    Retorna tentativas de agendamento com saldo insuficiente (apenas admin)
    """
    print(f"\n📋 Consultando tentativas com saldo insuficiente - Admin: {current_user.id}")
    
    query = select(AuditLog).where(AuditLog.action_type == "insufficient_balance_attempt")
    
    if patient_id:
        query = query.where(AuditLog.patient_profile_id == patient_id)
    
    logs = db.execute(
        query.order_by(desc(AuditLog.timestamp)).limit(limit)
    ).scalars().all()
    
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "patient_id": log.patient_profile_id,
            "therapist_id": log.therapist_profile_id,
            "current_balance": float(log.old_value) if log.old_value else None,
            "required_amount": float(log.new_value) if log.new_value else None,
            "description": log.description,
            "metadata": log.metadata
        })
    
    return result