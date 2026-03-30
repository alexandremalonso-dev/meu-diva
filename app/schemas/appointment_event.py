from datetime import datetime
from pydantic import BaseModel
from app.core.appointment_event_type import AppointmentEventType


class AppointmentEventOut(BaseModel):
    id: int
    appointment_id: int
    actor_user_id: int
    event_type: AppointmentEventType
    old_status: str | None
    new_status: str | None
    event_metadata: dict | None
    created_at: datetime

    class Config:
        from_attributes = True