from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class PersonalEventType(str, enum.Enum):
    """Tipos de eventos pessoais"""
    PERSONAL = "personal"
    REMINDER = "reminder"
    TASK = "task"
    INVITE = "invite"


class PersonalEvent(Base):
    """Modelo para eventos pessoais do terapeuta"""
    __tablename__ = "personal_events"
    
    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id", ondelete="CASCADE"), nullable=False)
    type = Column(SQLEnum(PersonalEventType), nullable=False, default=PersonalEventType.PERSONAL)
    title = Column(String(255), nullable=True)  # Opcional para invites
    patient_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())