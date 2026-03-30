# app/models/availability.py
from sqlalchemy import Column, Integer, Date, Time, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class AvailabilityPeriod(Base):
    __tablename__ = "availability_periods"

    id = Column(Integer, primary_key=True, index=True)
    therapist_profile_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # ✅ Isso retorna datetime

    # Relacionamentos
    therapist_profile = relationship("TherapistProfile", back_populates="availability_periods")
    slots = relationship("AvailabilitySlot", back_populates="period", cascade="all, delete-orphan")

class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id = Column(Integer, primary_key=True, index=True)
    period_id = Column(Integer, ForeignKey("availability_periods.id", ondelete="CASCADE"), nullable=False)
    weekday = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # ✅ Isso retorna datetime

    # Relacionamentos
    period = relationship("AvailabilityPeriod", back_populates="slots")