from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.wallet import Wallet, Ledger

router = APIRouter(prefix="/empresa/credits", tags=["Empresa Credits"])


# ==========================
# SCHEMAS
# ==========================
class CreditosResponse(BaseModel):
    creditos_disponiveis: int
    sessoes_usadas: int
    sessoes_contratadas: int
    plano_nome: str
    valor_por_sessao: float
    mes_referencia: str


class DistribuirCreditosRequest(BaseModel):
    patient_user_id: int
    sessoes: Optional[int] = None  # Se None, usa o padrão do plano


# ==========================
# HELPERS
# ==========================
def get_primeiro_dia_mes() -> datetime:
    hoje = datetime.now()
    return datetime(hoje.year, hoje.month, 1, 0, 0, 0)


def get_ultimo_dia_mes() -> datetime:
    hoje = datetime.now()
    if hoje.month == 12:
        return datetime(hoje.year + 1, 1, 1, 0, 0, 0) - timedelta(seconds=1)
    return datetime(hoje.year, hoje.month + 1, 1, 0, 0, 0) - timedelta(seconds=1)


def get_sessoes_usadas_mes(patient_user_id: int, db: Session) -> int:
    primeiro_dia = get_primeiro_dia_mes()
    ultimo_dia = get_ultimo_dia_mes()
    
    sessoes_usadas = db.query(Ledger).filter(
        Ledger.credit_type == "empresa_credit",
        Ledger.transaction_type == "session_debit",
        Ledger.created_at >= primeiro_dia,
        Ledger.created_at <= ultimo_dia
    ).count()
    
    return sessoes_usadas


# ==========================
# ENDPOINTS
# ==========================

@router.get("/me", response_model=CreditosResponse)
def get_meus_creditos(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    """Retorna os créditos disponíveis do colaborador logado"""
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == current_user.id
    ).first()
    
    if not patient_profile or not patient_profile.empresa_id:
        raise HTTPException(status_code=400, detail="Usuário não é colaborador de empresa")
    
    empresa = db.query(EmpresaProfile).filter(
        EmpresaProfile.id == patient_profile.empresa_id
    ).first()
    
    if not empresa or not empresa.plano_id:
        raise HTTPException(status_code=400, detail="Empresa não possui plano ativo")
    
    plano = db.query(EmpresaPlano).filter(
        EmpresaPlano.id == empresa.plano_id,
        EmpresaPlano.ativo == True
    ).first()
    
    if not plano:
        raise HTTPException(status_code=400, detail="Plano da empresa não está ativo")
    
    sessoes_contratadas = plano.sessoes_inclusas_por_colaborador
    sessoes_usadas = get_sessoes_usadas_mes(current_user.id, db)
    creditos_disponiveis = max(0, sessoes_contratadas - sessoes_usadas)
    
    return CreditosResponse(
        creditos_disponiveis=creditos_disponiveis,
        sessoes_usadas=sessoes_usadas,
        sessoes_contratadas=sessoes_contratadas,
        plano_nome=plano.nome,
        valor_por_sessao=float(plano.valor_repassado_terapeuta),
        mes_referencia=datetime.now().strftime("%Y-%m")
    )


@router.get("/colaborador/{patient_user_id}", response_model=CreditosResponse)
def get_creditos_colaborador(
    patient_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin, UserRole.empresa]))
):
    """Retorna os créditos disponíveis de um colaborador específico (Admin/Empresa)"""
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == patient_user_id
    ).first()
    
    if not patient_profile or not patient_profile.empresa_id:
        raise HTTPException(status_code=400, detail="Usuário não é colaborador de empresa")
    
    # Se for empresa, verificar se é sua própria empresa
    if current_user.role == UserRole.empresa:
        empresa_profile = db.query(EmpresaProfile).filter(
            EmpresaProfile.user_id == current_user.id
        ).first()
        if not empresa_profile or empresa_profile.id != patient_profile.empresa_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    empresa = db.query(EmpresaProfile).filter(
        EmpresaProfile.id == patient_profile.empresa_id
    ).first()
    
    if not empresa or not empresa.plano_id:
        raise HTTPException(status_code=400, detail="Empresa não possui plano ativo")
    
    plano = db.query(EmpresaPlano).filter(
        EmpresaPlano.id == empresa.plano_id,
        EmpresaPlano.ativo == True
    ).first()
    
    if not plano:
        raise HTTPException(status_code=400, detail="Plano da empresa não está ativo")
    
    sessoes_contratadas = plano.sessoes_inclusas_por_colaborador
    sessoes_usadas = get_sessoes_usadas_mes(patient_user_id, db)
    creditos_disponiveis = max(0, sessoes_contratadas - sessoes_usadas)
    
    return CreditosResponse(
        creditos_disponiveis=creditos_disponiveis,
        sessoes_usadas=sessoes_usadas,
        sessoes_contratadas=sessoes_contratadas,
        plano_nome=plano.nome,
        valor_por_sessao=float(plano.valor_repassado_terapeuta),
        mes_referencia=datetime.now().strftime("%Y-%m")
    )


@router.post("/distribuir")
def distribuir_creditos_manual(
    request: DistribuirCreditosRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin]))
):
    """Distribui créditos manualmente para um colaborador (Apenas Admin)"""
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == request.patient_user_id
    ).first()
    
    if not patient_profile or not patient_profile.empresa_id:
        raise HTTPException(status_code=400, detail="Usuário não é colaborador de empresa")
    
    empresa = db.query(EmpresaProfile).filter(
        EmpresaProfile.id == patient_profile.empresa_id
    ).first()
    
    if not empresa or not empresa.plano_id:
        raise HTTPException(status_code=400, detail="Empresa não possui plano ativo")
    
    plano = db.query(EmpresaPlano).filter(
        EmpresaPlano.id == empresa.plano_id,
        EmpresaPlano.ativo == True
    ).first()
    
    if not plano:
        raise HTTPException(status_code=400, detail="Plano da empresa não está ativo")
    
    sessoes = request.sessoes or plano.sessoes_inclusas_por_colaborador
    valor_por_sessao = plano.valor_repassado_terapeuta
    valor_total_credito = sessoes * valor_por_sessao
    
    # Buscar wallet do colaborador
    wallet = db.query(Wallet).filter(
        Wallet.patient_id == patient_profile.id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira do colaborador não encontrada")
    
    # Registrar créditos
    old_balance = wallet.balance
    wallet.balance += valor_total_credito
    
    ledger = Ledger(
        wallet_id=wallet.id,
        transaction_type="empresa_credit_renewal",
        amount=valor_total_credito,
        balance_after=wallet.balance,
        description=f"Distribuição manual - {sessoes} sessões do plano {plano.nome}",
        credit_type="empresa_credit",
        metadata={
            "empresa_id": empresa.id,
            "plano_id": plano.id,
            "plano_nome": plano.nome,
            "sessoes_distribuidas": sessoes,
            "valor_por_sessao": float(valor_por_sessao),
            "distribuido_por": current_user.email
        }
    )
    db.add(ledger)
    db.commit()
    
    return {
        "success": True,
        "message": f"Distribuídos {sessoes} créditos para {patient_profile.full_name}",
        "valor_total": float(valor_total_credito),
        "sessoes": sessoes,
        "valor_por_sessao": float(valor_por_sessao)
    }


@router.get("/wallet/{patient_user_id}")
def get_wallet_creditos(
    patient_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin, UserRole.empresa]))
):
    """Retorna o saldo do wallet do colaborador (créditos empresa + pessoal)"""
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == patient_user_id
    ).first()
    
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    
    # Se for empresa, verificar se é sua própria empresa
    if current_user.role == UserRole.empresa:
        empresa_profile = db.query(EmpresaProfile).filter(
            EmpresaProfile.user_id == current_user.id
        ).first()
        if not empresa_profile or empresa_profile.id != patient_profile.empresa_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    wallet = db.query(Wallet).filter(
        Wallet.patient_id == patient_profile.id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")
    
    # Calcular créditos empresa disponíveis no mês
    sessoes_usadas = get_sessoes_usadas_mes(patient_user_id, db)
    
    empresa = db.query(EmpresaProfile).filter(
        EmpresaProfile.id == patient_profile.empresa_id
    ).first()
    
    sessoes_contratadas = 0
    if empresa and empresa.plano_id:
        plano = db.query(EmpresaPlano).filter(
            EmpresaPlano.id == empresa.plano_id,
            EmpresaPlano.ativo == True
        ).first()
        if plano:
            sessoes_contratadas = plano.sessoes_inclusas_por_colaborador
    
    creditos_empresa_disponiveis = max(0, sessoes_contratadas - sessoes_usadas)
    
    return {
        "wallet_id": wallet.id,
        "saldo_total": float(wallet.balance),
        "creditos_empresa_disponiveis": creditos_empresa_disponiveis,
        "sessoes_usadas_mes": sessoes_usadas,
        "sessoes_contratadas_mes": sessoes_contratadas,
        "patient_id": patient_profile.id,
        "patient_name": patient_profile.full_name
    }