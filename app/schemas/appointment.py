from pydantic import BaseModel, model_validator, ConfigDict
from datetime import datetime, timedelta
from typing import Optional, List
from app.core.appointment_status import AppointmentStatus

# ==========================
# CREATE
# ==========================
class AppointmentCreate(BaseModel):
    therapist_user_id: int
    starts_at: datetime
    ends_at: datetime
    duration_minutes: Optional[int] = None
    patient_user_id: Optional[int] = None

    @model_validator(mode="after")
    def normalize_and_validate(self):
        if self.ends_at is None and self.duration_minutes is None:
            raise ValueError("Informe duration_minutes ou ends_at.")
        
        if self.duration_minutes is not None:
            if self.duration_minutes not in (30, 50):
                raise ValueError("duration_minutes deve ser 30 ou 50.")
            if self.ends_at is None:
                self.ends_at = self.starts_at + timedelta(
                    minutes=self.duration_minutes
                )
        
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("ends_at deve ser maior que starts_at.")
        
        if self.duration_minutes is None:
            self.duration_minutes = int(
                (self.ends_at - self.starts_at).total_seconds() // 60
            )
        
        return self


# ==========================
# OUTPUT
# ==========================
class AppointmentOut(BaseModel):
    id: int
    patient_user_id: int
    therapist_user_id: int
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    session_price: Optional[float] = None
    duration_minutes: Optional[int] = None
    rescheduled_from_id: Optional[int] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# ==========================
# UPDATE STATUS
# ==========================
class AppointmentUpdateStatus(BaseModel):
    status: AppointmentStatus

    @model_validator(mode="after")
    def validate_status(self):
        if self.status in (AppointmentStatus.rescheduled,):
            raise ValueError("Este status não pode ser definido manualmente.")
        return self


# ==========================
# RESCHEDULE
# ==========================
class RescheduleRequest(BaseModel):
    starts_at: datetime
    ends_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.ends_at is None and self.duration_minutes is None:
            raise ValueError("Informe duration_minutes ou ends_at.")
        
        if self.duration_minutes is not None:
            if self.duration_minutes not in (30, 50):
                raise ValueError("duration_minutes deve ser 30 ou 50.")
            if self.ends_at is None:
                self.ends_at = self.starts_at + timedelta(
                    minutes=self.duration_minutes
                )
        
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("ends_at deve ser maior que starts_at.")
        
        return self