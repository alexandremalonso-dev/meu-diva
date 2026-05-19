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


# ==========================
# GET - Listar todos os slots
# ==========================

@router.get("/")
def get_availability_slots(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if not therapist_profile:
            return []

        slots = db.execute(
            select(AvailabilitySlot)
            .join(AvailabilityPeriod)
            .where(AvailabilityPeriod.therapist_profile_id == therapist_profile.id)
            .order_by(AvailabilityPeriod.start_date, AvailabilitySlot.weekday, AvailabilitySlot.start_time)
        ).scalars().all()

        return slots

    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        return []


# ==========================
# GET - Listar todos os períodos
# ==========================

@router.get("/periods", response_model=list[AvailabilityPeriodOut])
def list_periods(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist, UserRole.admin])),
):
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if not therapist_profile:
            return []

        periods = db.execute(
            select(AvailabilityPeriod)
            .where(AvailabilityPeriod.therapist_profile_id == therapist_profile.id)
            .order_by(AvailabilityPeriod.start_date.desc())
        ).scalars().all()

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
    Salva o weekday no formato JS (0=Dom, 1=Seg...6=Sáb) — sem conversão.
    O cálculo de slots em available_slots já trata a conversão Python→JS.
    """
    print(f"\n📝 Criando período para usuário: {current_user.id}")

    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")

        if payload.start_date > payload.end_date:
            raise HTTPException(status_code=400, detail="Data inicial não pode ser maior que data final")

        if not payload.slots:
            raise HTTPException(status_code=400, detail="Pelo menos um horário deve ser informado")

        for slot in payload.slots:
            if slot.weekday < 0 or slot.weekday > 6:
                raise HTTPException(status_code=400, detail="Dia da semana deve ser entre 0 e 6")
            if slot.start_time >= slot.end_time:
                raise HTTPException(status_code=400, detail="Horário de início deve ser anterior ao fim")

        period = AvailabilityPeriod(
            therapist_profile_id=therapist_profile.id,
            start_date=payload.start_date,
            end_date=payload.end_date
        )
        db.add(period)
        db.flush()

        for slot_data in payload.slots:
            # ✅ Salva diretamente o valor JS — sem conversão
            print(f"   Salvando weekday JS={slot_data.weekday} ({['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][slot_data.weekday]})")
            slot = AvailabilitySlot(
                period_id=period.id,
                weekday=slot_data.weekday,
                start_time=slot_data.start_time,
                end_time=slot_data.end_time
            )
            db.add(slot)

        db.commit()
        db.refresh(period)

        print(f"✅ Período criado: ID={period.id}, {len(payload.slots)} slots")
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
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")

        period = db.get(AvailabilityPeriod, period_id)

        if not period:
            raise HTTPException(status_code=404, detail="Período não encontrado")

        if period.therapist_profile_id != therapist_profile.id:
            raise HTTPException(status_code=403, detail="Acesso negado")

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
    try:
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()

        if not therapist_profile:
            raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")

        period = db.get(AvailabilityPeriod, period_id)

        if not period:
            raise HTTPException(status_code=404, detail="Período não encontrado")

        if period.therapist_profile_id != therapist_profile.id:
            raise HTTPException(status_code=403, detail="Acesso negado")

        return period

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")