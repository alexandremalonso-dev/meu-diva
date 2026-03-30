from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text, Boolean, String, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class MedicalRecord(Base):
    """
    Modelo para prontuários de sessões
    """
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    
    # Controle de ocorrência
    session_not_occurred = Column(Boolean, default=False)
    not_occurred_reason = Column(String(50), nullable=True)  # PATIENT_NO_SHOW, TECH_ISSUE, OTHER
    
    # Campos da sessão (se ocorreu)
    evolution = Column(Text, nullable=True)  # Evolução do atendimento
    outcome = Column(String(50), nullable=True)  # IN_PROGRESS, CLINICAL_DISCHARGE, etc.
    patient_reasons = Column(JSON, nullable=True)  # Lista de motivos selecionados
    activity_instructions = Column(Text, nullable=True)  # Orientações para o paciente
    links = Column(JSON, nullable=True)  # Lista de links enviados
    
    # Notas privadas (apenas terapeuta)
    private_notes = Column(Text, nullable=True)
    
    # Metadados
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relacionamentos
    appointment = relationship("Appointment", back_populates="medical_record")