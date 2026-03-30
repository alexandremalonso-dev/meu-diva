from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func  # 🔥 CORREÇÃO
from app.db.database import Base

class PatientBilling(Base):
    __tablename__ = "patient_billing"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    
    payment_method = Column(String(50))
    billing_address_id = Column(Integer, ForeignKey("patient_addresses.id"))
    tax_id = Column(String(20))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())