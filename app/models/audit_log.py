from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from app.db.database import Base
import enum

class AuditActionType(str, enum.Enum):
    PRICE_CHANGE = "price_change"
    INSUFFICIENT_BALANCE_ATTEMPT = "insufficient_balance_attempt"
    SESSION_DEBIT = "session_debit"
    SESSION_REFUND = "session_refund"
    APPOINTMENT_BLOCKED = "appointment_blocked"

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Quem fez a ação
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_role = Column(String(50), nullable=False)
    
    # Tipo de ação
    action_type = Column(String(50), nullable=False, index=True)
    
    # Dados antes/depois (para mudanças)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    
    # Contexto adicional
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    therapist_profile_id = Column(Integer, ForeignKey("therapist_profiles.id"), nullable=True)
    patient_profile_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=True)
    
    # 🔥 CORRIGIDO: 'extra_data' em vez de 'metadata' (palavra reservada)
    extra_data = Column(JSON, nullable=True)
    
    # Descrição legível
    description = Column(String(500), nullable=False)
    
    # IP ou identificador da requisição (opcional)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)