from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_current_user, create_access_token
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.admin_impersonation_log import AdminImpersonationLog

router = APIRouter(prefix="/admin/impersonation", tags=["admin"])

# Perfis que o admin pode simular
ALLOWED_TARGET_ROLES = [UserRole.therapist, UserRole.patient]


@router.post("/{user_id}/start")
async def start_impersonation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    """Admin gera um token temporário para visualizar a plataforma como outro usuário"""
    target = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if target.role not in ALLOWED_TARGET_ROLES:
        raise HTTPException(status_code=400, detail="Só é possível simular terapeutas ou pacientes")

    if not target.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo. Reative a conta antes de simular o acesso")

    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Ação inválida")

    log = AdminImpersonationLog(
        admin_user_id=current_user.id,
        target_user_id=target.id,
        target_role=target.role.value,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    token = create_access_token({"sub": str(target.id)}, user_role=target.role.value)

    return {
        "access_token": token,
        "log_id": log.id,
        "target_id": target.id,
        "target_name": target.full_name or target.email,
        "target_role": target.role.value,
    }


@router.post("/{log_id}/end")
async def end_impersonation(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Encerra uma sessão de simulação e registra o horário no log de auditoria.
    Pode ser chamada tanto com o token do admin quanto com o token simulado
    (ambos pertencem à mesma sessão de simulação).
    """
    log = db.execute(
        select(AdminImpersonationLog).where(AdminImpersonationLog.id == log_id)
    ).scalar_one_or_none()

    if not log:
        raise HTTPException(status_code=404, detail="Registro de simulação não encontrado")

    if current_user.id not in (log.admin_user_id, log.target_user_id):
        raise HTTPException(status_code=403, detail="Acesso negado")

    if log.ended_at is not None:
        return {"success": True, "message": "Sessão já havia sido encerrada"}

    log.ended_at = datetime.now()
    db.commit()

    return {"success": True}


@router.get("")
async def list_impersonation_logs(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    """Lista o histórico de simulações (log de auditoria)"""
    logs = db.execute(
        select(AdminImpersonationLog).order_by(AdminImpersonationLog.started_at.desc()).limit(200)
    ).scalars().all()

    result = []
    for log in logs:
        admin_user = db.execute(select(User).where(User.id == log.admin_user_id)).scalar_one_or_none()
        target_user = db.execute(select(User).where(User.id == log.target_user_id)).scalar_one_or_none()
        result.append({
            "id": log.id,
            "admin_id": log.admin_user_id,
            "admin_name": admin_user.full_name if admin_user else None,
            "admin_email": admin_user.email if admin_user else None,
            "target_id": log.target_user_id,
            "target_name": target_user.full_name if target_user else None,
            "target_role": log.target_role,
            "started_at": log.started_at,
            "ended_at": log.ended_at,
        })
    return result
