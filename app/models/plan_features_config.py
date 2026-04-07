from sqlalchemy import String, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.db.database import Base

class PlanFeaturesConfig(Base):
    __tablename__ = "plan_features_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    feature_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    feature_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    available_in_essencial: Mapped[bool] = mapped_column(Boolean, default=False)
    available_in_profissional: Mapped[bool] = mapped_column(Boolean, default=False)
    available_in_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)