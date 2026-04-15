from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum

class EmpresaStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"

class PlanoEnum(str, Enum):
    prata = "prata"
    ouro = "ouro"
    diamante = "diamante"

class EmpresaOut(BaseModel):
    id: int
    user_id: int
    nome: str
    razao_social: str
    cnpj: Optional[str]
    email: str
    telefone: Optional[str]
    plano_atual: str
    plano_nome: str
    status: EmpresaStatusEnum
    total_colaboradores: int
    colaboradores_ativos: int
    data_cadastro: datetime
    preco_por_colaborador: Optional[float] = 45.0
    sessoes_inclusas: Optional[int] = 1
    foto_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class HistoricoPlanoOut(BaseModel):
    id: int
    empresa_id: int
    plano: str
    plano_nome: str
    data_inicio: datetime
    data_fim: Optional[datetime]
    motivo: Optional[str]
    
    class Config:
        from_attributes = True

class AlterarPlanoRequest(BaseModel):
    novo_plano: PlanoEnum
    data_inicio: datetime
    motivo: Optional[str]

class AlterarStatusRequest(BaseModel):
    status: EmpresaStatusEnum

class EmpresaInvoiceOut(BaseModel):
    id: int
    empresa_id: int
    empresa_nome: str
    invoice_number: str
    reference_month: str
    total_amount: float
    status: str  # pending, invoiced, paid
    invoice_url: str
    filename: str
    due_date: datetime
    paid_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True