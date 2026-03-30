from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PatientAddressBase(BaseModel):
    street: str
    number: Optional[str] = None
    complement: Optional[str] = None
    district: Optional[str] = None
    city: str
    state: str
    zipcode: str
    country: str = "Brasil"
    is_default: bool = True

class PatientAddressCreate(PatientAddressBase):
    pass

class PatientAddressUpdate(BaseModel):
    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipcode: Optional[str] = None
    country: Optional[str] = None
    is_default: Optional[bool] = None

class PatientAddressOut(PatientAddressBase):
    id: int
    patient_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True