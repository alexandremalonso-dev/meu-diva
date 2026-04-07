from typing import Optional
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: Optional[str] = None  # patient | therapist | admin


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str  # necessário para refresh token
    token_type: str = "bearer"


# ==========================
# 🔥 SCHEMAS PARA ALTERAÇÃO DE EMAIL
# ==========================

class EmailChangeRequest(BaseModel):
    """Solicitação de alteração de email"""
    new_email: EmailStr


class VerifyEmailChangeRequest(BaseModel):
    """Verificação de código para alteração de email"""
    code: str


class EmailChangeResponse(BaseModel):
    """Resposta da alteração de email"""
    success: bool
    message: str
    new_email: Optional[EmailStr] = None


# ==========================
# 🔥 SCHEMAS PARA REDEFINIÇÃO DE SENHA
# ==========================

class PasswordResetRequest(BaseModel):
    """Solicitação de redefinição de senha"""
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    """Confirmação de redefinição de senha"""
    email: EmailStr
    code: str
    new_password: str


class PasswordResetResponse(BaseModel):
    """Resposta da redefinição de senha"""
    success: bool
    message: str