from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import csv
import io
import re
import secrets
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.security import get_password_hash
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile
from app.services.email_service import email_service

router = APIRouter(prefix="/empresa/colaboradores", tags=["Empresa Colaboradores"])


def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def validate_cpf(cpf: str) -> bool:
    if not cpf:
        return False
    # Remove caracteres não numéricos
    cpf = re.sub(r'\D', '', cpf)
    if len(cpf) != 11:
        return False
    # Validação básica (evita CPFs inválidos conhecidos)
    if cpf == cpf[0] * 11:
        return False
    # Validação dos dígitos verificadores
    # Primeiro dígito
    soma = 0
    for i in range(9):
        soma += int(cpf[i]) * (10 - i)
    resto = 11 - (soma % 11)
    if resto >= 10:
        resto = 0
    if resto != int(cpf[9]):
        return False
    # Segundo dígito
    soma = 0
    for i in range(10):
        soma += int(cpf[i]) * (11 - i)
    resto = 11 - (soma % 11)
    if resto >= 10:
        resto = 0
    if resto != int(cpf[10]):
        return False
    return True


def validate_birth_date(date_str: str) -> bool:
    if not date_str:
        return False
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        # Verificar se é uma data plausível (não futura e não muito antiga)
        if date > datetime.now():
            return False
        if date.year < 1900:
            return False
        return True
    except:
        return False


def format_cpf(cpf: str) -> str:
    if not cpf:
        return None
    cpf = re.sub(r'\D', '', cpf)
    if len(cpf) == 11:
        return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
    return cpf


def format_phone(phone: str) -> str:
    if not phone:
        return None
    phone = re.sub(r'\D', '', phone)
    if len(phone) == 11:
        return f"({phone[:2]}) {phone[2:7]}-{phone[7:]}"
    elif len(phone) == 10:
        return f"({phone[:2]}) {phone[2:6]}-{phone[6:]}"
    return phone


def generate_temporary_password() -> str:
    """Gera senha temporária de 8 caracteres"""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def send_welcome_email(email: str, name: str, temp_password: str):
    """Envia e-mail de boas-vindas com senha temporária"""
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


@router.post("/importar/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pré-visualização do arquivo de importação"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    contents = await file.read()
    
    try:
        text = contents.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except:
        raise HTTPException(status_code=400, detail="Arquivo inválido. Use CSV com encoding UTF-8")
    
    # Mapear colunas
    col_mapping = {
        'nome': ['nome', 'name', 'full_name', 'fullname'],
        'email': ['email', 'e-mail', 'mail'],
        'cpf': ['cpf', 'documento', 'doc'],
        'data_nascimento': ['data_nascimento', 'birth_date', 'nascimento', 'birthdate'],
        'telefone': ['telefone', 'phone', 'celular', 'whatsapp'],
        'departamento': ['departamento', 'department', 'setor', 'dept'],
        'cargo': ['cargo', 'position', 'job_title']
    }
    
    headers = list(rows[0].keys()) if rows else []
    col_map = {}
    for field, possibilities in col_mapping.items():
        for header in headers:
            if header.lower().strip() in possibilities:
                col_map[field] = header
                break
    
    validos = []
    invalidos = []
    emails_existentes = []
    cpfs_existentes = []
    
    for idx, row in enumerate(rows):
        errors = []
        
        nome = row.get(col_map.get('nome', ''), '').strip() if col_map.get('nome') else ''
        email = row.get(col_map.get('email', ''), '').strip().lower() if col_map.get('email') else ''
        cpf_raw = row.get(col_map.get('cpf', ''), '').strip() if col_map.get('cpf') else ''
        data_nascimento = row.get(col_map.get('data_nascimento', ''), '').strip() if col_map.get('data_nascimento') else ''
        telefone = row.get(col_map.get('telefone', ''), '').strip() if col_map.get('telefone') else ''
        departamento = row.get(col_map.get('departamento', ''), '').strip() if col_map.get('departamento') else ''
        cargo = row.get(col_map.get('cargo', ''), '').strip() if col_map.get('cargo') else ''
        
        # Validações obrigatórias
        if not nome:
            errors.append("Nome é obrigatório")
        if not email:
            errors.append("Email é obrigatório")
        elif not validate_email(email):
            errors.append("Email inválido")
        if not cpf_raw:
            errors.append("CPF é obrigatório")
        elif not validate_cpf(cpf_raw):
            errors.append("CPF inválido")
        if not data_nascimento:
            errors.append("Data de nascimento é obrigatória")
        elif not validate_birth_date(data_nascimento):
            errors.append("Data de nascimento inválida (formato esperado: YYYY-MM-DD)")
        
        # Verificar duplicatas na base
        if email:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                errors.append(f"Email já cadastrado no sistema")
                emails_existentes.append(email)
        
        cpf_clean = re.sub(r'\D', '', cpf_raw) if cpf_raw else ''
        if cpf_clean:
            existing_patient = db.query(PatientProfile).filter(PatientProfile.cpf == format_cpf(cpf_clean)).first()
            if existing_patient:
                errors.append(f"CPF já cadastrado no sistema")
                cpfs_existentes.append(cpf_clean)
        
        if errors:
            invalidos.append({"row": idx, "errors": errors, "data": row})
        else:
            validos.append({
                "nome": nome,
                "email": email,
                "cpf": format_cpf(cpf_clean),
                "data_nascimento": data_nascimento,
                "telefone": format_phone(telefone),
                "departamento": departamento,
                "cargo": cargo
            })
    
    return {
        "validos": validos,
        "invalidos": invalidos,
        "total_validos": len(validos),
        "total_invalidos": len(invalidos),
        "emails_duplicados": emails_existentes,
        "cpfs_duplicados": cpfs_existentes
    }


@router.post("/importar")
async def confirm_import(
    colaboradores: List[Dict[str, Any]],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirma e executa a importação dos colaboradores"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso apenas para empresas")
    
    empresa = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Perfil de empresa não encontrado")
    
    results = []
    success_count = 0
    failed_count = 0
    
    for colab in colaboradores:
        try:
            # Verificar se email já existe
            existing_user = db.query(User).filter(User.email == colab["email"]).first()
            if existing_user:
                results.append({
                    "email": colab["email"],
                    "success": False,
                    "error": "Email já cadastrado"
                })
                failed_count += 1
                continue
            
            # Verificar se CPF já existe
            existing_patient = db.query(PatientProfile).filter(PatientProfile.cpf == colab["cpf"]).first()
            if existing_patient:
                results.append({
                    "email": colab["email"],
                    "success": False,
                    "error": "CPF já cadastrado"
                })
                failed_count += 1
                continue
            
            # Gerar senha temporária
            temp_password = generate_temporary_password()
            password_hash = get_password_hash(temp_password)
            
            # Criar usuário
            new_user = User(
                email=colab["email"],
                full_name=colab["nome"],
                password_hash=password_hash,
                role="patient",
                is_active=True,
                is_verified=True
            )
            db.add(new_user)
            db.flush()
            
            # Criar perfil de paciente vinculado à empresa
            new_patient = PatientProfile(
                user_id=new_user.id,
                full_name=colab["nome"],
                email=colab["email"],
                cpf=colab.get("cpf"),
                phone=colab.get("telefone"),
                birth_date=datetime.strptime(colab["data_nascimento"], "%Y-%m-%d").date() if colab.get("data_nascimento") else None,
                department=colab.get("departamento"),
                position=colab.get("cargo"),
                empresa_id=empresa.id
            )
            db.add(new_patient)
            db.flush()
            
            # Enviar e-mail de boas-vindas
            try:
                send_welcome_email(colab["email"], colab["nome"], temp_password)
            except Exception as e:
                print(f"Erro ao enviar e-mail para {colab['email']}: {e}")
            
            db.commit()
            
            results.append({
                "email": colab["email"],
                "success": True,
                "user_id": new_user.id,
                "temp_password": temp_password
            })
            success_count += 1
            
        except Exception as e:
            db.rollback()
            results.append({
                "email": colab.get("email", "desconhecido"),
                "success": False,
                "error": str(e)
            })
            failed_count += 1
    
    return {
        "total": len(colaboradores),
        "success": success_count,
        "failed": failed_count,
        "results": results
    }