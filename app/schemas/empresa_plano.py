from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EmpresaPlanoBase(BaseModel):
    nome: str
    chave: str
    preco_mensal_por_colaborador: float
    sessoes_inclusas_por_colaborador: int = 1
    ativo: bool = True
    descricao: Optional[str] = None

class EmpresaPlanoCreate(EmpresaPlanoBase):
    pass

class EmpresaPlanoUpdate(BaseModel):
    nome: Optional[str] = None
    preco_mensal_por_colaborador: Optional[float] = None
    sessoes_inclusas_por_colaborador: Optional[int] = None
    ativo: Optional[bool] = None
    descricao: Optional[str] = None

class EmpresaPlanoResponse(EmpresaPlanoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True