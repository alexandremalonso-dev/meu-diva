# C:\meu-diva\app\models\therapist_invoice.py
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TherapistInvoice(Base):
    __tablename__ = "therapist_invoices"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=False)
    
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    
    invoice_number = Column(String(100), nullable=False)
    invoice_date = Column(DateTime, nullable=False)
    invoice_url = Column(String(500), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    
    status = Column(SQLEnum(InvoiceStatus), default=InvoiceStatus.PENDING, nullable=False)
    admin_notes = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # SEM RELACIONAMENTOS