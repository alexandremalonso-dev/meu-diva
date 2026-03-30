from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Invite(Base):
    __tablename__ = "invites"

    id = Column(Integer, primary_key=True, index=True)
    therapist_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    session_price = Column(Numeric(10, 2), nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=50)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relacionamentos (comentados temporariamente para testar)
    # therapist = relationship("User", foreign_keys=[therapist_user_id])
    # patient = relationship("User", foreign_keys=[patient_user_id])