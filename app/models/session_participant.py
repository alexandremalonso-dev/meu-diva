"""
Modelo para registrar entrada/saída dos participantes nas videochamadas
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class SessionParticipant(Base):
    __tablename__ = "session_participants"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_role = Column(String(20), nullable=False)  # 'therapist' ou 'patient'
    joined_at = Column(DateTime(timezone=True), nullable=False)
    left_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)  # duração em segundos (joined_at até left_at)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    appointment = relationship("Appointment", backref="participants")
    user = relationship("User", backref="session_participants")

    # Índices para otimizar consultas
    __table_args__ = (
        Index("idx_session_participants_appointment", "appointment_id"),
        Index("idx_session_participants_user", "user_id"),
        Index("idx_session_participants_left_at", "left_at"),
    )