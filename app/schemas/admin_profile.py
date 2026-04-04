from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class AdminProfileBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    cpf: Optional[str] = None
    birth_date: Optional[date] = None
    education_level: Optional[str] = None
    foto_url: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None

class AdminProfileCreate(AdminProfileBase):
    user_id: int

class AdminProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    birth_date: Optional[date] = None
    education_level: Optional[str] = None
    foto_url: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None

class AdminProfileOut(AdminProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True