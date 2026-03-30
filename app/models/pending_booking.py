from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Enum, JSON
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class PendingBookingStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class PendingBooking(Base):
    __tablename__ = "pending_bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Quem está agendando
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Terapeuta escolhido
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=False)
    
    # Horário pretendido
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    
    # Valores
    session_price = Column(Numeric(10, 2), nullable=False)
    current_balance = Column(Numeric(10, 2), nullable=False)
    missing_amount = Column(Numeric(10, 2), nullable=False)
    
    # Checkout Stripe
    checkout_session_id = Column(String(255), unique=True, nullable=True)
    payment_intent_id = Column(String(255), nullable=True)
    
    # Status
    status = Column(Enum(PendingBookingStatus), nullable=False, default=PendingBookingStatus.PENDING)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)  # Expira em 30 minutos
    
    # Metadados
    extra_data = Column(JSON, nullable=True)
    
    def __repr__(self):
        return f"<PendingBooking {self.id}: user={self.user_id} therapist={self.therapist_id}>"  # ✅ CORRIGIDO