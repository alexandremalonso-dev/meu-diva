from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import secrets
import re

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.password import get_password_hash
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.appointment import Appointment
from app.services.email_service import email_service

router = APIRouter(prefix="/empresa/colaboradores", tags=["Empresa Colaboradores"])


def validate_cpf(cpf: str) -> bool:
    if not cpf:
        return False
    cpf = re.sub(r'\D', '', cpf)
    if len(cpf) != 11:
        return False
    if cpf == cpf[0] * 11:
        return False
    return True


def generate_temporary_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def send_welcome_email(email: str, name: str, temp_password: str):
    subject = "Bem-vindo ao Meu Divã - Acesso à plataforma"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E03673;">Bem-vindo ao Meu Divã!</h2>
        <p>Olá <strong>{name}</strong>,</p>
        <p>Sua empresa cadastrou você na plataforma Meu Divã para que possa ter acesso a sessões de terapia.</p>
        <p>Seus dados de acesso são:</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>E-mail:</strong> {email}</p>
            <p><strong>Senha temporária:</strong> <span style="font-size: 18px; font-weight: bold;">{temp_password}</span></p>
        </div>
        <p><a href="https://app.meudivaonline.com/auth/login" style="background-color: #E03673; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar plataforma</a></p>
        <p>Recomendamos que você altere sua senha no primeiro acesso.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Atenciosamente,<br>Equipe Meu Divã</p>
    </body>
    </html>
    """
    email_service._send_email(email, subject, body)


# 🔥 FUNÇÃO AUXILIAR PARA OBTER DADOS DO PLANO
def get_plano_info(db: Session, plano_id: int = None, empresa_plano_chave: str = None):
    """Retorna informações do plano baseado no ID ou chave"""
    if plano_id:
        plano = db.query(EmpresaPlano).filter(EmpresaPlano.id == plano_id).first()
        if plano:
            return {
                "chave": plano.chave,
                "nome": plano.nome,
                "preco": plano.preco_mensal_por_colaborador,
                "sessoes": plano.sessoes_inclusas_por_colaborador
            }
    
    if empresa_plano_chave:
        plano = db.query(EmpresaPlano).filter(EmpresaPlano.chave == empresa_plano_chave).first()
        if plano:
            return {
                "chave": plano.chave,
                "nome": plano.nome,
                "preco": plano.preco_mensal_por_colaborador,
                "sessoes": plano.sessoes_inclusas_por_colaborador
            }
    
    # Plano padrão (Prata)
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.chave == "prata").first()
    if plano:
        return {
            "chave": plano.chave,
            "nome": plano.nome,
            "preco": plano.preco_mensal_por_colaborador,
            "sessoes": plano.sessoes_inclusas_por_colaborador
        }
    
    return {"chave": "prata", "nome": "Prata", "preco": 45, "sessoes": 1}


@router.post("/novo")
def criar_colaborador(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cadastra um novo colaborador manualmente"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # Buscar plano padrão da empresa
    plano_info = get_plano_info(db, empresa.plano_id)
    
    nome = data.get("nome")
    email = data.get("email")
    cpf = data.get("cpf")
    data_nascimento = data.get("data_nascimento")
    telefone = data.get("telefone")
    departamento = data.get("departamento")
    cargo = data.get("cargo")
    
    # Validações
    if not nome:
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    if not email:
        raise HTTPException(status_code=400, detail="Email é obrigatório")
    if not cpf:
        raise HTTPException(status_code=400, detail="CPF é obrigatório")
    if not data_nascimento:
        raise HTTPException(status_code=400, detail="Data de nascimento é obrigatória")
    
    # Verificar email duplicado
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado no sistema")
    
    # Verificar CPF duplicado
    cpf_clean = re.sub(r'\D', '', cpf)
    cpf_formatted = f"{cpf_clean[:3]}.{cpf_clean[3:6]}.{cpf_clean[6:9]}-{cpf_clean[9:]}"
    existing_patient = db.query(PatientProfile).filter(PatientProfile.cpf == cpf_formatted).first()
    if existing_patient:
        raise HTTPException(status_code=400, detail="CPF já cadastrado no sistema")
    
    # Validar CPF
    if not validate_cpf(cpf_clean):
        raise HTTPException(status_code=400, detail="CPF inválido")
    
    # Validar data de nascimento
    try:
        birth_date = datetime.strptime(data_nascimento, "%Y-%m-%d").date()
        if birth_date > datetime.now().date():
            raise HTTPException(status_code=400, detail="Data de nascimento não pode ser futura")
    except:
        raise HTTPException(status_code=400, detail="Data de nascimento inválida (formato YYYY-MM-DD)")
    
    # Gerar senha temporária
    temp_password = generate_temporary_password()
    password_hash = get_password_hash(temp_password)
    
    # Buscar o plano (pode ser o plano padrão da empresa ou um específico)
    plano = db.query(EmpresaPlano).filter(EmpresaPlano.chave == "prata").first()
    plano_id = plano.id if plano else None
    
    # Criar usuário
    new_user = User(
        email=email,
        full_name=nome,
        password_hash=password_hash,
        role="patient",
        is_active=True
    )
    db.add(new_user)
    db.flush()
    
    # Criar perfil de paciente com plano_id
    new_patient = PatientProfile(
        user_id=new_user.id,
        full_name=nome,
        email=email,
        cpf=cpf_formatted,
        phone=telefone,
        birth_date=birth_date,
        department=departamento,
        position=cargo,
        empresa_id=empresa.id,
        plano_id=plano_id  # 🔥 SALVAR O PLANO DO COLABORADOR
    )
    db.add(new_patient)
    db.flush()
    
    # Enviar e-mail
    try:
        send_welcome_email(email, nome, temp_password)
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")
    
    db.commit()
    
    return {
        "success": True,
        "user_id": new_user.id,
        "email": email,
        "temp_password": temp_password,
        "message": f"Colaborador {nome} cadastrado com sucesso"
    }


@router.get("")
def listar_colaboradores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todos os colaboradores da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    colaboradores = db.query(PatientProfile).filter(
        PatientProfile.empresa_id == empresa.id
    ).all()
    
    result = []
    for colab in colaboradores:
        user = db.query(User).filter(User.id == colab.user_id).first()
        
        # Calcular sessões realizadas
        appointments = db.query(Appointment).filter(
            Appointment.patient_user_id == colab.user_id,
            Appointment.status == "completed"
        ).all()
        
        sessoes_realizadas = len(appointments)
        
        # 🔥 BUSCAR PLANO DO COLABORADOR (prioriza plano individual, depois plano da empresa)
        plano_info = None
        if colab.plano_id:
            plano_info = get_plano_info(db, colab.plano_id)
        else:
            plano_info = get_plano_info(db, empresa.plano_id)
        
        result.append({
            "id": colab.id,
            "user_id": colab.user_id,
            "full_name": colab.full_name,
            "email": user.email if user else colab.email,
            "cpf": colab.cpf,
            "phone": colab.phone,
            "foto_url": colab.foto_url,
            "cargo": colab.position,
            "departamento": colab.department,
            "is_active": user.is_active if user else False,
            "access_ends_at": colab.access_ends_at.isoformat() if colab.access_ends_at else None,
            "created_at": colab.created_at.isoformat() if colab.created_at else None,
            "sessoes_realizadas": sessoes_realizadas,
            "sessoes_disponiveis": plano_info["sessoes"],
            "plano": plano_info["chave"],
            "plano_nome": plano_info["nome"],
            "preco_por_colaborador": plano_info["preco"]
        })
    
    return result


@router.get("/{colaborador_id}")
def get_colaborador(
    colaborador_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna detalhes de um colaborador específico"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # Buscar pelo user_id
    colaborador = db.query(PatientProfile).filter(
        PatientProfile.user_id == colaborador_id,
        PatientProfile.empresa_id == empresa.id
    ).first()
    
    if not colaborador:
        # Buscar pelo id do patient_profile
        colaborador = db.query(PatientProfile).filter(
            PatientProfile.id == colaborador_id,
            PatientProfile.empresa_id == empresa.id
        ).first()
    
    if not colaborador:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    
    user = db.query(User).filter(User.id == colaborador.user_id).first()
    
    # Calcular estatísticas de sessões
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id == colaborador.user_id,
        Appointment.status == "completed"
    ).all()
    
    sessoes_realizadas = len(appointments)
    ultima_sessao = max([apt.starts_at for apt in appointments]) if appointments else None
    
    # 🔥 BUSCAR PLANO DO COLABORADOR
    plano_info = get_plano_info(db, colaborador.plano_id) if colaborador.plano_id else get_plano_info(db, empresa.plano_id)
    
    return {
        "id": colaborador.id,
        "user_id": colaborador.user_id,
        "full_name": colaborador.full_name,
        "email": user.email if user else colaborador.email,
        "cpf": colaborador.cpf,
        "phone": colaborador.phone,
        "birth_date": colaborador.birth_date.isoformat() if colaborador.birth_date else None,
        "department": colaborador.department,
        "position": colaborador.position,
        "foto_url": colaborador.foto_url,
        "is_active": user.is_active if user else False,
        "access_ends_at": colaborador.access_ends_at.isoformat() if colaborador.access_ends_at else None,
        "inactivation_reason": colaborador.inactivation_reason,
        "created_at": colaborador.created_at.isoformat() if colaborador.created_at else None,
        "plano": plano_info["chave"],
        "plano_nome": plano_info["nome"],
        "preco_por_colaborador": plano_info["preco"],
        "sessoes_realizadas": sessoes_realizadas,
        "sessoes_disponiveis": plano_info["sessoes"],
        "ultima_sessao": ultima_sessao.isoformat() if ultima_sessao else None
    }


@router.post("/{colaborador_id}/desativar")
def desativar_colaborador(
    colaborador_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Desativa o acesso de um colaborador (data de término)"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # Buscar colaborador pelo user_id
    colaborador = db.query(PatientProfile).filter(
        PatientProfile.user_id == colaborador_id,
        PatientProfile.empresa_id == empresa.id
    ).first()
    
    if not colaborador:
        # Buscar pelo id
        colaborador = db.query(PatientProfile).filter(
            PatientProfile.id == colaborador_id,
            PatientProfile.empresa_id == empresa.id
        ).first()
    
    if not colaborador:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    
    access_ends_at = data.get("access_ends_at")
    motivo = data.get("motivo", "Desativado pela empresa")
    
    if access_ends_at:
        try:
            colaborador.access_ends_at = datetime.strptime(access_ends_at, "%Y-%m-%d")
        except:
            raise HTTPException(status_code=400, detail="Data inválida (formato YYYY-MM-DD)")
    else:
        colaborador.access_ends_at = datetime.now()
    
    colaborador.inactivation_reason = motivo
    
    # Também desativar o usuário na tabela users
    user = db.query(User).filter(User.id == colaborador.user_id).first()
    if user:
        user.is_active = False
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Colaborador {colaborador.full_name} desativado até {colaborador.access_ends_at.strftime('%d/%m/%Y')}"
    }


@router.post("/{colaborador_id}/reativar")
def reativar_colaborador(
    colaborador_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reativa o acesso de um colaborador"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    # Buscar colaborador pelo user_id
    colaborador = db.query(PatientProfile).filter(
        PatientProfile.user_id == colaborador_id,
        PatientProfile.empresa_id == empresa.id
    ).first()
    
    if not colaborador:
        colaborador = db.query(PatientProfile).filter(
            PatientProfile.id == colaborador_id,
            PatientProfile.empresa_id == empresa.id
        ).first()
    
    if not colaborador:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    
    colaborador.access_ends_at = None
    colaborador.inactivation_reason = None
    
    # Reativar o usuário
    user = db.query(User).filter(User.id == colaborador.user_id).first()
    if user:
        user.is_active = True
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Colaborador {colaborador.full_name} reativado com sucesso"
    }