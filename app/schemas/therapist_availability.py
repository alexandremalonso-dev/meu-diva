from pydantic import BaseModel
from datetime import time

class AvailabilityCreate(BaseModel):
    weekday: int
    start_time: time
    end_time: time
    
    class Config:
        json_schema_extra = {
            "example": {
                "weekday": 1,
                "start_time": "09:00",
                "end_time": "10:00"
            }
        }

class AvailabilityOut(AvailabilityCreate):
    id: int
    therapist_profile_id: int
    
    class Config:
        from_attributes = True