from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.sql import func  # 🔥 CORREÇÃO
from app.db.database import Base

class PatientSubscription(Base):
    __tablename__ = "patient_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=False)
    
    plan_id = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    benefit_type = Column(String(100))
    coupon_id = Column(String(50))
    auto_renew = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())