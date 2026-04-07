from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    action_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False
    )
    
    user = relationship("app.models.user.User", back_populates="notifications")