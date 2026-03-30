from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    
    # Dados pessoais
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50))
    cpf = Column(String(14), unique=True)
    
    # Foto
    foto_url = Column(String(500))
    
    # Preferências
    timezone = Column(String(50), default="America/Sao_Paulo")
    preferred_language = Column(String(10), default="pt-BR")
    
    # 🔥 OBJETIVOS TERAPÊUTICOS (array de strings)
    therapy_goals = Column(JSON, nullable=True, default=list, comment="Lista de objetivos terapêuticos do paciente")
    
    # Metadados
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 🔥 RELACIONAMENTOS - TODOS OS back_populates DEVEM CORRESPONDER
    user = relationship("User", back_populates="patient_profile")  # Este é o que estava faltando!
    addresses = relationship("PatientAddress", back_populates="patient", cascade="all, delete-orphan")
    goals = relationship("PatientGoal", back_populates="patient", cascade="all, delete-orphan")
    security = relationship("PatientSecurity", back_populates="patient", uselist=False, cascade="all, delete-orphan")