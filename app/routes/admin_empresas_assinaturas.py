from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment

router = APIRouter(prefix="/admin/reports/empresas-assinaturas", tags=["Admin - Relatório Empresas Assinaturas"])


def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
    return current_user


@router.get("")
def get_empresas_assinaturas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Retorna relatório de assinaturas de empresas"""
    
    empresas = db.query(EmpresaProfile).all()
    
    result = []
    for empresa in empresas:
        # Buscar usuário da empresa
        user_empresa = db.query(User).filter(User.id == empresa.user_id).first()
        if not user_empresa:
            continue
        
        # Buscar plano
        plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == empresa.plano_id).first()
        
        if not plano:
            print(f"⚠️ Empresa {empresa.id} não tem plano associado!")
            preco = 0
            sessoes_plano = 0
            plano_chave = "sem_plano"
            plano_nome = "Sem Plano"
        else:
            preco = plano.preco_mensal_por_colaborador
            sessoes_plano = plano.sessoes_inclusas_por_colaborador
            plano_chave = plano.chave
            plano_nome = plano.nome
        
        # Buscar colaboradores
        colaboradores = db.query(PatientProfile).filter(PatientProfile.empresa_id == empresa.id).all()
        total_colaboradores = len(colaboradores)
        
        # 🔥 COLABORADORES ATIVOS (access_ends_at NULL ou > hoje)
        colaboradores_ativos = db.query(PatientProfile).filter(
            and_(
                PatientProfile.empresa_id == empresa.id,
                PatientProfile.access_ends_at.is_(None)
            )
        ).count()
        
        colaboradores_ativos += db.query(PatientProfile).filter(
            and_(
                PatientProfile.empresa_id == empresa.id,
                PatientProfile.access_ends_at > datetime.now()
            )
        ).count()
        
        # Buscar sessões realizadas
        colaboradores_ids = [c.user_id for c in colaboradores if c.user_id]
        sessoes_realizadas = 0
        if colaboradores_ids:
            sessoes_realizadas = db.query(Appointment).filter(
                Appointment.patient_user_id.in_(colaboradores_ids),
                Appointment.status == "completed"
            ).count()
        
        # Calcular receita mensal
        receita_mensal = colaboradores_ativos * preco
        
        # 🔥 GARANTIR QUE A FOTO_URL SEJA RETORNADA
        foto_url = empresa.foto_url
        if not foto_url:
            # Tentar buscar foto do usuário da empresa como fallback
            foto_url = user_empresa.foto_url
        
        print(f"📊 Empresa: {empresa.trading_name or empresa.corporate_name or user_empresa.full_name}")
        print(f"   - Foto URL: {foto_url}")
        print(f"   - Plano: {plano_nome} (R$ {preco})")
        print(f"   - Colaboradores ativos: {colaboradores_ativos}")
        print(f"   - Receita mensal: R$ {receita_mensal}")
        
        result.append({
            "id": empresa.id,
            "empresa_id": empresa.id,
            "empresa_name": empresa.trading_name or empresa.corporate_name or user_empresa.full_name,
            "empresa_email": user_empresa.email,
            "empresa_cnpj": empresa.cnpj,
            "empresa_foto_url": foto_url,  # 🔥 CAMPO CORRETO
            "empresa_user_id": empresa.user_id,
            "plano": plano_chave,
            "plano_nome": plano_nome,
            "preco_por_colaborador": preco,
            "sessoes_inclusas": sessoes_plano,
            "status": "active",
            "total_colaboradores": total_colaboradores,
            "colaboradores_ativos": colaboradores_ativos,
            "sessoes_realizadas": sessoes_realizadas,
            "sessoes_disponiveis": colaboradores_ativos * sessoes_plano,
            "receita_mensal": receita_mensal,
            "created_at": empresa.created_at.isoformat() if empresa.created_at else None,
            "updated_at": empresa.updated_at.isoformat() if empresa.updated_at else None
        })
    
    return result