"""
Serviço de Scheduler para renovação de créditos de plano empresa
Executa automaticamente no dia 1 de cada mês às 00:01
"""

from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.db.database import SessionLocal
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.wallet import Wallet, Ledger


def get_primeiro_dia_mes() -> datetime:
    """Retorna o primeiro dia do mês atual às 00:00:00"""
    hoje = datetime.now()
    return datetime(hoje.year, hoje.month, 1, 0, 0, 0)


def get_ultimo_dia_mes() -> datetime:
    """Retorna o último dia do mês atual às 23:59:59"""
    hoje = datetime.now()
    if hoje.month == 12:
        return datetime(hoje.year + 1, 1, 1, 0, 0, 0) - timedelta(seconds=1)
    return datetime(hoje.year, hoje.month + 1, 1, 0, 0, 0) - timedelta(seconds=1)


def renovar_creditos_empresa():
    """
    Renova os créditos de todos os colaboradores ativos no início de cada mês.
    
    Regras:
    1. Busca todos os colaboradores com empresa_id e access_ends_at > hoje
    2. Para cada colaborador, verifica o plano da empresa
    3. Adiciona créditos no wallet (credit_type = 'empresa_credit')
    4. Registra no ledger a transação de renovação
    """
    db = SessionLocal()
    
    try:
        print(f"\n🔄 [SCHEDULER] Iniciando renovação de créditos - {datetime.now()}")
        
        # Buscar todos os colaboradores ativos (com empresa vinculada)
        colaboradores = db.query(PatientProfile).filter(
            PatientProfile.empresa_id.isnot(None),
            or_(
                PatientProfile.access_ends_at.is_(None),
                PatientProfile.access_ends_at > datetime.now()
            )
        ).all()
        
        print(f"📊 Encontrados {len(colaboradores)} colaboradores ativos")
        
        renovados = 0
        erros = 0
        
        for colab in colaboradores:
            try:
                # Buscar empresa e plano
                empresa = db.query(EmpresaProfile).filter(
                    EmpresaProfile.id == colab.empresa_id
                ).first()
                
                if not empresa or not empresa.plano_id:
                    print(f"⚠️ Colaborador {colab.id} - Empresa sem plano ativo")
                    continue
                
                plano = db.query(EmpresaPlano).filter(
                    EmpresaPlano.id == empresa.plano_id,
                    EmpresaPlano.ativo == True
                ).first()
                
                if not plano:
                    print(f"⚠️ Colaborador {colab.id} - Plano inativo")
                    continue
                
                # Buscar wallet do colaborador
                wallet = db.query(Wallet).filter(
                    Wallet.patient_id == colab.id
                ).first()
                
                if not wallet:
                    print(f"⚠️ Colaborador {colab.id} - Wallet não encontrada")
                    continue
                
                # Valor a ser creditado (sessões disponíveis x valor da sessão)
                # Cada sessão equivale ao valor_repassado_terapeuta do plano
                sessoes_contratadas = plano.sessoes_inclusas_por_colaborador
                valor_por_sessao = plano.valor_repassado_terapeuta
                valor_total_credito = sessoes_contratadas * valor_por_sessao
                
                # Verificar se já houve renovação neste mês
                primeiro_dia = get_primeiro_dia_mes()
                renovacao_mes = db.query(Ledger).filter(
                    Ledger.wallet_id == wallet.id,
                    Ledger.transaction_type == "empresa_credit_renewal",
                    Ledger.created_at >= primeiro_dia
                ).first()
                
                if renovacao_mes:
                    print(f"⚠️ Colaborador {colab.id} - Renovação já realizada neste mês")
                    continue
                
                # Registrar créditos no ledger
                old_balance = wallet.balance
                wallet.balance += valor_total_credito
                
                ledger = Ledger(
                    wallet_id=wallet.id,
                    transaction_type="empresa_credit_renewal",
                    amount=valor_total_credito,
                    balance_after=wallet.balance,
                    description=f"Renovação mensal - Plano {plano.nome} ({sessoes_contratadas} sessões)",
                    credit_type="empresa_credit",
                    metadata={
                        "empresa_id": empresa.id,
                        "plano_id": plano.id,
                        "plano_nome": plano.nome,
                        "sessoes_contratadas": sessoes_contratadas,
                        "valor_por_sessao": float(valor_por_sessao),
                        "mes_referencia": datetime.now().strftime("%Y-%m")
                    }
                )
                db.add(ledger)
                
                renovados += 1
                print(f"✅ Colaborador {colab.id} - Renovado R$ {valor_total_credito} ({sessoes_contratadas} sessões x R$ {valor_por_sessao})")
                
            except Exception as e:
                print(f"❌ Erro ao renovar colaborador {colab.id}: {e}")
                erros += 1
        
        db.commit()
        print(f"\n✅ [SCHEDULER] Renovação concluída! Renovados: {renovados}, Erros: {erros}")
        
    except Exception as e:
        print(f"❌ [SCHEDULER] Erro geral: {e}")
        db.rollback()
    finally:
        db.close()


def expirar_creditos_empresa():
    """
    Expira créditos de empresa que não foram utilizados no mês anterior.
    Executa no dia 1 às 00:01, antes da renovação.
    
    Regras:
    1. Busca todos os créditos do mês anterior (credit_type = 'empresa_credit')
    2. Não remove, apenas marca como expirado via metadata
    """
    db = SessionLocal()
    
    try:
        print(f"\n🕐 [SCHEDULER] Iniciando expiração de créditos - {datetime.now()}")
        
        # Buscar créditos do mês anterior
        primeiro_dia_mes_atual = get_primeiro_dia_mes()
        ultimo_dia_mes_anterior = primeiro_dia_mes_atual - timedelta(seconds=1)
        primeiro_dia_mes_anterior = ultimo_dia_mes_anterior.replace(day=1, hour=0, minute=0, second=0)
        
        creditos_antigos = db.query(Ledger).filter(
            Ledger.transaction_type == "empresa_credit_renewal",
            Ledger.created_at >= primeiro_dia_mes_anterior,
            Ledger.created_at <= ultimo_dia_mes_anterior,
            Ledger.metadata.isnot(None)
        ).all()
        
        expirados = 0
        for credito in creditos_antigos:
            if credito.metadata:
                credito.metadata["expirado"] = True
                credito.metadata["data_expiracao"] = datetime.now().isoformat()
                expirados += 1
        
        db.commit()
        print(f"✅ [SCHEDULER] Créditos expirados: {expirados}")
        
    except Exception as e:
        print(f"❌ [SCHEDULER] Erro ao expirar créditos: {e}")
        db.rollback()
    finally:
        db.close()


def executar_rotina_mensal():
    """
    Executa a rotina completa de renovação mensal:
    1. Expira créditos do mês anterior
    2. Renova créditos para o novo mês
    """
    print("\n" + "="*60)
    print("🔄 EXECUTANDO ROTINA MENSAL DE CRÉDITOS EMPRESA")
    print("="*60)
    
    expirar_creditos_empresa()
    renovar_creditos_empresa()
    
    print("="*60)
    print("✅ ROTINA MENSAL CONCLUÍDA")
    print("="*60)


# Para teste manual
if __name__ == "__main__":
    executar_rotina_mensal()