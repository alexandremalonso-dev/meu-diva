from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal

# ============================================
# CREATE CHECKOUT (STRIPE)
# ============================================

class CreateCheckoutRequest(BaseModel):
    appointment_id: int  # 🔥 FUNDAMENTAL (liga tudo)
    amount: Decimal
    success_url: HttpUrl
    cancel_url: HttpUrl


class CreateCheckoutResponse(BaseModel):
    checkout_url: HttpUrl
    session_id: str


# ============================================
# PAYMENT STATUS
# ============================================

PaymentStatus = Literal[
    "pending",
    "paid",
    "failed",
    "cancelled",
    "refunded"
]


class PaymentStatusResponse(BaseModel):
    payment_id: int
    appointment_id: int
    amount: Decimal
    status: PaymentStatus
    created_at: datetime
    paid_at: Optional[datetime] = None


# ============================================
# WEBHOOK RESPONSE
# ============================================

class WebhookResponse(BaseModel):
    status: Literal["success", "error"]
    detail: Optional[str] = None