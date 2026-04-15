from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import Optional, List
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.appointment import Appointment

router = APIRouter(prefix="/empresa/colaboradores-assinaturas", tags=["Empresa - Colaboradores Assinaturas"])


def get_empresa_id_from_user(user: User, db: Session) -> int:
    empresa_profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == user.id).first()
    if not empresa_profile:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    return empresa_profile.id


@router.get("/")
def get_colaboradores_assinaturas(
    start_date: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    months: Optional[str] = Query(None, description="Meses selecionados (ex: 0,1,2)"),
    years: Optional[str] = Query(None, description="Anos selecionados (ex: 2026)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Relatório de assinaturas - lista todos os colaboradores da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    
    # Buscar o plano da empresa
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).first()
    plano_empresa = db.query(EmpresaPlano).filter(EmpresaPlano.id == empresa.plano_id).first() if empresa and empresa.plano_id else None
    
    preco_por_colaborador = plano_empresa.preco_mensal_por_colaborador if plano_empresa else 45
    sessoes_inclusas = plano_empresa.sessoes_inclusas_por_colaborador if plano_empresa else 1
    nome_plano = plano_empresa.nome if plano_empresa else "Prata"
    chave_plano = plano_empresa.chave if plano_empresa else "prata"
    
    # Configurar datas para sessões realizadas
    if months and years:
        meses_list = [int(m) for m in months.split(',')]
        anos_list = [int(y) for y in years.split(',')]
        data_inicio = datetime(anos_list[0], meses_list[0] + 1, 1)
        ultimo_mes = meses_list[-1]
        ultimo_ano = anos_list[-1]
        if ultimo_mes == 11:
            data_fim = datetime(ultimo_ano + 1, 1, 1) - timedelta(days=1)
        else:
            data_fim = datetime(ultimo_ano, ultimo_mes + 2, 1) - timedelta(days=1)
        data_fim = data_fim.replace(hour=23, minute=59, second=59)
    elif start_date and end_date:
        data_inicio = datetime.strptime(start_date, "%Y-%m-%d")
        data_fim = datetime.strptime(end_date, "%Y-%m-%d")
        data_fim = data_fim.replace(hour=23, minute=59, second=59)
    else:
        data_inicio = datetime.now().replace(day=1)
        data_fim = datetime.now()
    
    # Buscar TODOS os colaboradores da empresa
    colaboradores = db.query(PatientProfile).filter(
        PatientProfile.empresa_id == empresa_id
    ).all()
    
    resultado = []
    
    for colab in colaboradores:
        # Verificar se está ativo (access_ends_at é nulo ou maior que hoje)
        is_active = colab.access_ends_at is None or colab.access_ends_at > datetime.now()
        
        # Contar sessões realizadas no período
        sessoes_periodo = db.query(Appointment).filter(
            Appointment.patient_user_id == colab.user_id,
            Appointment.status == "completed",
            Appointment.starts_at >= data_inicio,
            Appointment.starts_at <= data_fim
        ).count()
        
        resultado.append({
            "id": colab.id,
            "user_id": colab.user_id,
            "full_name": colab.full_name,
            "email": colab.email,
            "cpf": colab.cpf,
            "foto_url": colab.foto_url,
            "empresa_id": empresa_id,
            "plano": chave_plano,
            "plano_nome": nome_plano,
            "preco_por_colaborador": preco_por_colaborador,
            "sessoes_inclusas": sessoes_inclusas,
            "is_active": is_active,
            "sessoes_utilizadas_mes": sessoes_periodo,
            "sessoes_disponiveis_mes": sessoes_inclusas,
            "created_at": colab.created_at.isoformat() if colab.created_at else None,
            "access_ends_at": colab.access_ends_at.isoformat() if colab.access_ends_at else None,
            "ultima_sessao": None
        })
    
    return resultado