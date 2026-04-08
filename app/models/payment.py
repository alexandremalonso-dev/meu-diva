from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Enum, Numeric, JSON
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
    
    # Campos do payment.py original
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    amount = Column(Float, nullable=False)
    status = Column(String(20), default="pending")
    payment_method = Column(String(20), default="stripe")
    stripe_session_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Campos do wallet.py (unificados)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=True)
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True)
    currency = Column(String(3), nullable=False, default="BRL")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    description = Column(String, nullable=True)
    meta_data = Column(JSON, nullable=True)