from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.database import Base

class TherapistDocument(Base):
    __tablename__ = "therapist_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    therapist_id: Mapped[int] = mapped_column(Integer, ForeignKey("therapist_profiles.id", ondelete="CASCADE"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'diploma' ou 'registration'
    document_url: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    # 🔥 Campos de validação por documento
    validation_status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, approved, rejected
    validated_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Relacionamentos
    therapist = relationship("TherapistProfile", back_populates="documents")
    validator = relationship("User", foreign_keys=[validated_by])