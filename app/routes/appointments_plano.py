from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Security, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.appointment_status import AppointmentStatus
from app.models.user import User
from app.models.appointment import Appointment
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.empresa_profile import EmpresaProfile
from app.models.empresa_plano import EmpresaPlano
from app.models.wallet import Wallet, Ledger
from app.schemas.appointment import AppointmentCreate, AppointmentOut

router = APIRouter(prefix="/appointments/plano", tags=["appointments-plano"])

BR_TZ = timezone(timedelta(hours=-3))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_primeiro_dia_mes() -> datetime:
    hoje = datetime.now()
    return datetime(hoje.year, hoje.month, 1, 0, 0, 0)


def get_ultimo_dia_mes() -> datetime:
    hoje = datetime.now()
    if hoje.month == 12:
        return datetime(hoje.year + 1, 1, 1, 0, 0, 0) - timedelta(days=1)
    return datetime(hoje.year, hoje.month + 1, 1, 0, 0, 0) - timedelta(days=1)


def get_sessoes_usadas_mes(patient_user_id: int, db: Session) -> int:
    """Retorna quantas sessões do plano empresa o colaborador já usou no mês atual"""
    primeiro_dia = get_primeiro_dia_mes()
    ultimo_dia = get_ultimo_dia_mes()
    
    sessoes_usadas = db.query(Appointment).filter(
        Appointment.patient_user_id == patient_user_id,
        Appointment.is_empresa_benefit == True,
        Appointment.status.in_([
            AppointmentStatus.scheduled,
            AppointmentStatus.confirmed,
            AppointmentStatus.completed
        ]),
        Appointment.starts_at >= primeiro_dia,
        Appointment.starts_at <= ultimo_dia
    ).count()
    
    return sessoes_usadas


def get_creditos_empresa_disponiveis(patient_user_id: int, db: Session) -> int:
    """Retorna quantos créditos de empresa o colaborador tem disponível no wallet"""
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == patient_user_id
    ).first()
    
    if not patient_profile or not patient_profile.empresa_id:
        return 0
    
    # Buscar plano da empresa
    empresa = db.query(EmpresaProfile).filter(
        EmpresaProfile.id == patient_profile.empresa_id
    ).first()
    
    if not empresa or not empresa.plano_id:
        return 0
    
    plano = db.query(EmpresaPlano).filter(
        EmpresaPlano.id == empresa.plano_id
    ).first()
    
    if not plano:
        return 0
    
    sessoes_contratadas = plano.sessoes_inclusas_por_colaborador
    sessoes_usadas = get_sessoes_usadas_mes(patient_user_id, db)
    
    return max(0, sessoes_contratadas - sessoes_usadas)


def debitar_credito_empresa(patient_user_id: int, amount: float, appointment_id: int, db: Session):
    """Debita crédito de empresa do wallet do colaborador"""
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == patient_user_id
    ).first()
    
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Perfil do paciente não encontrado")
    
    wallet = db.query(Wallet).filter(
        Wallet.patient_id == patient_profile.id
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Carteira não encontrada")
    
    old_balance = wallet.balance
    wallet.balance -= amount
    
    ledger = Ledger(
        wallet_id=wallet.id,
        appointment_id=appointment_id,
        transaction_type="session_debit",
        amount=amount,
        balance_after=wallet.balance,
        description=f"Sessão via plano empresa - ID {appointment_id}",
        credit_type="empresa_credit"
    )
    db.add(ledger)
    
    print(f"💰 Débito de crédito empresa: R$ {amount} | Saldo anterior: R$ {old_balance} | Saldo atual: R$ {wallet.balance}")


@router.post("/create", response_model=AppointmentOut, status_code=201)
def create_empresa_appointment(
    payload: AppointmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient]))
):
    """
    Cria agendamento para colaborador usando plano empresa (pós-pago)
    Se não houver créditos, redireciona para o fluxo comum (pré-pago)
    """
    print(f"\n🏢 [PLANO EMPRESA] Criando agendamento para usuário: {current_user.id}")
    
    # 1. Verificar se é colaborador de empresa
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == current_user.id
    ).first()
    
    if not patient_profile or not patient_profile.empresa_id:
        raise HTTPException(status_code=400, detail="Usuário não é colaborador de empresa")
    
    # 2. Buscar empresa e plano
    empresa = db.query(EmpresaProfile).filter(
        EmpresaProfile.id == patient_profile.empresa_id
    ).first()
    
    if not empresa or not empresa.plano_id:
        raise HTTPException(status_code=400, detail="Empresa não possui plano ativo")
    
    plano = db.query(EmpresaPlano).filter(
        EmpresaPlano.id == empresa.plano_id
    ).first()
    
    if not plano or not plano.ativo:
        raise HTTPException(status_code=400, detail="Plano da empresa não está ativo")
    
    # 3. Verificar se o colaborador tem acesso ativo
    if patient_profile.access_ends_at and patient_profile.access_ends_at < datetime.now():
        raise HTTPException(status_code=403, detail="Acesso expirado. Contate a empresa.")
    
    # 4. Verificar disponibilidade de créditos
    creditos_disponiveis = get_creditos_empresa_disponiveis(current_user.id, db)
    print(f"📊 Créditos disponíveis: {creditos_disponiveis}")
    
    # 🔥 SE NÃO TEM CRÉDITOS, REDIRECIONA PARA O FLUXO COMUM (PRÉ-PAGO)
    if creditos_disponiveis <= 0:
        print(f"🔄 Sem créditos - Redirecionando para fluxo comum (pré-pago)")
        from app.routes.appointments import create_appointment as create_common_appointment
        return create_common_appointment(payload, request, db, current_user)
    
    # 5. Verificar se terapeuta existe
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == payload.therapist_user_id
    ).first()
    
    if not therapist_profile:
        raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")
    
    # 6. Verificar disponibilidade do terapeuta (horário)
    from app.models.availability import AvailabilityPeriod, AvailabilitySlot
    
    starts_at = payload.starts_at
    ends_at = payload.ends_at
    
    starts_at_local = starts_at.astimezone(BR_TZ)
    ends_at_local = ends_at.astimezone(BR_TZ)
    weekday = starts_at_local.weekday()
    start_t = starts_at_local.time()
    end_t = ends_at_local.time()
    
    active_periods = db.execute(select(AvailabilityPeriod).where(and_(
        AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
        AvailabilityPeriod.start_date <= starts_at_local.date(),
        AvailabilityPeriod.end_date >= starts_at_local.date()
    ))).scalars().all()
    
    if not active_periods:
        raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")
    
    is_available = False
    for period in active_periods:
        slot = db.execute(select(AvailabilitySlot).where(and_(
            AvailabilitySlot.period_id == period.id,
            AvailabilitySlot.weekday == weekday,
            AvailabilitySlot.start_time <= start_t,
            AvailabilitySlot.end_time >= end_t
        ))).scalars().first()
        if slot:
            is_available = True
            break
    
    if not is_available:
        raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")
    
    # 7. Verificar conflito de horário
    overlap_conflict = db.execute(select(Appointment).where(and_(
        Appointment.therapist_user_id == payload.therapist_user_id,
        Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
        starts_at < Appointment.ends_at,
        ends_at > Appointment.starts_at,
    ))).scalars().first()
    
    if overlap_conflict:
        raise HTTPException(status_code=409, detail="Horário já ocupado")
    
    # 8. Criar appointment
    appt = Appointment(
        patient_user_id=current_user.id,
        therapist_user_id=therapist_profile.user_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status=AppointmentStatus.scheduled,
        session_price=plano.valor_repassado_terapeuta,
        duration_minutes=payload.duration_minutes or 50,
        appointment_type="empresa_benefit",
        empresa_plano_id=plano.id,
        empresa_session_price=plano.valor_repassado_terapeuta,
        is_empresa_benefit=True
    )
    
    db.add(appt)
    db.flush()
    
    # 9. Registrar débito do crédito empresa no wallet
    try:
        debitar_credito_empresa(current_user.id, plano.valor_repassado_terapeuta, appt.id, db)
    except HTTPException as e:
        db.rollback()
        raise e
    
    # 10. Registrar evento
    from app.models.appointment_event import AppointmentEvent
    from app.core.appointment_event_type import AppointmentEventType
    
    db.add(AppointmentEvent(
        appointment_id=appt.id,
        actor_user_id=current_user.id,
        event_type=AppointmentEventType.created,
        old_status=None,
        new_status=appt.status.value
    ))
    
    db.commit()
    db.refresh(appt)
    
    print(f"✅ Sessão criada via plano empresa: ID {appt.id} | Terapeuta receberá: R$ {plano.valor_repassado_terapeuta}")
    
    return {
        "id": appt.id,
        "patient_user_id": appt.patient_user_id,
        "therapist_user_id": appt.therapist_user_id,
        "starts_at": appt.starts_at,
        "ends_at": appt.ends_at,
        "status": appt.status.value,
        "session_price": appt.session_price,
        "duration_minutes": appt.duration_minutes,
        "appointment_type": appt.appointment_type,
        "is_empresa_benefit": appt.is_empresa_benefit,
        "message": f"Sessão agendada via plano empresa. Créditos restantes no mês: {creditos_disponiveis - 1}"
    }


@router.get("/creditos/{patient_user_id}")
def get_creditos_disponiveis(
    patient_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.patient, UserRole.admin]))
):
    """Retorna quantos créditos de empresa o colaborador tem disponível no mês"""
    
    if current_user.role != UserRole.admin and current_user.id != patient_user_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    creditos = get_creditos_empresa_disponiveis(patient_user_id, db)
    sessoes_usadas = get_sessoes_usadas_mes(patient_user_id, db)
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == patient_user_id
    ).first()
    
    plano_nome = None
    sessoes_contratadas = 0
    
    if patient_profile and patient_profile.empresa_id:
        empresa = db.query(EmpresaProfile).filter(
            EmpresaProfile.id == patient_profile.empresa_id
        ).first()
        if empresa and empresa.plano_id:
            plano = db.query(EmpresaPlano).filter(
                EmpresaPlano.id == empresa.plano_id
            ).first()
            if plano:
                plano_nome = plano.nome
                sessoes_contratadas = plano.sessoes_inclusas_por_colaborador
    
    return {
        "creditos_disponiveis": creditos,
        "sessoes_usadas": sessoes_usadas,
        "sessoes_contratadas": sessoes_contratadas,
        "plano_nome": plano_nome,
        "mes_referencia": datetime.now().strftime("%Y-%m")
    }