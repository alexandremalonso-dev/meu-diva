from sqlalchemy import Column, Integer, Numeric, String, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class TransactionTypeEnum(enum.Enum):
    credit_purchase = "credit_purchase"
    session_debit = "session_debit"
    refund = "refund"
    adjustment = "adjustment"
    no_show_debit = "no_show_debit"
    cancellation_refund = "cancellation_refund"

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    balance = Column(Numeric(10, 2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="BRL")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Ledger(Base):
    __tablename__ = "ledger"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    transaction_type = Column(Enum(TransactionTypeEnum), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    balance_after = Column(Numeric(10, 2), nullable=False)
    description = Column(String, nullable=True)
    meta_data = Column(JSON, nullable=True, name="metadata")
    created_at = Column(DateTime(timezone=True), server_default=func.now())