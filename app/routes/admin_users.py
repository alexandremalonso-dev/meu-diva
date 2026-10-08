from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile

router = APIRouter(prefix="/admin/users", tags=["admin"])


class UserStatusUpdate(BaseModel):
    is_active: bool


@router.patch("/{user_id}/status")
async def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    """Ativa ou inativa um usuário (ação administrativa)"""
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode alterar seu próprio status")

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "id": user.id,
        "is_active": user.is_active,
    }


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    """
    Exclui um usuário via ação do admin.
    Segue o mesmo padrão do fluxo de auto-exclusão (users.py /me/delete-confirm):
    remove os perfis associados, anonimiza os dados de identificação e marca
    a conta como excluída — preservando o histórico (sessões, pagamentos, etc.)
    que referencia esse user_id.
    """
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir sua própria conta por aqui")

    if user.deletion_status == "deleted":
        raise HTTPException(status_code=400, detail="Usuário já foi excluído")

    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == user.id
    ).first()
    if therapist_profile:
        db.delete(therapist_profile)

    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == user.id
    ).first()
    if patient_profile:
        db.delete(patient_profile)

    user.is_active = False
    user.email = f"deleted_{user.id}_{user.email}"
    user.full_name = None
    user.password_hash = None
    user.deletion_status = "deleted"
    user.deletion_confirmed_at = datetime.now()

    db.commit()

    return {
        "success": True,
        "message": "Usuário excluído com sucesso.",
    }
