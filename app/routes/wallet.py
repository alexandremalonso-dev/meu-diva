from fastapi import APIRouter, Depends, HTTPException, Query, Security
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from decimal import Decimal
from typing import Optional, List
import os
import stripe

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.config import settings

from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.therapist_profile import TherapistProfile
from app.models.wallet import Wallet, Ledger
from app.models.payment import Payment

from app.schemas.wallet import (
    WalletOut,
    WalletWithTransactions,
    LedgerEntryOut,
    WalletBalanceResponse,
    TopUpRequest,
    TopUpResponse
)

router = APIRouter(prefix="/wallet", tags=["wallet"])

# ============================================
# HELPERS
# ============================================

def get_patient_wallet_or_404(db: Session, patient_id: int) -> Wallet:
    wallet = db.execute(
        select(Wallet).where(Wallet.patient_id == patient_id)
    ).scalar_one_or_none()

    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")

    return wallet


def get_patient_id_from_user(db: Session, user_id: int) -> int:
    patient = db.execute(
        select(PatientProfile).where(PatientProfile.user_id == user_id)
    ).scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")

    return patient.id


def format_currency(amount: Decimal, currency: str = "BRL") -> str:
    return f"R$ {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ============================================
# BALANCE (FONTE DA VERDADE)
# ============================================

@router.get("/balance", response_model=WalletBalanceResponse)
def get_wallet_balance(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    print(f"\n💰 GET /wallet/balance - User {current_user.id}")

    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet_or_404(db, patient_id)

    balance = Decimal(wallet.balance)

    return WalletBalanceResponse(
        balance=balance,
        currency=wallet.currency,
        formatted=format_currency(balance, wallet.currency)
    )


# ============================================
# WALLET BASE
# ============================================

@router.get("/", response_model=WalletOut)
def get_wallet(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet_or_404(db, patient_id)

    return wallet


# ============================================
# TRANSACTIONS (LEDGER)
# ============================================

@router.get("/transactions", response_model=List[LedgerEntryOut])
def get_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    transaction_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet_or_404(db, patient_id)

    query = select(Ledger).where(Ledger.wallet_id == wallet.id)

    if transaction_type:
        query = query.where(Ledger.transaction_type == transaction_type)

    query = query.order_by(desc(Ledger.created_at)).limit(limit).offset(offset)

    return db.execute(query).scalars().all()


# ============================================
# WALLET COMPLETA
# ============================================

@router.get("/full", response_model=WalletWithTransactions)
def get_wallet_with_transactions(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet_or_404(db, patient_id)

    transactions = db.execute(
        select(Ledger)
        .where(Ledger.wallet_id == wallet.id)
        .order_by(desc(Ledger.created_at))
        .limit(limit)
    ).scalars().all()

    return {
        "id": wallet.id,
        "patient_id": wallet.patient_id,
        "balance": wallet.balance,
        "currency": wallet.currency,
        "created_at": wallet.created_at,
        "updated_at": wallet.updated_at,
        "recent_transactions": transactions
    }


# ============================================
# TOP-UP (RECARGA DE CRÉDITOS) - APENAS STRIPE
# ============================================

@router.post("/topup", response_model=TopUpResponse)
def create_topup(
    payload: TopUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    """
    Cria uma intenção de pagamento para recarga de créditos via Stripe
    """
    print(f"\n💰 POST /api/wallet/topup - Usuário: {current_user.id}")
    print(f"   Amount: {payload.amount}")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Valor inválido")

    patient_id = get_patient_id_from_user(db, current_user.id)
    wallet = get_patient_wallet_or_404(db, patient_id)

    # Criar payment
    payment = Payment(
        patient_id=patient_id,
        wallet_id=wallet.id,
        amount=Decimal(str(payload.amount)),
        status="pending",
        payment_method=payload.payment_method
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    print(f"✅ Payment criado: ID {payment.id}")

    # 🔥 APENAS STRIPE - SEM MOCK
    stripe_secret_key = settings.stripe_secret_key or os.getenv("STRIPE_SECRET_KEY", "")
    
    if not stripe_secret_key:
        raise HTTPException(
            status_code=500, 
            detail="Stripe não configurado. Configure STRIPE_SECRET_KEY no .env"
        )
    
    if not stripe_secret_key.startswith("sk_test_") and not stripe_secret_key.startswith("sk_live_"):
        raise HTTPException(
            status_code=500, 
            detail="Chave Stripe inválida. A chave deve começar com sk_test_ ou sk_live_"
        )
    
    try:
        stripe.api_key = stripe_secret_key
        
        print("🔄 Criando sessão no Stripe...")
        
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "brl",
                    "unit_amount": int(payload.amount * 100),  # R$ para centavos
                    "product_data": {
                        "name": "Recarga de créditos - Meu Divã",
                        "description": f"Adicionar R$ {payload.amount:.2f} à sua carteira"
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"http://localhost:3000/patient/wallet?success=true&payment_id={payment.id}",
            cancel_url=f"http://localhost:3000/patient/wallet/topup?cancel=true",
            metadata={
                "payment_id": str(payment.id),
                "user_id": str(current_user.id),
                "type": "topup"
            }
        )
        
        checkout_url = session.url
        print(f"✅ Checkout Stripe criado com sucesso!")
        print(f"   URL: {checkout_url}")
        
    except stripe.error.AuthenticationError as e:
        print(f"❌ Erro de autenticação Stripe: {e}")
        raise HTTPException(status_code=500, detail=f"Erro de autenticação Stripe: {str(e)}")
    except Exception as e:
        print(f"❌ Erro ao criar checkout Stripe: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar checkout: {str(e)}")

    return TopUpResponse(
        payment_id=payment.id,
        checkout_url=checkout_url,
        amount=payment.amount,
        status=payment.status
    )


# ============================================
# TERAPEUTA (VIEW)
# ============================================

@router.get("/therapist/balance", response_model=WalletBalanceResponse)
def get_therapist_wallet_balance(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    therapist = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not therapist:
        return WalletBalanceResponse(
            balance=Decimal("0"),
            currency="BRL",
            formatted="R$ 0,00"
        )

    return WalletBalanceResponse(
        balance=Decimal("1250.50"),
        currency="BRL",
        formatted="R$ 1.250,50"
    )