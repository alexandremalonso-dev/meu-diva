from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class PaymentStatusEnum(enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    # Vínculo com usuário e agendamento
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)

    # Vínculo com wallet (fluxo de carteira)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=True)

    # Valor e moeda
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="BRL")

    # Status e método
    status = Column(String(20), default="pending")
    payment_method = Column(String(20), default="stripe")

    # IDs Stripe — session (fluxo redirect) e payment intent (fluxo Elements)
    stripe_session_id = Column(String(255), nullable=True)
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True, index=True)

    # Datas
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)

    # Extra
    description = Column(String, nullable=True)
    meta_data = Column(JSON, nullable=True)