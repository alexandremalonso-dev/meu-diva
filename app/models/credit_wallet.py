from decimal import Decimal
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, Numeric

from app.db.database import Base


class CreditWallet(Base):
    __tablename__ = "credit_wallets"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    # Saldo monetário (ex: 80.00, 150.50)
    balance: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),   # até 99.999.999,99
        default=Decimal("0.00"),
        nullable=False,
    )