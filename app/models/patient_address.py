from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class PatientAddress(Base):
    __tablename__ = "patient_addresses"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False, index=True)
    
    # Endereço
    street = Column(String(255), nullable=False)
    number = Column(String(20), nullable=False)
    complement = Column(String(255))
    neighborhood = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(2), nullable=False)  # 🔥 ALTERADO para VARCHAR(2) (UF)
    zip_code = Column(String(10), nullable=False)  # 🔥 ALTERADO para zip_code (com _)
    
    # Tipo
    address_type = Column(String(50), default="residential")
    is_default = Column(Boolean, default=False)
    
    # 🔥 RELACIONAMENTO CORRETO
    patient = relationship("PatientProfile", back_populates="addresses")