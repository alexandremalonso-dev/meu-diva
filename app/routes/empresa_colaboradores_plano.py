from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.patient_profile import PatientProfile
from app.models.empresa_plano import EmpresaPlano
from app.core.security import get_current_user

router = APIRouter(prefix="/empresa/colaboradores", tags=["Empresa Colaboradores"])

# ============================================================
# SCHEMAS
# ============================================================

class AlterarPlanoColaboradorRequest(BaseModel):
    plano: str  # prata, ouro, diamante

# ============================================================
# ENDPOINT: ALTERAR PLANO DO COLABORADOR
# ============================================================

@router.post("/{colaborador_user_id}/alterar-plano")
async def alterar_plano_colaborador(
    colaborador_user_id: int,
    request: AlterarPlanoColaboradorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Altera o plano de um colaborador (paciente vinculado à empresa).
    Acesso: apenas empresas (admin da empresa)
    """
    
    # 1. Verificar se o usuário logado é uma empresa
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas empresas podem alterar planos de colaboradores.")
    
    # 2. Buscar o perfil da empresa logada
    empresa_profile = db.query(EmpresaProfile).filter(
        EmpresaProfile.user_id == current_user.id
    ).first()
    
    if not empresa_profile:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # 3. Buscar o colaborador (paciente) pelo user_id
    colaborador = db.query(PatientProfile).filter(
        PatientProfile.user_id == colaborador_user_id
    ).first()
    
    if not colaborador:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    
    # 4. Verificar se o colaborador pertence à empresa logada
    if colaborador.empresa_id != empresa_profile.id:
        raise HTTPException(status_code=403, detail="Este colaborador não pertence à sua empresa")
    
    # 5. Buscar o novo plano na tabela empresa_planos
    novo_plano = db.query(EmpresaPlano).filter(
        EmpresaPlano.chave == request.plano
    ).first()
    
    if not novo_plano:
        raise HTTPException(status_code=404, detail=f"Plano '{request.plano}' não encontrado")
    
    # 6. 🔥 PERSISTIR O PLANO NO COLABORADOR
    colaborador.plano_id = novo_plano.id
    colaborador.updated_at = datetime.now()
    db.commit()
    
    # 7. 🔥 Buscar os dados atualizados para retornar
    db.refresh(colaborador)
    
    return {
        "success": True,
        "message": f"Plano alterado para {novo_plano.nome}",
        "colaborador_id": colaborador.id,
        "novo_plano": {
            "id": novo_plano.id,
            "chave": novo_plano.chave,
            "nome": novo_plano.nome,
            "preco_mensal_por_colaborador": novo_plano.preco_mensal_por_colaborador,
            "sessoes_inclusas_por_colaborador": novo_plano.sessoes_inclusas_por_colaborador
        }
    }