from typing import Optional
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: Optional[str] = None  # ✅ patient | therapist | admin


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str  # 🔥 ADICIONADO - necessário para refresh token
    token_type: str = "bearer"