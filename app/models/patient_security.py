from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class PatientSecurity(Base):
    __tablename__ = "patient_security"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), unique=True, nullable=False, index=True)
    
    # Configurações de segurança
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255))
    
    # Bloqueios
    is_blocked = Column(Boolean, default=False)
    block_reason = Column(String(255))
    blocked_at = Column(DateTime(timezone=True))
    
    # Tentativas de login
    failed_login_attempts = Column(Integer, default=0)
    last_failed_login = Column(DateTime(timezone=True))
    last_login = Column(DateTime(timezone=True))
    
    # Metadados
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 🔥 RELACIONAMENTO CORRETO
    patient = relationship("PatientProfile", back_populates="security")