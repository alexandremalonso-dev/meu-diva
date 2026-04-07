from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.database import Base

class TherapistValidation(Base):
    __tablename__ = "therapist_validation"

    id: Mapped[int] = mapped_column(primary_key=True)
    therapist_id: Mapped[int] = mapped_column(Integer, ForeignKey("therapist_profiles.id", ondelete="CASCADE"), nullable=False)
    validation_status: Mapped[str] = mapped_column(String(50), default="pending")
    validated_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    therapist = relationship("TherapistProfile", back_populates="validation")
    validator = relationship("User", foreign_keys=[validated_by])