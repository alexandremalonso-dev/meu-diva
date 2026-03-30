# app/schemas/availability.py
from pydantic import BaseModel, ConfigDict
from datetime import date, time, datetime
from typing import List, Optional

# Schema para um slot de horário
class AvailabilitySlotBase(BaseModel):
    weekday: int  # 0=domingo, 1=segunda, ..., 6=sábado
    start_time: time
    end_time: time

class AvailabilitySlotCreate(AvailabilitySlotBase):
    pass

class AvailabilitySlotOut(AvailabilitySlotBase):
    id: int
    period_id: int
    created_at: Optional[datetime] = None  # 🔥 Mudado de str para datetime
    
    model_config = ConfigDict(from_attributes=True)

# Schema para um período
class AvailabilityPeriodBase(BaseModel):
    start_date: date
    end_date: date

class AvailabilityPeriodCreate(AvailabilityPeriodBase):
    slots: List[AvailabilitySlotCreate]

class AvailabilityPeriodOut(AvailabilityPeriodBase):
    id: int
    therapist_profile_id: int
    created_at: Optional[datetime] = None  # 🔥 Mudado de str para datetime
    slots: List[AvailabilitySlotOut] = []
    
    model_config = ConfigDict(from_attributes=True)

# Schema para atualização (opcional)
class AvailabilityPeriodUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None