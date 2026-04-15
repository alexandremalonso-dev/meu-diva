from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class EmpresaEndereco(Base):
    __tablename__ = "empresa_enderecos"

    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresa_profiles.id", ondelete="CASCADE"), nullable=False)
    cep = Column(String(10), nullable=True)
    logradouro = Column(String(255), nullable=True)
    numero = Column(String(20), nullable=True)
    complemento = Column(String(100), nullable=True)
    bairro = Column(String(100), nullable=True)
    cidade = Column(String(100), nullable=True)
    uf = Column(String(2), nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    empresa = relationship("EmpresaProfile", back_populates="enderecos")

    def __repr__(self):
        return f"<EmpresaEndereco(id={self.id}, logradouro={self.logradouro}, cidade={self.cidade})>"