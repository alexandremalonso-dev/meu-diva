from fastapi import Security, HTTPException, status
from app.core.auth import get_current_user
from app.core.roles import UserRole
from app.models.user import User
from typing import List

def require_roles(allowed_roles: List[UserRole]):
    """
    Decorator para verificar se o usuário tem permissão.
    Agora usando Security() para integração com Swagger.
    """
    async def role_checker(
        current_user: User = Security(get_current_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão negada"
            )
        return current_user
    return role_checker