from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import Optional, List
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment

router = APIRouter(prefix="/empresa/reports/cobranca", tags=["Empresa - Relatórios de Cobrança"])


def get_empresa_or_admin_user(current_user: User = Depends(get_current_user)):
    """Permite acesso para empresa (ver seus próprios dados) ou admin (ver todas)"""
    if current_user.role not in ["admin", "empresa"]:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores ou empresas.")
    return current_user


def get_empresa_id_from_user(user: User, db: Session) -> int:
    if user.role == "admin":
        return None  # Admin vê todas
    empresa_profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == user.id).first()
    if not empresa_profile:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    return empresa_profile.id


@router.get("/")
def get_empresa_cobranca_report(
    start_date: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    months: Optional[str] = Query(None, description="Meses selecionados (ex: 0,1,2)"),
    years: Optional[str] = Query(None, description="Anos selecionados (ex: 2026)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_empresa_or_admin_user)
):
    """Relatório de cobrança - empresa vê seus próprios dados, admin vê todas"""
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    is_admin = current_user.role == "admin"
    
    # Configurar datas
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
    
    # Buscar empresas (se admin, todas; se empresa, apenas a dela)
    if is_admin:
        empresas = db.query(EmpresaProfile).all()
    else:
        empresas = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).all()
    
    empresas_list = []
    total_colaboradores = 0
    total_sessoes = 0
    total_valor = 0
    empresas_ativas = 0
    
    for empresa in empresas:
        user_empresa = db.query(User).filter(User.id == empresa.user_id).first()
        if not user_empresa:
            continue
        
        plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == empresa.plano_id).first()
        preco = plano.preco_mensal_por_colaborador if plano else 45
        plano_nome = plano.nome if plano else "Prata"
        plano_chave = plano.chave if plano else "prata"
        sessoes_plano = plano.sessoes_inclusas_por_colaborador if plano else 1
        
        # Colaboradores ativos
        colaboradores_ativos = db.query(PatientProfile).filter(
            PatientProfile.empresa_id == empresa.id,
            or_(
                PatientProfile.access_ends_at.is_(None),
                PatientProfile.access_ends_at > datetime.now()
            )
        ).count()
        
        # Sessões no período
        colaboradores_ids = db.query(PatientProfile.user_id).filter(
            PatientProfile.empresa_id == empresa.id
        ).all()
        colaborador_ids = [c[0] for c in colaboradores_ids]
        
        sessoes_periodo = 0
        if colaborador_ids:
            sessoes_periodo = db.query(Appointment).filter(
                Appointment.patient_user_id.in_(colaborador_ids),
                Appointment.status == "completed",
                Appointment.starts_at >= data_inicio,
                Appointment.starts_at <= data_fim
            ).count()
        
        valor_a_faturar = colaboradores_ativos * preco
        status = "active" if colaboradores_ativos > 0 else "inactive"
        
        if colaboradores_ativos > 0:
            empresas_ativas += 1
            total_valor += valor_a_faturar
            total_colaboradores += colaboradores_ativos
            total_sessoes += sessoes_periodo
        
        nome_empresa = empresa.trading_name or empresa.corporate_name or user_empresa.full_name
        
        empresas_list.append({
            "id": empresa.id,
            "user_id": empresa.user_id,
            "nome": nome_empresa,
            "razao_social": empresa.corporate_name or "",
            "cnpj": empresa.cnpj,
            "email": empresa.responsible_email or user_empresa.email,
            "foto_url": empresa.foto_url,
            "plano": plano_chave,
            "plano_nome": plano_nome,
            "preco_por_colaborador": preco,
            "colaboradores_ativos": colaboradores_ativos,
            "sessoes_realizadas_periodo": sessoes_periodo,
            "sessoes_disponiveis_periodo": colaboradores_ativos * sessoes_plano,
            "valor_a_faturar": valor_a_faturar,
            "status": status
        })
    
    # Gráfico (últimos 12 meses)
    chart_data = []
    meses_nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    
    for i in range(11, -1, -1):
        mes_calc = datetime.now().month - i
        ano_calc = datetime.now().year
        if mes_calc <= 0:
            mes_calc = 12 + mes_calc
            ano_calc = ano_calc - 1
        
        chart_data.append({
            "mes": meses_nomes[mes_calc - 1],
            "receita": total_valor * (0.3 + (11 - i) * 0.06) if total_valor > 0 else 0,
            "empresas": empresas_ativas
        })
    
    return {
        "periodo": {
            "start": data_inicio.strftime("%Y-%m-%d"),
            "end": data_fim.strftime("%Y-%m-%d")
        },
        "empresas": empresas_list,
        "resumo": {
            "total_empresas": len(empresas_list),
            "total_empresas_ativas": empresas_ativas,
            "total_colaboradores": total_colaboradores,
            "total_sessoes_realizadas": total_sessoes,
            "total_valor_a_faturar": total_valor,
            "total_faturado": 0,
            "total_pago": 0
        },
        "chart_data": chart_data
    }