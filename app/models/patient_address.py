from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class PatientAddress(Base):
    __tablename__ = "patient_addresses"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False, index=True)
    
    # Endereço
    street = Column(String(255), nullable=False)
    number = Column(String(20))
    complement = Column(String(255))
    neighborhood = Column(String(100), nullable=False)  # bairro
    city = Column(String(100), nullable=False)
    state = Column(String(2), nullable=False)  # UF
    zipcode = Column(String(20), nullable=False)  # CEP
    country = Column(String(50), default="Brasil")
    
    # Tipo
    address_type = Column(String(50), default="residential")
    is_default = Column(Boolean, default=False)
    
    # Metadados
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 🔥 RELACIONAMENTO
    patient = relationship("PatientProfile", back_populates="addresses")