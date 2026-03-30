from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


# ==========================
# SLOT INDIVIDUAL
# ==========================

class AvailableSlot(BaseModel):
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int

    # 🔮 Evolução clínica futura
    source: Literal["availability", "manual_override"] = "availability"
    is_makeup_eligible: bool = False
    temporarily_blocked: bool = False

    model_config = ConfigDict(from_attributes=True)


# ==========================
# RESPONSE COMPLETA
# ==========================

class AvailableSlotsResponse(BaseModel):
    therapist_user_id: int
    range_start: datetime
    range_end: datetime
    slots: list[AvailableSlot]

    # 🔥 count calculado automaticamente
    count: int | None = None

    model_config = ConfigDict(from_attributes=True)

    def model_post_init(self, __context):
        # Se não vier count explícito, calcula automaticamente
        if self.count is None:
            self.count = len(self.slots)