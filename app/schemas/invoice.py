from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class InvoiceStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class InvoiceBase(BaseModel):
    invoice_number: str
    invoice_date: datetime
    amount: float
    year: int
    month: int

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpload(BaseModel):
    invoice_number: str
    invoice_date: datetime
    year: int
    month: int
    amount: float

class InvoiceUpdateStatus(BaseModel):
    status: InvoiceStatus
    admin_notes: Optional[str] = None

class InvoiceResponse(InvoiceBase):
    id: int
    invoice_url: str
    status: InvoiceStatus
    admin_notes: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class TherapistInvoicesSummary(BaseModel):
    total_pending_amount: float = 0
    total_paid_amount: float = 0
    pending_invoices: int = 0
    approved_invoices: int = 0

class TherapistInvoicesResponse(BaseModel):
    invoices: list[InvoiceResponse]
    summary: TherapistInvoicesSummary