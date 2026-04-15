from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Numeric
from sqlalchemy.sql import func
from datetime import datetime
from app.db.database import Base

class EmpresaInvoice(Base):
    __tablename__ = "empresa_invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresa_profiles.id", ondelete="CASCADE"), nullable=False)
    invoice_number = Column(String(100), nullable=False)
    reference_month = Column(String(7), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="pending")
    invoice_url = Column(String(500), nullable=False)
    filename = Column(String(255), nullable=False)
    due_date = Column(DateTime, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)