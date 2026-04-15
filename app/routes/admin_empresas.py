from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime
import os
import shutil

from app.db.database import get_db
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.patient_profile import PatientProfile
from app.schemas.empresa_admin import (
    EmpresaOut, HistoricoPlanoOut, AlterarPlanoRequest,
    AlterarStatusRequest, EmpresaInvoiceOut
)
from app.core.security import get_current_user

router = APIRouter(prefix="/admin/empresas", tags=["Admin - Empresas"])


def get_current_admin_user(current_user: User = Depends(get_current_user)):
    """Verifica se o usuário atual é admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas administradores podem acessar esta rota."
        )
    return current_user


# ============================================================
# 1. LISTAR TODAS AS EMPRESAS
# ============================================================
@router.get("/", response_model=List[EmpresaOut])
async def listar_empresas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Lista todas as empresas cadastradas com dados completos"""
    
    # Buscar todos os usuários com role 'empresa'
    empresas_users = db.query(User).filter(User.role == "empresa").all()
    
    resultado = []
    
    for user in empresas_users:
        # Buscar perfil da empresa
        empresa_profile = db.query(EmpresaProfile).filter(
            EmpresaProfile.user_id == user.id
        ).first()
        
        if not empresa_profile:
            continue
        
        # Buscar plano atual
        plano = None
        preco_por_colaborador = 45
        sessoes_inclusas = 1
        plano_nome = "Prata"
        plano_chave = "prata"
        
        if empresa_profile.plano_id:
            plano = db.query(EmpresaPlano).filter(
                EmpresaPlano.id == empresa_profile.plano_id
            ).first()
            
            if plano:
                preco_por_colaborador = plano.preco_mensal_por_colaborador
                sessoes_inclusas = plano.sessoes_inclusas_por_colaborador
                plano_nome = plano.nome
                plano_chave = plano.chave
        
        # 🔥 CORREÇÃO: Contar colaboradores ativos
        # Um colaborador é ativo se:
        # - access_ends_at é NULL (nunca expira) OU
        # - access_ends_at é maior que a data atual
        colaboradores_ativos = db.query(PatientProfile).filter(
            and_(
                PatientProfile.empresa_id == empresa_profile.id,
                or_(
                    PatientProfile.access_ends_at.is_(None),
                    PatientProfile.access_ends_at > datetime.now()
                )
            )
        ).count()
        
        # Total de colaboradores (independente de status)
        total_colaboradores = db.query(PatientProfile).filter(
            PatientProfile.empresa_id == empresa_profile.id
        ).count()
        
        # Nome da empresa
        nome_empresa = (
            empresa_profile.trading_name or 
            empresa_profile.corporate_name or 
            user.full_name or 
            "Empresa sem nome"
        )
        
        # Log para debug
        print(f"📊 Empresa: {nome_empresa}")
        print(f"   - Colaboradores ativos: {colaboradores_ativos}")
        print(f"   - Total colaboradores: {total_colaboradores}")
        print(f"   - Plano: {plano_nome} (R$ {preco_por_colaborador})")
        print(f"   - Foto URL: {empresa_profile.foto_url}")
        
        resultado.append(EmpresaOut(
            id=empresa_profile.id,
            user_id=user.id,
            nome=nome_empresa,
            razao_social=empresa_profile.corporate_name or "",
            cnpj=empresa_profile.cnpj,
            email=empresa_profile.responsible_email or user.email,
            telefone=empresa_profile.responsible_phone or empresa_profile.phone,
            plano_atual=plano_chave,
            plano_nome=plano_nome,
            status="active",
            total_colaboradores=total_colaboradores,
            colaboradores_ativos=colaboradores_ativos,
            data_cadastro=user.created_at,
            preco_por_colaborador=preco_por_colaborador,
            sessoes_inclusas=sessoes_inclusas,
            foto_url=empresa_profile.foto_url
        ))
    
    print(f"✅ Retornando {len(resultado)} empresas")
    return resultado


# ============================================================
# 2. HISTÓRICO DE PLANOS DA EMPRESA
# ============================================================
@router.get("/{empresa_id}/historico-planos", response_model=List[HistoricoPlanoOut])
async def get_historico_planos(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Retorna o histórico de alterações de plano da empresa"""
    # TODO: Implementar quando criar a tabela de histórico
    return []


# ============================================================
# 3. ALTERAR PLANO DA EMPRESA
# ============================================================
@router.post("/{empresa_id}/alterar-plano")
async def alterar_plano(
    empresa_id: int,
    request: AlterarPlanoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Altera o plano da empresa"""
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    novo_plano = db.query(EmpresaPlano).filter(EmpresaPlano.chave == request.novo_plano).first()
    if not novo_plano:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    
    empresa.plano_id = novo_plano.id
    empresa.updated_at = datetime.now()
    
    db.commit()
    
    return {"success": True, "message": f"Plano alterado para {novo_plano.nome}"}


# ============================================================
# 4. ALTERAR STATUS DA EMPRESA
# ============================================================
@router.post("/{empresa_id}/alterar-status")
async def alterar_status(
    empresa_id: int,
    request: AlterarStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Ativa, suspende ou inativa uma empresa"""
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if request.status in ["suspended", "inactive"]:
        db.query(PatientProfile).filter(
            PatientProfile.empresa_id == empresa_id
        ).update({"access_ends_at": datetime.now()})
    
    empresa.updated_at = datetime.now()
    db.commit()
    
    return {"success": True, "message": f"Status alterado para {request.status}"}


# ============================================================
# 5. LISTAR NOTAS FISCAIS DA EMPRESA
# ============================================================
@router.get("/{empresa_id}/invoices", response_model=List[EmpresaInvoiceOut])
async def listar_invoices_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Lista todas as notas fiscais enviadas para a empresa"""
    # TODO: Implementar quando criar a tabela de invoices
    return []


# ============================================================
# 6. ENVIAR NOTA FISCAL PARA EMPRESA
# ============================================================
@router.post("/invoices/upload")
async def upload_invoice_empresa(
    file: UploadFile = File(...),
    invoice_number: str = Form(...),
    invoice_date: str = Form(...),
    reference_month: str = Form(...),
    amount: str = Form(...),
    empresa_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Envia uma nota fiscal para a empresa"""
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.id == empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")
    
    upload_dir = f"uploads/empresas/{empresa_id}/invoices"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_extension = file.filename.split('.')[-1]
    safe_filename = f"{invoice_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_extension}"
    file_path = f"{upload_dir}/{safe_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # TODO: Salvar registro no banco (tabela empresa_invoices)
    
    return {
        "success": True,
        "message": "Nota fiscal enviada com sucesso",
        "file_path": file_path
    }