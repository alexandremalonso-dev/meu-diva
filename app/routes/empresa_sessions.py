from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment
from app.core.security import get_current_user

router = APIRouter(prefix="/empresa/sessions", tags=["Empresa Sessions"])


# 🔥 FUNÇÃO PARA PERMITIR ADMIN OU EMPRESA
def get_admin_or_empresa_user(current_user: User = Depends(get_current_user)):
    """Permite acesso para admin ou empresa"""
    if current_user.role not in ["admin", "empresa"]:
        raise HTTPException(
            status_code=403, 
            detail="Acesso negado. Apenas administradores ou empresas."
        )
    return current_user


# ============================================================
# SCHEMAS
# ============================================================

class EmpresaSessionsResponse(BaseModel):
    empresa_id: int
    empresa_nome: str
    total_sessoes: int
    colaboradores_ativos: int
    sessoes_por_colaborador: float
    periodo_inicio: str
    periodo_fim: str


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/")
async def get_empresa_sessions(
    start_date: str = Query(..., description="Data inicial (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Data final (YYYY-MM-DD)"),
    empresa_id: Optional[int] = Query(None, description="ID da empresa (opcional, apenas para admin)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_empresa_user)  # 🔥 USAR A NOVA FUNÇÃO
):
    """
    Retorna o total de sessões realizadas por empresa em um período.
    Acesso: admin (todas empresas) ou empresa (apenas sua própria empresa)
    """
    
    # 🔥 SE FOR ADMIN, PODE FILTRAR POR empresa_id OU VER TODAS
    if current_user.role == "admin":
        # Admin pode ver todas as empresas
        if empresa_id:
            empresas = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).all()
        else:
            empresas = db.query(EmpresaProfile).all()
    else:
        # Empresa só pode ver seus próprios dados
        empresa_profile = db.query(EmpresaProfile).filter(
            EmpresaProfile.user_id == current_user.id
        ).first()
        if not empresa_profile:
            raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
        empresas = [empresa_profile]
    
    # Validar datas
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use YYYY-MM-DD")
    
    resultados = []
    
    for empresa in empresas:
        # Buscar colaboradores da empresa
        colaboradores = db.query(PatientProfile).filter(
            PatientProfile.empresa_id == empresa.id
        ).all()
        
        colaborador_ids = [c.user_id for c in colaboradores if c.user_id]
        
        # Contar sessões realizadas no período
        appointments_completed = 0
        if colaborador_ids:
            appointments_completed = db.query(Appointment).filter(
                and_(
                    Appointment.patient_user_id.in_(colaborador_ids),
                    Appointment.status == "completed",
                    Appointment.starts_at >= start,
                    Appointment.starts_at <= end
                )
            ).count()
        
        total_sessoes = appointments_completed
        
        # Contar colaboradores ativos
        colaboradores_ativos = db.query(PatientProfile).filter(
            and_(
                PatientProfile.empresa_id == empresa.id,
                PatientProfile.access_ends_at > datetime.now()
            )
        ).count()
        
        # Nome da empresa
        nome_empresa = empresa.trading_name or empresa.corporate_name or f"Empresa {empresa.id}"
        
        resultados.append({
            "empresa_id": empresa.id,
            "empresa_nome": nome_empresa,
            "total_sessoes": total_sessoes,
            "colaboradores_ativos": colaboradores_ativos,
            "sessoes_por_colaborador": round(total_sessoes / colaboradores_ativos, 2) if colaboradores_ativos > 0 else 0,
            "periodo_inicio": start_date,
            "periodo_fim": end_date
        })
    
    return resultados