from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select
import traceback

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.auth import get_current_user

from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.availability import AvailabilityPeriod, AvailabilitySlot

from app.schemas.availability import (
    AvailabilityPeriodCreate,
    AvailabilityPeriodOut,
    AvailabilitySlotCreate
)

router = APIRouter(prefix="/therapist/availability", tags=["availability"])


# 🔥 FUNÇÃO PARA CONVERTER WEEKDAY DO FRONTEND (JS) PARA BACKEND (PYTHON)
def js_weekday_to_python_weekday(js_weekday: int) -> int:
    """
    JavaScript getDay(): 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
    Python weekday(): 0=Segunda, 1=Terça, 2=Quarta, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo
    """
    if js_weekday == 0:  # Domingo
        return 6
    return js_weekday - 1


# ==========================
# 🔥 ENDPOINT PRINCIPAL: GET / - Retorna todos os slots de disponibilidade
# ==========================

@router.get("/")
def get_availability_slots(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Retorna a lista completa de slots de disponibilidade do terapeuta.
    """
    print(f"\n📊 Buscando slots de disponibilidade")
    print(f"👤 Usuário ID: {current_user.id}")
    print(f"👤 Usuário Role: {current_user.role}")
    
    try:
        # 🔥 CORREÇÃO: Buscar o perfil do terapeuta usando user_id
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            print(f"⚠️ Perfil não encontrado para usuário {current_user.id}")
            return []
        
        print(f"✅ Perfil encontrado: ID={therapist_profile.id}, user_id={therapist_profile.user_id}")
        
        # 🔥 CORREÇÃO: Buscar períodos usando therapist_profile.id
        periods = db.execute(
            select(AvailabilityPeriod).where(
                AvailabilityPeriod.therapist_profile_id == therapist_profile.id
            )
        ).scalars().all()
        
        print(f"📅 Períodos encontrados: {len(periods)}")
        
        if not periods:
            print(f"⚠️ Nenhum período encontrado para therapist_profile_id={therapist_profile.id}")
            return []
        
        # 🔥 CORREÇÃO: Buscar todos os slots usando join com AvailabilityPeriod
        slots = db.execute(
            select(AvailabilitySlot)
            .join(AvailabilityPeriod)
            .where(AvailabilityPeriod.therapist_profile_id == therapist_profile.id)
            .order_by(AvailabilityPeriod.start_date, AvailabilitySlot.weekday, AvailabilitySlot.start_time)
        ).scalars().all()
        
        print(f"✅ {len(slots)} slots encontrados para terapeuta {therapist_profile.id}")
        return slots
        
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        return []


# ==========================
# GET - Listar todos os períodos do terapeuta
# ==========================

@router.get("/periods", response_model=list[AvailabilityPeriodOut])
def list_periods(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Lista todos os períodos de disponibilidade do terapeuta logado.
    """
    print(f"\n📋 Listando períodos para usuário: {current_user.id}")
    
    try:
        # 🔥 CORREÇÃO: Buscar o perfil do terapeuta usando user_id
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            print(f"⚠️ Perfil não encontrado para usuário {current_user.id}")
            return []
        
        print(f"✅ Perfil encontrado: ID={therapist_profile.id}")
        
        # 🔥 CORREÇÃO: Buscar períodos usando therapist_profile.id
        periods = db.execute(
            select(AvailabilityPeriod)
            .where(AvailabilityPeriod.therapist_profile_id == therapist_profile.id)
            .order_by(AvailabilityPeriod.start_date.desc())
        ).scalars().all()
        
        print(f"✅ {len(periods)} períodos encontrados")
        return periods
        
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        return []


# ==========================
# POST - Criar novo período com slots
# ==========================

@router.post("/periods", response_model=AvailabilityPeriodOut, status_code=201)
def create_period(
    payload: AvailabilityPeriodCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Cria um novo período de disponibilidade com seus slots.
    """
    print("\n" + "="*70)
    print("📝 Criando novo período de disponibilidade")
    print(f"👤 Usuário ID: {current_user.id}")
    print("="*70)
    
    try:
        # 🔥 CORREÇÃO: Buscar o perfil do terapeuta usando user_id
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")
        
        print(f"✅ Perfil encontrado: ID={therapist_profile.id}")
        
        # Validar datas
        if payload.start_date > payload.end_date:
            raise HTTPException(status_code=400, detail="Data inicial não pode ser maior que data final")
        
        # Validar slots
        if not payload.slots:
            raise HTTPException(status_code=400, detail="Pelo menos um horário deve ser informado")
        
        for slot in payload.slots:
            if slot.weekday < 0 or slot.weekday > 6:
                raise HTTPException(status_code=400, detail="Dia da semana deve ser entre 0 e 6")
            if slot.start_time >= slot.end_time:
                raise HTTPException(status_code=400, detail="Horário de início deve ser anterior ao fim")
        
        # 🔥 CORREÇÃO: Criar o período com therapist_profile.id
        period = AvailabilityPeriod(
            therapist_profile_id=therapist_profile.id,
            start_date=payload.start_date,
            end_date=payload.end_date
        )
        
        db.add(period)
        db.flush()
        
        # Criar os slots
        for slot_data in payload.slots:
            python_weekday = js_weekday_to_python_weekday(slot_data.weekday)
            print(f"   Convertendo weekday: JS={slot_data.weekday} -> Python={python_weekday}")
            
            slot = AvailabilitySlot(
                period_id=period.id,
                weekday=python_weekday,
                start_time=slot_data.start_time,
                end_time=slot_data.end_time
            )
            db.add(slot)
        
        db.commit()
        db.refresh(period)
        
        print(f"✅ Período criado com ID: {period.id}")
        print(f"   {len(payload.slots)} slots adicionados")
        
        return period
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# DELETE - Remover um período
# ==========================

@router.delete("/periods/{period_id}", status_code=204)
def delete_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Remove um período e todos os seus slots.
    """
    print(f"\n🗑️ Removendo período ID: {period_id}")
    
    try:
        # 🔥 CORREÇÃO: Buscar o perfil do terapeuta usando user_id
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")
        
        # Buscar o período
        period = db.get(AvailabilityPeriod, period_id)
        
        if not period:
            raise HTTPException(status_code=404, detail="Período não encontrado")
        
        # Verificar se o período pertence ao terapeuta
        if period.therapist_profile_id != therapist_profile.id:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        # Remove o período (os slots serão removidos automaticamente pelo CASCADE)
        db.delete(period)
        db.commit()
        
        print(f"✅ Período {period_id} removido")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# GET - Buscar um período específico
# ==========================

@router.get("/periods/{period_id}", response_model=AvailabilityPeriodOut)
def get_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    """
    Busca um período específico com seus slots.
    """
    print(f"\n🔍 Buscando período ID: {period_id}")
    
    try:
        # 🔥 CORREÇÃO: Buscar o perfil do terapeuta usando user_id
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")
        
        # Buscar o período
        period = db.get(AvailabilityPeriod, period_id)
        
        if not period:
            raise HTTPException(status_code=404, detail="Período não encontrado")
        
        # Verificar se o período pertence ao terapeuta
        if period.therapist_profile_id != therapist_profile.id:
            raise HTTPException(status_code=403, detail="Acesso negado")
        
        return period
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")