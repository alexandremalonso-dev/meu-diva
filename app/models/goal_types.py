from sqlalchemy import Column, Integer, String, Boolean, Text
from app.db.database import Base

class GoalType(Base):
    __tablename__ = "goal_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    icon = Column(String(50))
    is_active = Column(Boolean, default=True)