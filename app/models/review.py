from sqlalchemy import Column, Integer, ForeignKey, Text, Float, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True)
    patient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    therapist_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Float, nullable=False)  # 1 a 5 estrelas
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    appointment = relationship("Appointment", back_populates="review")
    patient = relationship("User", foreign_keys=[patient_user_id])
    therapist = relationship("User", foreign_keys=[therapist_user_id])
    
    __table_args__ = (
        UniqueConstraint('appointment_id', name='unique_appointment_review'),
    )