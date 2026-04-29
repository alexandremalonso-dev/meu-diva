from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TherapistRatingBase(BaseModel):
    rating: int
    comment: Optional[str] = None
    is_anonymous: bool = False

class TherapistRatingCreate(TherapistRatingBase):
    therapist_id: int
    patient_id: int
    session_id: int

class TherapistRatingOut(TherapistRatingBase):
    id: int
    therapist_id: int
    patient_id: int
    session_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True