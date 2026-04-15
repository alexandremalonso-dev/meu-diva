from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class EmpresaProfileBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    cnpj: Optional[str] = None
    corporate_name: Optional[str] = None
    trading_name: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    birth_date: Optional[date] = None
    education_level: Optional[str] = None
    foto_url: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None

class EmpresaProfileCreate(EmpresaProfileBase):
    user_id: int

class EmpresaProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    cnpj: Optional[str] = None
    corporate_name: Optional[str] = None
    trading_name: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    birth_date: Optional[date] = None
    education_level: Optional[str] = None
    foto_url: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None

class EmpresaProfileResponse(EmpresaProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True