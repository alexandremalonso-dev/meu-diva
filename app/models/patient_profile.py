from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON, Date
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
    
    # 🔥 DATA DE NASCIMENTO E ESCOLARIDADE
    birth_date = Column(Date, nullable=True, comment="Data de nascimento do paciente")
    education_level = Column(String(100), nullable=True, comment="Nível de escolaridade do paciente")
    
    # 🔥 DEPARTAMENTO E CARGO (para colaboradores de empresas)
    department = Column(String(100), nullable=True, comment="Departamento do colaborador")
    position = Column(String(100), nullable=True, comment="Cargo do colaborador")
    
    # Foto
    foto_url = Column(String(500))
    
    # Preferências
    timezone = Column(String(50), default="America/Sao_Paulo")
    preferred_language = Column(String(10), default="pt-BR")
    
    # 🔥 OBJETIVOS TERAPÊUTICOS (array de strings)
    therapy_goals = Column(JSON, nullable=True, default=list, comment="Lista de objetivos terapêuticos do paciente")
    
    # 🔥 EMPRESA (vínculo com empresa)
    empresa_id = Column(Integer, ForeignKey("empresa_profiles.id", ondelete="SET NULL"), nullable=True, comment="ID da empresa vinculada")
    
    # 🔥 PLANO DO COLABORADOR (vínculo com plano específico)
    plano_id = Column(Integer, ForeignKey("empresa_planos.id", ondelete="SET NULL"), nullable=True, comment="ID do plano do colaborador")
    
    # 🔥 CONTROLE DE ACESSO (para colaboradores desativados)
    access_ends_at = Column(DateTime(timezone=True), nullable=True, comment="Data de término do acesso do colaborador")
    inactivation_reason = Column(String(255), nullable=True, comment="Motivo da desativação do colaborador")
    
    # Metadados
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 🔥 RELACIONAMENTOS
    user = relationship("User", back_populates="patient_profile")
    addresses = relationship("PatientAddress", back_populates="patient", cascade="all, delete-orphan")
    goals = relationship("PatientGoal", back_populates="patient", cascade="all, delete-orphan")
    security = relationship("PatientSecurity", back_populates="patient", uselist=False, cascade="all, delete-orphan")
    
    # 🔥 RELACIONAMENTO COM EMPRESA
    empresa = relationship("EmpresaProfile", back_populates="colaboradores")
    
    # 🔥 RELACIONAMENTO COM PLANO
    plano = relationship("EmpresaPlano", foreign_keys=[plano_id])