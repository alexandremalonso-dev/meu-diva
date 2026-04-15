from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class EmpresaProfile(Base):
    __tablename__ = "empresa_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    cnpj = Column(String(18), nullable=True)
    corporate_name = Column(String(255), nullable=True)
    trading_name = Column(String(255), nullable=True)
    state_registration = Column(String(50), nullable=True)
    municipal_registration = Column(String(50), nullable=True)
    birth_date = Column(Date, nullable=True)
    education_level = Column(String(100), nullable=True)
    foto_url = Column(String(500), nullable=True)
    department = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    
    # 🔥 CAMPOS PARA RESPONSÁVEL LEGAL
    cpf = Column(String(14), nullable=True)
    responsible_email = Column(String(255), nullable=True)
    responsible_phone = Column(String(20), nullable=True)
    
    # 🔥 LGPD
    lgpd_consent = Column(Boolean, default=False, nullable=True)
    lgpd_consent_date = Column(DateTime(timezone=True), nullable=True)
    
    # 🔥 PLANO EMPRESARIAL
    plano_id = Column(Integer, ForeignKey("empresa_planos.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="empresa_profile")
    colaboradores = relationship("PatientProfile", back_populates="empresa")
    plano = relationship("EmpresaPlano", back_populates="empresas")
    
    # 🔥 RELACIONAMENTOS COM DOCUMENTOS E ENDEREÇOS
    documentos = relationship("EmpresaDocumento", back_populates="empresa", cascade="all, delete-orphan")
    enderecos = relationship("EmpresaEndereco", back_populates="empresa", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<EmpresaProfile(id={self.id}, user_id={self.user_id}, corporate_name={self.corporate_name})>"