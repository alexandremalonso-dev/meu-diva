from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal


# ============================================
# CREATE CHECKOUT (STRIPE — fluxo redirect)
# ============================================

class CreateCheckoutRequest(BaseModel):
    appointment_id: int
    amount: Decimal
    success_url: HttpUrl
    cancel_url: HttpUrl


class CreateCheckoutResponse(BaseModel):
    checkout_url: HttpUrl
    session_id: str


# ============================================
# CREATE PAYMENT INTENT (Stripe Elements — checkout próprio)
# ============================================

class CreatePaymentIntentRequest(BaseModel):
    appointment_id: int


# Resposta é dict livre (client_secret + dados do terapeuta),
# sem modelo Pydantic para não amarrar o formato do resumo da sessão.


# ============================================
# PAYMENT STATUS
# ============================================

PaymentStatus = Literal[
    "pending",
    "paid",
    "failed",
    "cancelled",
    "refunded",
]


class PaymentStatusResponse(BaseModel):
    payment_id: int
    appointment_id: Optional[int] = None
    amount: Decimal
    status: PaymentStatus
    created_at: datetime
    paid_at: Optional[datetime] = None


# ============================================
# WEBHOOK RESPONSE
# ============================================

class WebhookResponse(BaseModel):
    status: Literal["success", "error", "ignored", "already_processed"]
    detail: Optional[str] = None