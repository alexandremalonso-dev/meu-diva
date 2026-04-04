from sqlalchemy import Column, Integer, DateTime, ForeignKey, Boolean, Text, Index
from sqlalchemy.sql import func
from app.db.database import Base


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ nullable=True — threads admin não têm patient_profile nem therapist_profile
    patient_id = Column(Integer, ForeignKey("patient_profiles.id", ondelete="CASCADE"), nullable=True)
    therapist_id = Column(Integer, ForeignKey("therapist_profiles.id", ondelete="CASCADE"), nullable=True)

    # user_id direto — usado em todos os tipos de thread
    patient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    therapist_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    last_message_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    __table_args__ = (
        Index("idx_chat_threads_patient", "patient_user_id"),
        Index("idx_chat_threads_therapist", "therapist_user_id"),
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_chat_messages_thread_id", "thread_id"),
        Index("idx_chat_messages_sender_id", "sender_id"),
        Index("idx_chat_created", "created_at"),
    )