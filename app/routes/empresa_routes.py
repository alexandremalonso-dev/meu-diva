from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.empresa_profile import EmpresaProfile
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord

router = APIRouter(prefix="/empresa", tags=["Empresa"])


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


# ==========================
# PERFIL DA EMPRESA
# ==========================
@router.get("/profile/me")
def get_empresa_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna o perfil da empresa do usuário logado"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not profile:
        # Criar perfil básico se não existir
        profile = EmpresaProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or "",
            corporate_name=current_user.full_name or ""
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.full_name,
        "phone": profile.phone,
        "cnpj": profile.cnpj,
        "corporate_name": profile.corporate_name,
        "trading_name": profile.trading_name,
        "state_registration": profile.state_registration,
        "municipal_registration": profile.municipal_registration,
        "birth_date": profile.birth_date.isoformat() if profile.birth_date else None,
        "education_level": profile.education_level,
        "foto_url": profile.foto_url,
        "department": profile.department,
        "position": profile.position,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None
    }


@router.post("/profile/me")
def update_empresa_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza o perfil da empresa do usuário logado"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    profile = db.query(EmpresaProfile).filter(EmpresaProfile.user_id == current_user.id).first()
    if not profile:
        profile = EmpresaProfile(
            user_id=current_user.id,
            full_name=profile_data.get("full_name", current_user.full_name or "")
        )
        db.add(profile)
    
    # Atualizar campos
    for field in ["full_name", "phone", "cnpj", "corporate_name", "trading_name", 
                  "state_registration", "municipal_registration", "birth_date", 
                  "education_level", "foto_url", "department", "position"]:
        if field in profile_data and profile_data[field] is not None:
            setattr(profile, field, profile_data[field])
    
    db.commit()
    db.refresh(profile)
    
    return {"message": "Perfil atualizado com sucesso", "profile": {
        "id": profile.id,
        "user_id": profile.user_id,
        "full_name": profile.full_name,
        "phone": profile.phone,
        "cnpj": profile.cnpj,
        "corporate_name": profile.corporate_name,
        "trading_name": profile.trading_name
    }}


# ==========================
# COLABORADORES DA EMPRESA
# ==========================
@router.get("/colaboradores")
def get_empresa_colaboradores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna a lista de colaboradores da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    
    colaboradores = db.query(PatientProfile).filter(
        PatientProfile.empresa_id == empresa_id
    ).all()
    
    result = []
    for colab in colaboradores:
        user = db.query(User).filter(User.id == colab.user_id).first()
        result.append({
            "id": colab.id,
            "user_id": colab.user_id,
            "full_name": colab.full_name,
            "email": user.email if user else colab.email,
            "phone": colab.phone,
            "cpf": colab.cpf,
            "foto_url": colab.foto_url,
            "is_active": user.is_active if user else True,
            "created_at": colab.created_at.isoformat() if colab.created_at else None,
            "access_ends_at": None,
            "plano": "basico"
        })
    
    return result


# ==========================
# SESSÕES DA EMPRESA
# ==========================
@router.get("/sessions")
def get_empresa_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna as sessões dos colaboradores da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    if not colaboradores_ids:
        return []
    
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids)
    ).order_by(Appointment.starts_at.desc()).limit(100).all()
    
    result = []
    for apt in appointments:
        patient = db.query(User).filter(User.id == apt.patient_user_id).first()
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == apt.patient_user_id).first()
        therapist = db.query(User).filter(User.id == apt.therapist_user_id).first() if apt.therapist_user_id else None
        
        # Verificar se tem prontuário
        medical_record = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == apt.id).first()
        
        result.append({
            "id": apt.id,
            "date": apt.starts_at.strftime("%Y-%m-%d"),
            "colaborador_id": apt.patient_user_id,
            "colaborador_name": patient_profile.full_name if patient_profile else (patient.full_name if patient else "Colaborador"),
            "colaborador_email": patient.email if patient else "",
            "colaborador_departamento": patient_profile.department if patient_profile else None,
            "therapist_name": therapist.full_name if therapist else "Terapeuta",
            "therapist_id": apt.therapist_user_id,
            "status": apt.status,
            "session_price": float(apt.session_price) if apt.session_price else 0,
            "is_completed": apt.status == "completed",
            "has_medical_record": medical_record is not None
        })
    
    return result


# ==========================
# STATS DA EMPRESA
# ==========================
@router.get("/stats")
def get_empresa_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna estatísticas da empresa"""
    if current_user.role != "empresa":
        raise HTTPException(status_code=403, detail="Acesso permitido apenas para empresas")
    
    empresa_id = get_empresa_id_from_user(current_user, db)
    colaboradores_ids = get_colaboradores_ids(empresa_id, db)
    
    total_colaboradores = len(colaboradores_ids)
    
    # Contar colaboradores ativos (que fizeram pelo menos uma sessão nos últimos 30 dias)
    trinta_dias_atras = datetime.now() - timedelta(days=30)
    appointments = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids),
        Appointment.starts_at >= trinta_dias_atras
    ).all()
    
    colaboradores_ativos = len(set([apt.patient_user_id for apt in appointments]))
    
    # Total de terapeutas que atenderam colaboradores
    terapeutas_ids = set([apt.therapist_user_id for apt in appointments])
    total_terapeutas = len(terapeutas_ids)
    
    # Valor a faturar (sessões realizadas não faturadas)
    sessoes_realizadas = [apt for apt in appointments if apt.status == "completed"]
    valor_a_faturar = sum(float(apt.session_price or 0) for apt in sessoes_realizadas)
    
    # Sessões realizadas no mês
    inicio_mes = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    sessoes_mes = db.query(Appointment).filter(
        Appointment.patient_user_id.in_(colaboradores_ids),
        Appointment.status == "completed",
        Appointment.starts_at >= inicio_mes
    ).count()
    
    return {
        "total_colaboradores": total_colaboradores,
        "colaboradores_ativos": colaboradores_ativos,
        "total_terapeutas": total_terapeutas,
        "valor_a_faturar": round(valor_a_faturar, 2),
        "sessoes_realizadas_mes": sessoes_mes
    }