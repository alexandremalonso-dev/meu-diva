from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class EmpresaDocumento(Base):
    __tablename__ = "empresa_documentos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresa_profiles.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False, comment="Tipo do documento (contrato_social, cartao_cnpj, etc)")
    url = Column(String(500), nullable=False, comment="URL do arquivo")
    filename = Column(String(255), nullable=False, comment="Nome original do arquivo")
    validation_status = Column(String(20), default="pending", comment="pending, approved, rejected, need_reupload")
    rejection_reason = Column(Text, nullable=True, comment="Motivo da reprovação")
    validated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    empresa = relationship("EmpresaProfile", back_populates="documentos")
    validator = relationship("User", foreign_keys=[validated_by])

    def __repr__(self):
        return f"<EmpresaDocumento(id={self.id}, type={self.type}, status={self.validation_status})>"