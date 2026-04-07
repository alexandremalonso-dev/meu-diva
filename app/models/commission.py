from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, Numeric, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Commission(Base):
    __tablename__ = "commissions"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=False)
    session_price = Column(Numeric(10, 2), nullable=False)
    commission_rate = Column(Numeric(5, 2), nullable=False)
    commission_amount = Column(Numeric(10, 2), nullable=False)
    net_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Para estornos (valores negativos)
    is_refund = Column(Boolean, default=False)
    # 🔥 REMOVIDO refunded_from_id - NÃO EXISTE NA TABELA
    # refunded_from_id = Column(Integer, nullable=True)

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