from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

class PendingBookingBase(BaseModel):
    therapist_id: int
    starts_at: datetime
    ends_at: datetime

class BookWithPaymentRequest(PendingBookingBase):
    pass

class PendingBookingOut(BaseModel):
    id: int
    user_id: int
    therapist_id: int
    starts_at: datetime
    ends_at: datetime
    session_price: Decimal
    current_balance: Decimal
    missing_amount: Decimal
    checkout_url: Optional[str] = None
    checkout_session_id: Optional[str] = None
    status: str
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class BookWithPaymentResponse(BaseModel):
    status: str  # "scheduled" ou "payment_required"
    appointment_id: Optional[int] = None
    pending_booking_id: Optional[int] = None
    checkout_url: Optional[str] = None
    missing_amount: Optional[Decimal] = None
    current_balance: Optional[Decimal] = None
    session_price: Optional[Decimal] = None
    message: Optional[str] = None