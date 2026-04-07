from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=False)
    plan = Column(String(50), nullable=False, default="essencial")
    status = Column(String(50), nullable=False, default="active")  # active, past_due, cancelled, expired
    stripe_subscription_id = Column(String(255), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relacionamentos
    therapist = relationship(
        "app.models.therapist_profile.TherapistProfile",
        back_populates="subscription",
        foreign_keys=[therapist_id]
    )