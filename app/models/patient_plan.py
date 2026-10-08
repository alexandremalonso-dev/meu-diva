from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric
from sqlalchemy.sql import func
from app.db.database import Base


class PatientPlan(Base):
    """
    Plano de pacote de sessões vendido ao paciente (assinatura mensal no Mercado Pago).
    Equivale ao EmpresaPlano, mas o comprador é o próprio paciente.
    """
    __tablename__ = "patient_plans"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    chave = Column(String(50), unique=True, nullable=False)
    preco_mensal = Column(Numeric(10, 2), nullable=False)
    sessoes_mensais = Column(Integer, nullable=False)
    valor_repassado_terapeuta = Column(Numeric(10, 2), nullable=False, default=50)
    descricao = Column(Text, nullable=True)
    mp_plan_id = Column(String(64), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<PatientPlan(id={self.id}, chave={self.chave}, preco={self.preco_mensal})>"
