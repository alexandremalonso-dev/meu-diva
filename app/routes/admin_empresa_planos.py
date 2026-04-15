from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.empresa_plano import EmpresaPlano
from app.schemas.empresa_plano import EmpresaPlanoCreate, EmpresaPlanoUpdate, EmpresaPlanoResponse

router = APIRouter(prefix="/admin/empresas/planos", tags=["Admin - Empresas Planos"])


@router.get("", response_model=List[EmpresaPlanoResponse])
def listar_planos(
    apenas_ativos: bool = Query(False, description="Se true, retorna apenas planos ativos"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Lista todos os planos empresariais"""
    query = db.query(EmpresaPlano)
    if apenas_ativos:
        query = query.filter(EmpresaPlano.ativo == True)
    planos = query.order_by(EmpresaPlano.preco_mensal_por_colaborador).all()
    return planos


@router.get("/{plano_id}", response_model=EmpresaPlanoResponse)
def get_plano(
    plano_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Retorna um plano específico"""
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == plano_id).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    return plano


@router.post("/add", response_model=EmpresaPlanoResponse)
def add_plano(
    plano_data: EmpresaPlanoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Adiciona um novo plano empresarial"""
    # Verificar se chave já existe
    existing = db.query(EmpresaPlano).filter(EmpresaPlano.chave == plano_data.chave).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Plano com chave '{plano_data.chave}' já existe")
    
    novo_plano = EmpresaPlano(
        nome=plano_data.nome,
        chave=plano_data.chave,
        preco_mensal_por_colaborador=plano_data.preco_mensal_por_colaborador,
        sessoes_inclusas_por_colaborador=plano_data.sessoes_inclusas_por_colaborador,
        ativo=plano_data.ativo,
        descricao=plano_data.descricao
    )
    db.add(novo_plano)
    db.commit()
    db.refresh(novo_plano)
    return novo_plano


@router.post("/update")
def update_plano(
    plano_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Atualiza um plano existente"""
    chave = plano_data.get("chave")
    if not chave:
        raise HTTPException(status_code=400, detail="Chave do plano é obrigatória")
    
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.chave == chave).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    if "preco_mensal_por_colaborador" in plano_data:
        plano.preco_mensal_por_colaborador = plano_data["preco_mensal_por_colaborador"]
    if "sessoes_inclusas_por_colaborador" in plano_data:
        plano.sessoes_inclusas_por_colaborador = plano_data["sessoes_inclusas_por_colaborador"]
    if "nome" in plano_data:
        plano.nome = plano_data["nome"]
    if "ativo" in plano_data:
        plano.ativo = plano_data["ativo"]
    if "descricao" in plano_data:
        plano.descricao = plano_data["descricao"]
    
    db.commit()
    db.refresh(plano)
    
    return {"success": True, "message": f"Plano {plano.nome} atualizado com sucesso"}


@router.post("/toggle-status")
def toggle_plano_status(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Ativa/desativa um plano"""
    chave = data.get("chave")
    ativo = data.get("ativo", True)
    
    if not chave:
        raise HTTPException(status_code=400, detail="Chave do plano é obrigatória")
    
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.chave == chave).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    plano.ativo = ativo
    db.commit()
    
    return {"success": True, "message": f"Plano {plano.nome} {'ativado' if ativo else 'desativado'} com sucesso"}


@router.delete("/{plano_id}")
def delete_plano(
    plano_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    """Remove um plano (apenas se não houver empresas vinculadas)"""
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == plano_id).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    # Verificar se há empresas usando este plano
    from app.models.empresa_profile import EmpresaProfile
    empresas_count = db.query(EmpresaProfile).filter(EmpresaProfile.plano_id == plano_id).count()
    if empresas_count > 0:
        raise HTTPException(status_code=400, detail=f"Não é possível excluir o plano. Existem {empresas_count} empresas vinculadas a ele.")
    
    db.delete(plano)
    db.commit()
    
    return {"success": True, "message": f"Plano {plano.nome} removido com sucesso"}