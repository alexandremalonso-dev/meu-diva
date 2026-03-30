from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PatientGoalBase(BaseModel):
    goal_type: str
    is_active: bool = True

class PatientGoalCreate(PatientGoalBase):
    pass

class PatientGoalUpdate(BaseModel):
    is_active: Optional[bool] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None

class PatientGoalOut(PatientGoalBase):
    id: int
    patient_id: int
    selected_at: datetime
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True

class GoalTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None