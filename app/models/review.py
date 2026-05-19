from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Text, Float, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base


class Review(Base):
    __tablename__ = "reviews"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    appointment_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("appointments.id", ondelete="CASCADE"), 
        nullable=False, 
        unique=True
    )
    patient_user_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    therapist_user_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    rating: Mapped[float] = mapped_column(Float, nullable=False)  # 1 a 5 estrelas
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), 
        onupdate=func.now()
    )
    
    # 🔥 RELACIONAMENTOS CORRIGIDOS
    appointment = relationship("Appointment", back_populates="review")
    patient = relationship("User", foreign_keys=[patient_user_id])
    therapist = relationship("User", foreign_keys=[therapist_user_id])
    
    __table_args__ = (
        UniqueConstraint('appointment_id', name='unique_appointment_review'),
    )