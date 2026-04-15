from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, or_
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
from app.models.empresa_plano import EmpresaPlano
from app.models.empresa_invoice import EmpresaInvoice  # Importar modelo de invoice

router = APIRouter(prefix="/empresa/reports", tags=["Empresa Reports"])


def get_empresa_id_from_user(user: User, db: Session) -> int:
    """Retorna o ID do perfil da empresa a partir do usuário logado"""
    empresa_profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == user.id).first()
    if not empresa_profile:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    return empresa_profile.id


def get_colaboradores_ids(empresa_id: int, db: Session) -> List[int]:
    """Retorna a lista de user_ids dos colaboradores (pacientes) da empresa"""
    colaboradores = db.query(PatientProfile.user_id).filter(
        PatientProfile.empresa_id == empresa_id
    ).all()
    return [c[0] for c in colaboradores]


def get_plano_da_empresa(empresa_id: int, db: Session):
    """Busca o plano da empresa e seus valores"""
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).first()
    if not empresa or not empresa.plano_id:
        return None
    
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == empresa.plano_id).first()
    return plano


def get_colaboradores_ativos_no_mes(empresa_id: int, ano: int, mes: int, db: Session) -> int:
    """
    Conta quantos colaboradores estavam ativos em um determinado mês.
    Um colaborador é considerado ativo se foi criado antes ou durante o mês
    e sua data de expiração (se houver) é posterior ao mês.
    """
    data_inicio_mes = datetime(ano, mes, 1)
    if mes == 12:
        data_fim_mes = datetime(ano + 1, 1, 1) - timedelta(days=1)
    else:
        data_fim_mes = datetime(ano, mes + 1, 1) - timedelta(days=1)
    data_fim_mes = data_fim_mes.replace(hour=23, minute=59, second=59)
    
    colaboradores_ativos = db.query(PatientProfile).filter(
        PatientProfile.empresa_id == empresa_id,
        PatientProfile.created_at <= data_fim_mes,
        or_(
            PatientProfile.access_ends_at.is_(None),
            PatientProfile.access_ends_at > data_inicio_mes
        )
    ).count()
    
    return colaboradores_ativos


# ==========================
# 🔥 NOTAS FISCAIS DA EMPRESA
# ==========================
@router.get("/cobranca/invoices")
def get_empresa_cobranca_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retorna todas as notas fiscais da empresa logada (histórico completo)"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    # Buscar perfil da empresa
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # Buscar invoices da empresa
    invoices = db.query(EmpresaInvoice).filter(
        EmpresaInvoice.empresa_id == empresa.id
    ).order_by(EmpresaInvoice.reference_month.desc()).all()
    
    return [
        {
            "id": inv.id,
            "empresa_id": inv.empresa_id,
            "empresa_nome": empresa.trading_name or empresa.corporate_name or current_user.full_name,
            "invoice_number": inv.invoice_number,
            "reference_month": inv.reference_month,
            "total_amount": float(inv.total_amount),
            "status": inv.status,
            "invoice_url": inv.invoice_url,
            "filename": inv.filename,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None
        }
        for inv in invoices
    ]


# ==========================
# 🔥 RELATÓRIO FINANCEIRO DA EMPRESA
# ==========================
@router.get("/financeiro")
def get_empresa_financeiro_report(
    start_date: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    months: Optional[str] = Query(None, description="Meses selecionados (ex: 0,1,2)"),
    years: Optional[str] = Query(None, description="Anos selecionados (ex: 2026)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Relatório financeiro da empresa - colaboradores e faturamento"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    # Buscar o plano da empresa
    plano_empresa = get_plano_da_empresa(empresa_id, db)
    preco_por_colaborador = plano_empresa.preco_mensal_por_colaborador if plano_empresa else 45
    sessoes_inclusas = plano_empresa.sessoes_inclusas_por_colaborador if plano_empresa else 1
    nome_plano = plano_empresa.nome if plano_empresa else "Prata"
    chave_plano = plano_empresa.chave if plano_empresa else "prata"
    
    # Configurar datas com base nos filtros
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
        data_inicio = datetime.now() - timedelta(days=30)
        data_fim = datetime.now()
    
    # Buscar invoices para calcular total faturado e pago
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).first()
    invoices = db.query(EmpresaInvoice).filter(
        EmpresaInvoice.empresa_id == empresa_id
    ).all() if empresa else []
    
    total_faturado = sum(float(inv.total_amount) for inv in invoices)
    total_pago = sum(float(inv.total_amount) for inv in invoices if inv.status == "paid")
    
    # Lista de colaboradores
    colaboradores_list = []
    total_sessoes_periodo = 0
    
    for user_id in colaboradores_ids:
        paciente = db.query(PatientProfile).filter(PatientProfile.user_id == user_id).first()
        if not paciente:
            continue
        
        is_active = paciente.access_ends_at is None or paciente.access_ends_at > datetime.now()
        
        sessoes_periodo = db.query(Appointment).filter(
            Appointment.patient_user_id == user_id,
            Appointment.status == "completed",
            Appointment.starts_at >= data_inicio,
            Appointment.starts_at <= data_fim
        ).count()
        
        total_sessoes_periodo += sessoes_periodo
        
        colaboradores_list.append({
            "id": paciente.id,
            "user_id": user_id,
            "nome": paciente.full_name,
            "email": paciente.email,
            "cpf": paciente.cpf,
            "telefone": paciente.phone,
            "foto_url": paciente.foto_url,
            "plano": chave_plano,
            "plano_nome": nome_plano,
            "valor_plano_mensal": preco_por_colaborador,
            "sessoes_inclusas": sessoes_inclusas,
            "sessoes_realizadas": sessoes_periodo,
            "sessoes_realizadas_periodo": sessoes_periodo,
            "status": "active" if is_active else "inactive",
            "created_at": paciente.created_at.isoformat() if paciente.created_at else None,
            "ultima_sessao": None
        })
    
    total_colaboradores = len(colaboradores_list)
    total_colaboradores_ativos = len([c for c in colaboradores_list if c["status"] == "active"])
    total_sessoes_disponiveis = total_colaboradores_ativos * sessoes_inclusas
    taxa_utilizacao = round((total_sessoes_periodo / total_sessoes_disponiveis * 100), 1) if total_sessoes_disponiveis > 0 else 0
    receita_mensal_estimada = total_colaboradores_ativos * preco_por_colaborador
    total_a_faturar = receita_mensal_estimada
    
    # Dados para gráfico mensal
    chart_data = []
    hoje = datetime.now()
    for i in range(11, -1, -1):
        mes_ref = hoje.replace(day=1)
        if mes_ref.month - i <= 0:
            ano = mes_ref.year - 1
            mes = 12 + (mes_ref.month - i)
        else:
            ano = mes_ref.year
            mes = mes_ref.month - i
        
        if mes <= 0:
            ano = ano - 1
            mes = 12 + mes
        
        colaboradores_ativos_mes = get_colaboradores_ativos_no_mes(empresa_id, ano, mes, db)
        receita_mes = colaboradores_ativos_mes * preco_por_colaborador
        nome_mes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mes - 1]
        
        chart_data.append({
            "mes": nome_mes,
            "receita": receita_mes
        })
    
    # Lista de sessões detalhadas
    sessions_list = []
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids),
        Appointment.starts_at >= data_inicio,
        Appointment.starts_at <= data_fim
    ).order_by(Appointment.starts_at.desc()).limit(100).all()
    
    for apt in appointments:
        paciente = db.query(PatientProfile).filter(PatientProfile.user_id == apt.patient_user_id).first()
        
        sessions_list.append({
            "id": apt.id,
            "date": apt.starts_at.strftime("%Y-%m-%d"),
            "time": apt.starts_at.strftime("%H:%M"),
            "colaborador_name": paciente.full_name if paciente else "Colaborador",
            "colaborador_email": paciente.email if paciente else "",
            "therapist_name": apt.therapist.full_name if apt.therapist else "Terapeuta",
            "status": apt.status,
            "session_price": float(apt.session_price or 0),
            "is_completed": apt.status == "completed",
            "is_invoiced": False
        })
    
    return {
        "periodo": {
            "start": data_inicio.strftime("%Y-%m-%d"),
            "end": data_fim.strftime("%Y-%m-%d")
        },
        "colaboradores": colaboradores_list,
        "resumo": {
            "total_colaboradores": total_colaboradores,
            "total_colaboradores_ativos": total_colaboradores_ativos,
            "total_sessoes_realizadas": total_sessoes_periodo,
            "total_sessoes_disponiveis": total_sessoes_disponiveis,
            "taxa_utilizacao": taxa_utilizacao,
            "receita_mensal_estimada": receita_mensal_estimada,
            "total_a_faturar": total_a_faturar,
            "total_faturado": total_faturado,
            "total_pago": total_pago
        },
        "sessoes": sessions_list,
        "chart_data": chart_data,
        "por_terapeuta": []
    }


# ==========================
# 🔥 DADOS PARA GRÁFICOS (ANALYTICS)
# ==========================
@router.get("/chart-data")
def get_insights_chart_data(
    periodo: str = Query("month", description="week, month, quarter, year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dados para gráficos do dashboard de insights"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    if not colaboradores_ids:
        return {"data": []}
    
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


# ==========================
# 🔥 DASHBOARD DE INSIGHTS (ANALYTICS)
# ==========================
@router.get("/dashboard")
def get_insights_dashboard(
    periodo: str = Query("month", description="week, month, quarter, year, all"),
    comparar_com: Optional[str] = Query(None, description="previous_month, previous_year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dashboard de insights - dados agregados e anonimizados"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    if not colaboradores_ids:
        return {"message": "Nenhum colaborador encontrado", "data": None}
    
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
    
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids),
        Appointment.starts_at >= data_inicio,
        Appointment.starts_at <= data_fim
    ).all()
    
    appointment_ids = [apt.id for apt in appointments]
    medical_records = db.query(MedicalRecord).filter(
        MedicalRecord.appointment_id.in_(appointment_ids)
    ).all() if appointment_ids else []
    
    total_sessoes = len(appointments)
    sessoes_completadas = len([apt for apt in appointments if apt.status == "completed"])
    sessoes_canceladas = len([apt for apt in appointments if apt.status in ["cancelled_by_patient", "cancelled_by_therapist"]])
    sessoes_reagendadas = len([apt for apt in appointments if apt.status == "rescheduled"])
    
    taxa_conclusao = round((sessoes_completadas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    taxa_cancelamento = round((sessoes_canceladas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    
    sessoes_nao_ocorridas = len([mr for mr in medical_records if mr.session_not_occurred])
    taxa_nao_comparecimento = round((sessoes_nao_ocorridas / total_sessoes * 100), 1) if total_sessoes > 0 else 0
    
    motivos_nao_ocorrencia = Counter()
    for mr in medical_records:
        if mr.session_not_occurred and mr.not_occurred_reason:
            motivos_nao_ocorrencia[mr.not_occurred_reason] += 1
    
    outcomes = Counter()
    for mr in medical_records:
        if mr.outcome:
            outcomes[mr.outcome] += 1
    
    colaboradores_ativos = len(set([apt.patient_user_id for apt in appointments]))
    taxa_engajamento = round((colaboradores_ativos / len(colaboradores_ids) * 100), 1) if colaboradores_ids else 0
    
    valor_total = sum(float(apt.session_price or 0) for apt in appointments if apt.status == "completed")
    valor_medio_sessao = round(valor_total / sessoes_completadas, 2) if sessoes_completadas > 0 else 0
    
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