from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import traceback

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    try:
        print(f"📋 GET /users/me - Usuário: {current_user.id} ({current_user.email})")
        
        return {
            "id": current_user.id,
            "formatted_id": current_user.formatted_id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at
        }
    except Exception as e:
        print(f"❌ Erro em GET /users/me: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.patch("/me", response_model=UserOut)
def update_current_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        print(f"📝 PATCH /users/me - Usuário: {current_user.id}")
        
        if user_update.full_name is not None:
            current_user.full_name = user_update.full_name
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "id": current_user.id,
            "formatted_id": current_user.formatted_id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at
        }
    except Exception as e:
        print(f"❌ Erro em PATCH /users/me: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.get("", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = None,
):
    try:
        print(f"📋 GET /users - Admin: {current_user.id}")
        
        query = select(User)
        
        if role:
            query = query.where(User.role == role)
        
        users = db.execute(
            query.offset(skip).limit(limit)
        ).scalars().all()
        
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "formatted_id": user.formatted_id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active,
                "created_at": user.created_at
            })
        return result
    except Exception as e:
        print(f"❌ Erro em GET /users: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    try:
        print(f"📋 GET /users/{user_id} - Admin: {current_user.id}")
        
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        return {
            "id": user.id,
            "formatted_id": user.formatted_id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em GET /users/{user_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    role: UserRole,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    try:
        print(f"📝 PATCH /users/{user_id}/role - Admin: {current_user.id}")
        
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        user.role = role
        db.commit()
        db.refresh(user)
        
        return {
            "id": user.id,
            "formatted_id": user.formatted_id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em PATCH /users/{user_id}/role: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")