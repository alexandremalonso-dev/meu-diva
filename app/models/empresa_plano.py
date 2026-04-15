from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class EmpresaPlano(Base):
    __tablename__ = "empresa_planos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, comment="Nome do plano (ex: Prata, Ouro, Diamante)")
    chave = Column(String(50), unique=True, nullable=False, comment="Identificador único (ex: prata, ouro, diamante)")
    preco_mensal_por_colaborador = Column(Float, nullable=False, comment="Preço mensal por colaborador ativo")
    sessoes_inclusas_por_colaborador = Column(Integer, nullable=False, default=1, comment="Número de sessões inclusas por mês")
    ativo = Column(Boolean, default=True, nullable=False, comment="Se o plano está ativo para novas contratações")
    descricao = Column(Text, nullable=True, comment="Descrição do plano")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamento com empresas
    empresas = relationship("EmpresaProfile", back_populates="plano")

    def __repr__(self):
        return f"<EmpresaPlano(id={self.id}, nome={self.nome}, preco={self.preco_mensal_por_colaborador})>"