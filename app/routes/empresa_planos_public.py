from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.empresa_plano import EmpresaPlano
from pydantic import BaseModel

router = APIRouter(prefix="/empresa/planos", tags=["Empresa Planos"])


class EmpresaPlanoOut(BaseModel):
    id: int
    nome: str
    chave: str
    preco_mensal_por_colaborador: float
    sessoes_inclusas_por_colaborador: int
    descricao: str | None
    ativo: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[EmpresaPlanoOut])
def listar_planos_empresa(
    db: Session = Depends(get_db),
):
    """
    Lista todos os planos ativos disponíveis para empresas.
    Este endpoint é público (não requer autenticação) para ser usado no cadastro.
    """
    planos = db.query(EmpresaPlano).filter(
        EmpresaPlano.ativo == True
    ).order_by(EmpresaPlano.preco_mensal_por_colaborador).all()
    
    if not planos:
        # Fallback: criar planos padrão se não existirem
        planos_padrao = [
            EmpresaPlano(nome="Prata", chave="prata", preco_mensal_por_colaborador=29.90, sessoes_inclusas_por_colaborador=1, ativo=True, descricao="Plano básico para pequenas empresas"),
            EmpresaPlano(nome="Ouro", chave="ouro", preco_mensal_por_colaborador=49.90, sessoes_inclusas_por_colaborador=3, ativo=True, descricao="Plano intermediário para empresas em crescimento"),
            EmpresaPlano(nome="Diamante", chave="diamante", preco_mensal_por_colaborador=99.90, sessoes_inclusas_por_colaborador=10, ativo=True, descricao="Plano premium para grandes empresas"),
        ]
        for p in planos_padrao:
            db.add(p)
        db.commit()
        return planos_padrao
    
    return planos


@router.get("/{plano_id}", response_model=EmpresaPlanoOut)
def obter_plano_empresa(
    plano_id: int,
    db: Session = Depends(get_db),
):
    """Obtém detalhes de um plano específico"""
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == plano_id).first()
    
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    return plano