from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class PersonalEventType(str, Enum):
    PERSONAL = "personal"
    REMINDER = "reminder"
    TASK = "task"
    INVITE = "invite"


class PersonalEventCreate(BaseModel):
    type: PersonalEventType
    title: Optional[str] = Field(None, max_length=255)
    patient_user_id: Optional[int] = None
    starts_at: datetime
    ends_at: datetime


class PersonalEventUpdate(BaseModel):
    """Schema para atualizar evento pessoal"""
    title: Optional[str] = Field(None, max_length=255)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class PersonalEventResponse(BaseModel):
    id: int
    therapist_id: int
    type: PersonalEventType
    title: Optional[str]
    patient_user_id: Optional[int] = None
    starts_at: datetime
    ends_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True