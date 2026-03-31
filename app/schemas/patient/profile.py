from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from typing import Optional, List
from app.schemas.patient.address import PatientAddressOut
from app.schemas.patient.goal import PatientGoalOut

# ============================================
# BASE
# ============================================
class PatientProfileBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    cpf: Optional[str] = None
    birth_date: Optional[date] = None  # 🔥 DATA DE NASCIMENTO
    education_level: Optional[str] = None  # 🔥 NÍVEL DE ESCOLARIDADE
    timezone: str = "America/Sao_Paulo"
    preferred_language: str = "pt-BR"
    therapy_goals: Optional[List[str]] = None  # 🔥 Objetivos terapêuticos

# ============================================
# CREATE / UPDATE
# ============================================
class PatientProfileCreate(PatientProfileBase):
    pass

class PatientProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    birth_date: Optional[date] = None  # 🔥 DATA DE NASCIMENTO
    education_level: Optional[str] = None  # 🔥 NÍVEL DE ESCOLARIDADE
    timezone: Optional[str] = None
    preferred_language: Optional[str] = None
    therapy_goals: Optional[List[str]] = None  # 🔥 Para atualização

# ============================================
# RESPONSE
# ============================================
class PatientProfileOut(PatientProfileBase):
    id: int
    user_id: int
    foto_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Relacionamentos (opcionais)
    addresses: Optional[List[PatientAddressOut]] = Field(None, alias="enderecos")
    goals: Optional[List[PatientGoalOut]] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True

# ============================================
# PHOTO UPLOAD
# ============================================
class PatientPhotoResponse(BaseModel):
    foto_url: str
    message: str = "Foto atualizada com sucesso"