from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from collections import Counter
import re

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile

router = APIRouter(prefix="/empresa/analytics", tags=["Empresa Analytics"])


def get_empresa_id_from_user(user: User, db: Session) -> int:
    """Obtém o ID da empresa a partir do usuário logado"""
    empresa_profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == user.id).first()
    if not empresa_profile:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    return empresa_profile.id


def get_colaboradores_ids(empresa_id: int, db: Session) -> List[int]:
    """Retorna lista de IDs dos colaboradores da empresa"""
    colaboradores = db.query(PatientProfile.user_id).filter(
        PatientProfile.empresa_id == empresa_id
    ).all()
    return [c[0] for c in colaboradores]


@router.get("/dashboard")
def get_analytics_dashboard(
    periodo: str = Query("month", description="week, month, quarter, year, all"),
    comparar_com: Optional[str] = Query(None, description="previous_month, previous_year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dashboard de analytics - dados agregados e anonimizados"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    if not colaboradores_ids:
        return {
            "message": "Nenhum colaborador encontrado para esta empresa",
            "resumo": {
                "total_sessoes": 0,
                "sessoes_completadas": 0,
                "sessoes_canceladas": 0,
                "sessoes_reagendadas": 0,
                "taxa_conclusao": 0,
                "taxa_cancelamento": 0,
                "taxa_nao_comparecimento": 0,
                "colaboradores_ativos": 0,
                "total_colaboradores": 0,
                "taxa_engajamento": 0,
                "valor_total": 0,
                "valor_medio_sessao": 0
            },
            "evolucao_mensal": [],
            "comparacao": None,
            "nao_ocorrencias": {"total": 0, "taxa": 0, "motivos": []},
            "desfechos": [],
            "analise_textual": {"palavras_chave": [], "categorias": []}
        }
    
    # Definir períodos
    hoje = datetime.now()
    
    if periodo == "week":
        data_inicio = hoje - timedelta(days=7)
        data_fim = hoje
        periodo_anterior_inicio = hoje - timedelta(days=14)
        periodo_anterior_fim = hoje - timedelta(days=8)
    elif periodo == "month":
        data_inicio = hoje.replace(day=1)
        data_fim = hoje
        if data_inicio.month == 1:
            periodo_anterior_inicio = hoje.replace(year=hoje.year-1, month=12, day=1)
        else:
            periodo_anterior_inicio = hoje.replace(month=hoje.month-1, day=1)
        periodo_anterior_fim = data_inicio - timedelta(days=1)
    elif periodo == "quarter":
        trimestre = (hoje.month - 1) // 3
        data_inicio = datetime(hoje.year, trimestre*3 + 1, 1)
        data_fim = hoje
        if trimestre == 0:
            periodo_anterior_inicio = datetime(hoje.year-1, 10, 1)
        else:
            periodo_anterior_inicio = datetime(hoje.year, (trimestre-1)*3 + 1, 1)
        periodo_anterior_fim = data_inicio - timedelta(days=1)
    elif periodo == "year":
        data_inicio = datetime(hoje.year, 1, 1)
        data_fim = hoje
        periodo_anterior_inicio = datetime(hoje.year-1, 1, 1)
        periodo_anterior_fim = datetime(hoje.year-1, 12, 31)
    else:
        data_inicio = datetime(2020, 1, 1)
        data_fim = hoje
        periodo_anterior_inicio = None
        periodo_anterior_fim = None
    
    # Buscar appointments dos colaboradores
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids),
        Appointment.starts_at >= data_inicio,
        Appointment.starts_at <= data_fim
    ).all()
    
    # Buscar medical records
    appointment_ids = [apt.id for apt in appointments]
    medical_records = db.query(MedicalRecord).filter(
        MedicalRecord.appointment_id.in_(appointment_ids)
    ).all() if appointment_ids else []
    
    # ==========================
    # 1. MÉTRICAS GERAIS
    # ==========================
    total_sessoes = len(appointments)
    sessoes_completadas = len([apt for apt in appointments if apt.status == "completed"])
    sessoes_canceladas = len([apt for apt in appointments if apt.status in ["cancelled_by_patient", "cancelled_by_therapist"]])
    sessoes_reagendadas = len([apt for apt in appointments if apt.status == "rescheduled"])
    
    taxa_conclusao = round((sessoes_completadas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    taxa_cancelamento = round((sessoes_canceladas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    taxa_reagendamento = round((sessoes_reagendadas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    
    # Sessões não ocorridas
    sessoes_nao_ocorridas = len([mr for mr in medical_records if mr.session_not_occurred])
    taxa_nao_comparecimento = round((sessoes_nao_ocorridas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    
    # Motivos de não ocorrência
    motivos_nao_ocorrencia = Counter()
    for mr in medical_records:
        if mr.session_not_occurred and mr.not_occurred_reason:
            motivos_nao_ocorrencia[mr.not_occurred_reason] += 1
    
    # Desfechos
    outcomes = Counter()
    for mr in medical_records:
        if mr.outcome:
            outcomes[mr.outcome] += 1
    
    # Colaboradores ativos
    colaboradores_ativos = len(set([apt.patient_user_id for apt in appointments]))
    taxa_engajamento = round((colaboradores_ativos / len(colaboradores_ids) * 100), 1) if colaboradores_ids else 0
    
    # Valor médio por sessão
    valor_total = sum(float(apt.session_price or 0) for apt in appointments if apt.status == "completed")
    valor_medio_sessao = round(valor_total / sessoes_completadas, 2) if sessoes_completadas > 0 else 0
    
    # ==========================
    # 2. EVOLUÇÃO TEMPORAL
    # ==========================
    evolucao_mensal = []
    evolucao_mensal_dict = {}
    
    for apt in appointments:
        mes_key = apt.starts_at.strftime("%Y-%m")
        if mes_key not in evolucao_mensal_dict:
            evolucao_mensal_dict[mes_key] = {"total": 0, "completed": 0, "cancelled": 0, "receita": 0}
        evolucao_mensal_dict[mes_key]["total"] += 1
        if apt.status == "completed":
            evolucao_mensal_dict[mes_key]["completed"] += 1
            evolucao_mensal_dict[mes_key]["receita"] += float(apt.session_price or 0)
        elif apt.status in ["cancelled_by_patient", "cancelled_by_therapist"]:
            evolucao_mensal_dict[mes_key]["cancelled"] += 1
    
    for mes, dados in sorted(evolucao_mensal_dict.items()):
        evolucao_mensal.append({
            "periodo": mes,
            "total_sessoes": dados["total"],
            "sessoes_completadas": dados["completed"],
            "sessoes_canceladas": dados["cancelled"],
            "receita": round(dados["receita"], 2)
        })
    
    # ==========================
    # 3. COMPARAÇÃO COM PERÍODO ANTERIOR
    # ==========================
    comparacao = None
    if comparar_com and periodo_anterior_inicio and periodo_anterior_fim:
        appointments_anterior = db.query(Appointment).filter(
            Appointment.patient_user_id.in_(colaboradores_ids),
            Appointment.starts_at >= periodo_anterior_inicio,
            Appointment.starts_at <= periodo_anterior_fim
        ).all()
        
        total_anterior = len(appointments_anterior)
        completadas_anterior = len([apt for apt in appointments_anterior if apt.status == "completed"])
        taxa_conclusao_anterior = round((completadas_anterior / total_anterior * 100), 1) if total_anterior > 0 else 0
        
        colaboradores_ativos_anterior = len(set([apt.patient_user_id for apt in appointments_anterior]))
        taxa_engajamento_anterior = round((colaboradores_ativos_anterior / len(colaboradores_ids) * 100), 1) if colaboradores_ids else 0
        
        comparacao = {
            "periodo_anterior": {
                "inicio": periodo_anterior_inicio.strftime("%Y-%m-%d"),
                "fim": periodo_anterior_fim.strftime("%Y-%m-%d"),
                "total_sessoes": total_anterior,
                "sessoes_completadas": completadas_anterior,
                "taxa_conclusao": taxa_conclusao_anterior,
                "colaboradores_ativos": colaboradores_ativos_anterior,
                "taxa_engajamento": taxa_engajamento_anterior
            },
            "variacao": {
                "sessoes": round(((total_sessoes - total_anterior) / total_anterior * 100), 1) if total_anterior > 0 else 100,
                "taxa_conclusao": round(taxa_conclusao - taxa_conclusao_anterior, 1),
                "engajamento": round(taxa_engajamento - taxa_engajamento_anterior, 1)
            }
        }
    
    # ==========================
    # 4. ANÁLISE DE PALAVRAS-CHAVE (AGREGADA E ANONIMIZADA)
    # ==========================
    palavras_ignore = {"que", "com", "para", "por", "mais", "muito", "bem", "estou", "esta", "este", "isso", "aquilo", "tudo", "hoje", "ontem", "semana", "mes", "ano", "foi", "sendo", "estar", "como", "mas", "ou", "se", "quando", "porque", "entao", "assim", "tambem", "ainda", "sobre", "ate", "sem", "apos", "entre"}
    
    palavras_chave = Counter()
    for mr in medical_records:
        if mr.evolution:
            texto = mr.evolution.lower()
            palavras = re.findall(r'[a-záéíóúãõç]+', texto)
            for palavra in palavras:
                if len(palavra) > 3 and palavra not in palavras_ignore:
                    palavras_chave[palavra] += 1
    
    top_palavras = [{"palavra": p, "frequencia": f} for p, f in palavras_chave.most_common(10)]
    
    # Categorização automática
    categorias = {
        "ansiedade": ["ansioso", "ansiedade", "preocupado", "medo", "nervoso", "tenso", "angustia", "angustiado"],
        "depressao": ["depressão", "depressivo", "triste", "desânimo", "desanimado", "melancolia", "vazio"],
        "estresse": ["estresse", "estressado", "pressão", "sobrecarga", "exaustão", "esgotado"],
        "relacionamento": ["relacionamento", "família", "amigos", "parceiro", "casamento", "filhos", "pais"],
        "trabalho": ["trabalho", "emprego", "carreira", "profissional", "chefe", "colegas"],
        "saude": ["saúde", "doença", "dor", "sintoma", "tratamento", "medicação"],
        "melhora": ["melhor", "melhoria", "evolução", "evoluiu", "progresso", "avanço", "bom", "ótimo", "positivo"],
        "piora": ["pior", "piora", "deteriorou", "regrediu", "difícil", "dificuldade", "negativo"]
    }
    
    categorias_contagem = {cat: 0 for cat in categorias.keys()}
    for mr in medical_records:
        if mr.evolution:
            texto = mr.evolution.lower()
            for cat, palavras in categorias.items():
                if any(palavra in texto for palavra in palavras):
                    categorias_contagem[cat] += 1
    
    return {
        "periodo": {
            "tipo": periodo,
            "inicio": data_inicio.strftime("%Y-%m-%d"),
            "fim": data_fim.strftime("%Y-%m-%d")
        },
        "resumo": {
            "total_sessoes": total_sessoes,
            "sessoes_completadas": sessoes_completadas,
            "sessoes_canceladas": sessoes_canceladas,
            "sessoes_reagendadas": sessoes_reagendadas,
            "taxa_conclusao": taxa_conclusao,
            "taxa_cancelamento": taxa_cancelamento,
            "taxa_reagendamento": taxa_reagendamento,
            "taxa_nao_comparecimento": taxa_nao_comparecimento,
            "colaboradores_ativos": colaboradores_ativos,
            "total_colaboradores": len(colaboradores_ids),
            "taxa_engajamento": taxa_engajamento,
            "valor_total": round(valor_total, 2),
            "valor_medio_sessao": valor_medio_sessao
        },
        "evolucao_mensal": evolucao_mensal,
        "comparacao": comparacao,
        "nao_ocorrencias": {
            "total": sessoes_nao_ocorridas,
            "taxa": taxa_nao_comparecimento,
            "motivos": [{"motivo": k, "quantidade": v} for k, v in motivos_nao_ocorrencia.most_common()]
        },
        "desfechos": [{"desfecho": k, "quantidade": v} for k, v in outcomes.most_common()],
        "analise_textual": {
            "palavras_chave": top_palavras,
            "categorias": [{"categoria": k.replace("_", " ").title(), "ocorrencias": v} for k, v in categorias_contagem.items() if v > 0]
        }
    }


@router.get("/chart-data")
def get_analytics_chart_data(
    periodo: str = Query("month", description="week, month, quarter, year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dados para gráficos do analytics"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    if not colaboradores_ids:
        return {"data": []}
    
    # Definir período
    hoje = datetime.now()
    
    if periodo == "week":
        data_inicio = hoje - timedelta(days=30)
    elif periodo == "month":
        data_inicio = hoje - timedelta(days=180)
    elif periodo == "quarter":
        data_inicio = hoje - timedelta(days=365)
    else:
        data_inicio = hoje - timedelta(days=730)
    
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids),
        Appointment.starts_at >= data_inicio
    ).order_by(Appointment.starts_at.asc()).all()
    
    dados_mensais = {}
    for apt in appointments:
        mes_key = apt.starts_at.strftime("%Y-%m")
        if mes_key not in dados_mensais:
            dados_mensais[mes_key] = {
                "periodo": mes_key,
                "total": 0,
                "completadas": 0,
                "canceladas": 0,
                "valor_total": 0
            }
        dados_mensais[mes_key]["total"] += 1
        if apt.status == "completed":
            dados_mensais[mes_key]["completadas"] += 1
            dados_mensais[mes_key]["valor_total"] += float(apt.session_price or 0)
        elif apt.status in ["cancelled_by_patient", "cancelled_by_therapist"]:
            dados_mensais[mes_key]["canceladas"] += 1
    
    return {
        "data": list(dados_mensais.values()),
        "metricas_disponiveis": ["total", "completadas", "canceladas", "valor_total"]
    }