from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.appointment import AppointmentOut


# ==========================
# BLOCO OCUPADO
# ==========================

class BusyBlock(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: Literal["appointment", "manual_block", "makeup"] = "appointment"

    model_config = ConfigDict(from_attributes=True)


# ==========================
# CALENDÁRIO DO TERAPEUTA
# ==========================

class TherapistCalendarOut(BaseModel):
    therapist_user_id: int
    range_start: datetime
    range_end: datetime

    # Appointments principais (scheduled, confirmed, cancelled etc.)
    appointments: list[AppointmentOut]

    # 🔮 Estrutura futura — não quebra endpoint atual
    proposed: list[AppointmentOut] = Field(default_factory=list)
    makeups: list[AppointmentOut] = Field(default_factory=list)

    busy_blocks: list[BusyBlock]

    model_config = ConfigDict(from_attributes=True)