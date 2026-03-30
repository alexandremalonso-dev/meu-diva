from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional

# ============================================
# SCHEMAS PARA USUÁRIO
# ============================================

class UserBase(BaseModel):
    """Base para dados do usuário"""
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    """Schema para criação de usuário"""
    password: str
    role: Optional[str] = "patient"
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        allowed_roles = ['patient', 'therapist', 'admin']
        if v not in allowed_roles:
            raise ValueError(f'Role deve ser um de: {allowed_roles}')
        return v

class UserUpdate(BaseModel):
    """Schema para atualização de usuário"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserOut(UserBase):
    """Schema para resposta da API (saída)"""
    id: int
    formatted_id: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserInDB(UserOut):
    """Schema completo para uso interno (com hash)"""
    password_hash: str