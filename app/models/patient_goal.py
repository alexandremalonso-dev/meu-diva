from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class PatientGoal(Base):
    __tablename__ = "patient_goals"

    id = Column(Integer, primary_key=True, index=True)
    
    # 🔥 Chave estrangeira (já existe no banco)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False, index=True)
    
    # Objetivo
    goal_type = Column(String(100), nullable=False)
    
    # 🔥 ALINHADO COM A ESTRUTURA REAL DO BANCO
    is_active = Column(Boolean, default=True)                       # is_active (boolean)
    selected_at = Column(DateTime(timezone=True), server_default=func.now())  # selected_at (timestamptz)
    completed_at = Column(DateTime(timezone=True))                   # completed_at (timestamptz)
    notes = Column(Text)                                              # notes (text)
    target_date = Column(Date)                                        # target_date (date)
    created_at = Column(Date, server_default=func.current_date())    # created_at (date)
    
    # Relacionamento
    patient = relationship("PatientProfile", back_populates="goals")