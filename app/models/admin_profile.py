from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class AdminProfile(Base):
    __tablename__ = "admin_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    cpf = Column(String(14), nullable=True)
    birth_date = Column(Date, nullable=True)
    education_level = Column(String(100), nullable=True)
    foto_url = Column(String(500), nullable=True)
    department = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())