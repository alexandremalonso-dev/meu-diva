from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

# ============================================
# TRANSACTION TYPES (igual ao ENUM do banco)
# ============================================
class TransactionType(str):
    CREDIT_PURCHASE = 'credit_purchase'
    SESSION_DEBIT = 'session_debit'
    REFUND = 'refund'
    ADJUSTMENT = 'adjustment'
    NO_SHOW_DEBIT = 'no_show_debit'
    CANCELLATION_REFUND = 'cancellation_refund'

# ============================================
# LEDGER (TRANSAÇÕES)
# ============================================
class LedgerEntryBase(BaseModel):
    transaction_type: str
    amount: Decimal
    description: Optional[str] = None

class LedgerEntryCreate(LedgerEntryBase):
    appointment_id: Optional[int] = None
    meta_data: Optional[dict] = None

class LedgerEntryOut(LedgerEntryBase):
    id: int
    wallet_id: int
    appointment_id: Optional[int]
    balance_after: Decimal
    # 🔥 CORRIGIDO: 'metadata' -> 'meta_data' para alinhar com o modelo e a rota
    meta_data: Optional[dict]  # 👈 ALTERADO DE 'metadata' PARA 'meta_data'
    created_at: datetime

    class Config:
        from_attributes = True

# ============================================
# WALLET
# ============================================
class WalletBase(BaseModel):
    balance: Decimal
    currency: str = "BRL"

class WalletOut(WalletBase):
    id: int
    patient_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============================================
# RESPONSE COM EXTRATO
# ============================================
class WalletWithTransactions(WalletOut):
    transactions: List[LedgerEntryOut] = []
    recent_transactions: List[LedgerEntryOut] = []

class WalletBalanceResponse(BaseModel):
    balance: Decimal
    currency: str
    formatted: str  # Ex: "R$ 150,00"

# ============================================
# TOP-UP (RECARGA)
# ============================================
class TopUpRequest(BaseModel):
    amount: Decimal
    payment_method: Optional[str] = None

class TopUpResponse(BaseModel):
    payment_id: int
    checkout_url: Optional[str] = None
    amount: Decimal
    status: str