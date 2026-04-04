from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, Numeric, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.database import Base


class Commission(Base):
    __tablename__ = "commissions"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False)
    session_price = Column(Numeric(10, 2), nullable=False)
    commission_rate = Column(Numeric(5, 2), nullable=False)  # 20, 10, 3
    commission_amount = Column(Numeric(10, 2), nullable=False)
    net_amount = Column(Numeric(10, 2), nullable=False)  # session_price - commission
    created_at = Column(DateTime, server_default=func.now())
    
    # 🔥 Para estornos (valores negativos)
    is_refund = Column(Boolean, default=False)
    refunded_from_id = Column(Integer, nullable=True)  # commission_id original

    # Relacionamentos
    appointment = relationship(
        "app.models.appointment.Appointment",
        back_populates="commission",
        foreign_keys=[appointment_id]
    )
    therapist = relationship(
        "app.models.therapist_profile.TherapistProfile",
        back_populates="commissions",
        foreign_keys=[therapist_id]
    )
    patient = relationship(
        "app.models.patient_profile.PatientProfile",
        foreign_keys=[patient_id]
    )