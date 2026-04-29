from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ReviewCreate(BaseModel):
    appointment_id: int
    rating: int = Field(..., ge=1, le=5, description="Avaliação de 1 a 5 estrelas")
    comment: Optional[str] = Field(None, max_length=500, description="Comentário opcional sobre a sessão")

class ReviewOut(BaseModel):
    id: int
    appointment_id: int
    patient_user_id: int
    therapist_user_id: int
    rating: float
    comment: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class ReviewCheckResponse(BaseModel):
    has_review: bool
    review_id: Optional[int] = None
    message: str