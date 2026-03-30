from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class MedicalRecordBase(BaseModel):
    session_not_occurred: bool = False
    not_occurred_reason: Optional[str] = None
    evolution: Optional[str] = None
    outcome: Optional[str] = None
    patient_reasons: Optional[List[str]] = None
    private_notes: Optional[str] = None
    activity_instructions: Optional[str] = None
    links: Optional[List[str]] = None


class MedicalRecordCreate(MedicalRecordBase):
    appointment_id: int


class MedicalRecordUpdate(MedicalRecordBase):
    pass


class MedicalRecordOut(MedicalRecordBase):
    id: int
    appointment_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True