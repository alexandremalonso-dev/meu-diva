from pydantic import BaseModel, model_validator
from datetime import datetime, timedelta
from typing import Optional

class InviteCreate(BaseModel):
    patient_user_id: int
    therapist_user_id: int
    starts_at: datetime
    duration_minutes: int = 50  # 30 ou 50 minutos
    ends_at: Optional[datetime] = None
    
    @model_validator(mode="after")
    def calculate_ends_at(self):
        """Calcula ends_at a partir de starts_at e duration_minutes"""
        if not self.ends_at:
            self.ends_at = self.starts_at + timedelta(minutes=self.duration_minutes)
        
        # Validação
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at deve ser maior que starts_at")
        
        return self

class InviteOut(BaseModel):
    id: int
    patient_user_id: int
    therapist_user_id: int
    starts_at: datetime
    ends_at: datetime
    duration_minutes: int
    status: str
    created_at: datetime
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None
    patient_foto_url: Optional[str] = None  # 🔥 ADICIONADO
    therapist: Optional[dict] = None  # Para quando é paciente vendo convite do terapeuta
    
    class Config:
        from_attributes = True