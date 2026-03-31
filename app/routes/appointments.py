from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Security, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.appointment_status import AppointmentStatus
from app.core.appointment_event_type import AppointmentEventType
from app.models.user import User
from app.models.appointment import Appointment
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.appointment_event import AppointmentEvent
from app.models.medical_record import MedicalRecord
from app.models.patient_profile import PatientProfile
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdateStatus,
    RescheduleRequest,
)
from app.schemas.medical_record import MedicalRecordCreate, MedicalRecordOut


# 🔥 SERVIÇOS EXTERNOS
from app.services.email_service import email_service
from app.core.google_meet import google_meet_service
from app.services.receipt_service import receipt_service

router = APIRouter(prefix="/appointments", tags=["appointments"])

print("✅ Serviços de e-mail e Meet carregados com sucesso")


# ==========================
# HELPERS
# ==========================
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _mask_cpf(cpf: str) -> str:
    """Mascara CPF mostrando apenas os 2 primeiros e 2 últimos dígitos"""
    if not cpf:
        return None
    numbers = ''.join(filter(str.isdigit, cpf))
    if len(numbers) != 11:
        return cpf
    first_two = numbers[:2]
    last_two = numbers[-2:]
    return f"{first_two}***.***-{last_two}"


def _calculate_age(birth_date) -> int:
    """Calcula idade a partir da data de nascimento"""
    if not birth_date:
        return None
    today = datetime.now().date()
    if isinstance(birth_date, datetime):
        birth_date = birth_date.date()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def _send_confirmation_emails_and_meet(appt: Appointment, db: Session):
    """Envia e-mails e gera link do Meet após confirmação da sessão"""
    try:
        print("📧 Enviando e-mails de confirmação...")
        
        # Buscar e-mails dos participantes
        patient = db.get(User, appt.patient_user_id)
        therapist = db.get(User, appt.therapist_user_id)
        
        if not patient or not therapist:
            print("⚠️ Paciente ou terapeuta não encontrados para envio de e-mail")
            return
        
        # Gerar link do Meet
        meet_url = None
        try:
            meet_url = google_meet_service.create_meet_link(appt)
            if meet_url:
                appt.video_call_url = meet_url
                db.commit()
                print(f"✅ Meet gerado: {meet_url}")
        except Exception as e:
            print(f"⚠️ Erro ao gerar Meet: {e}")
        
        # Enviar e-mails
        email_service.send_appointment_confirmation(
            appt,
            patient.email,
            therapist.email,
            meet_url
        )
        
    except Exception as e:
        print(f"⚠️ Erro ao enviar e-mails: {e}")
        import traceback
        traceback.print_exc()


# ==========================
# CREATE (COM AUDITORIA)
# ==========================
@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(
    payload: AppointmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([
        UserRole.patient,
        UserRole.therapist,
        UserRole.admin
    ])),
):
    try:
        print(f"📝 Criando appointment - Usuário: {current_user.id}, Role: {current_user.role}")
        print(f"📦 Payload: therapist_user_id={payload.therapist_user_id}, starts_at={payload.starts_at}")

        # Não pode agendar com você mesmo (apenas para pacientes)
        if current_user.role == UserRole.patient and payload.therapist_user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Você não pode agendar com você mesmo")

        # Buscar o perfil do terapeuta
        therapist_profile = db.execute(
            select(TherapistProfile).where(
                TherapistProfile.user_id == payload.therapist_user_id
            )
        ).scalar_one_or_none()

        if not therapist_profile:
            therapist_profile = db.get(TherapistProfile, payload.therapist_user_id)
            if not therapist_profile:
                raise HTTPException(
                    status_code=400,
                    detail="Perfil do terapeuta não encontrado"
                )

        # Verificar se o terapeuta tem preço definido
        if not therapist_profile.session_price:
            raise HTTPException(
                status_code=400,
                detail="Terapeuta ainda não definiu o preço da sessão"
            )

        starts_at = payload.starts_at
        ends_at = payload.ends_at

        # 🔥 VALIDAÇÃO: Usar availability_periods e availability_slots
        from app.models.availability import AvailabilityPeriod, AvailabilitySlot
        
        weekday = starts_at.weekday()
        start_t = starts_at.time()
        end_t = ends_at.time()
        
        active_periods = db.execute(
            select(AvailabilityPeriod).where(
                and_(
                    AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
                    AvailabilityPeriod.start_date <= starts_at.date(),
                    AvailabilityPeriod.end_date >= starts_at.date()
                )
            )
        ).scalars().all()
        
        if not active_periods:
            print(f"⚠️ Nenhum período ativo para {starts_at.date()}")
            raise HTTPException(
                status_code=400,
                detail="Horário fora da disponibilidade do terapeuta"
            )
        
        is_available = False
        for period in active_periods:
            slot = db.execute(
                select(AvailabilitySlot).where(
                    and_(
                        AvailabilitySlot.period_id == period.id,
                        AvailabilitySlot.weekday == weekday,
                        AvailabilitySlot.start_time <= start_t,
                        AvailabilitySlot.end_time >= end_t
                    )
                )
            ).scalars().first()
            
            if slot:
                is_available = True
                print(f"✅ Horário validado no período {period.id}: dia {weekday}, {start_t}-{end_t}")
                break
        
        if not is_available:
            print(f"❌ Horário não encontrado nos slots: dia {weekday}, {start_t}-{end_t}")
            raise HTTPException(
                status_code=400,
                detail="Horário fora da disponibilidade do terapeuta"
            )

        # Validar conflito
        overlap_conflict = db.execute(
            select(Appointment).where(
                and_(
                    Appointment.therapist_user_id == payload.therapist_user_id,
                    Appointment.status.in_([
                        AppointmentStatus.scheduled,
                        AppointmentStatus.confirmed,
                        AppointmentStatus.proposed,
                    ]),
                    starts_at < Appointment.ends_at,
                    ends_at > Appointment.starts_at,
                )
            )
        ).scalars().first()

        if overlap_conflict:
            raise HTTPException(status_code=409, detail="Horário já ocupado")

        # Determinar patient_user_id
        patient_user_id = current_user.id
        if current_user.role == UserRole.therapist:
            if not payload.patient_user_id:
                raise HTTPException(
                    status_code=400,
                    detail="Terapeuta deve especificar o patient_user_id"
                )
            patient_user_id = payload.patient_user_id

        # 🔥 VERIFICAR SALDO
        saldo_insuficiente = False
        wallet_balance = 0

        if current_user.role == UserRole.patient:
            from app.models.patient_profile import PatientProfile
            from app.models.wallet import Wallet

            patient_profile = db.execute(
                select(PatientProfile).where(PatientProfile.user_id == patient_user_id)
            ).scalar_one_or_none()

            if not patient_profile:
                raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")

            wallet = db.execute(
                select(Wallet).where(Wallet.patient_id == patient_profile.id)
            ).scalar_one_or_none()

            if not wallet:
                raise HTTPException(status_code=404, detail="Carteira do paciente não encontrada")

            wallet_balance = wallet.balance

            if wallet.balance < therapist_profile.session_price:
                saldo_insuficiente = True
                print(f"⚠️ Saldo insuficiente: R$ {wallet.balance} disponível, necessário R$ {therapist_profile.session_price}")
                from app.core.audit import get_audit_service
                audit = get_audit_service(db, current_user, request)
                audit.log_insufficient_balance(
                    patient_profile,
                    therapist_profile,
                    therapist_profile.session_price,
                    wallet.balance,
                    {"starts_at": str(starts_at), "therapist_id": payload.therapist_user_id}
                )
            else:
                print(f"💰 Saldo verificado: R$ {wallet.balance} disponível, R$ {therapist_profile.session_price} necessário")

        # Criar appointment
        appt = Appointment(
            patient_user_id=patient_user_id,
            therapist_user_id=therapist_profile.user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.scheduled,
            session_price=therapist_profile.session_price if therapist_profile.session_price else 0,
            duration_minutes=payload.duration_minutes or 50,
        )
        db.add(appt)
        db.flush()

        # Registrar evento
        event = AppointmentEvent(
            appointment_id=appt.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.created,
            old_status=None,
            new_status=appt.status.value,
        )
        db.add(event)

        db.commit()
        db.refresh(appt)

        print(f"✅ Appointment criado com sucesso! ID: {appt.id}")
        
        appt_dict = {
            "id": appt.id,
            "patient_user_id": appt.patient_user_id,
            "therapist_user_id": appt.therapist_user_id,
            "starts_at": appt.starts_at,
            "ends_at": appt.ends_at,
            "status": appt.status.value,
            "session_price": appt.session_price,
            "duration_minutes": appt.duration_minutes,
            "needs_payment": saldo_insuficiente,
            "insufficient_balance": saldo_insuficiente,
            "required_amount": therapist_profile.session_price if saldo_insuficiente else 0,
            "current_balance": wallet_balance
        }
        
        return appt_dict

    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        print(f"❌ Erro de integridade: {e}")
        raise HTTPException(status_code=409, detail="Conflito ao criar agendamento")
    except Exception as e:
        db.rollback()
        print(f"❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# ==========================
# RESCHEDULE
# ==========================
@router.post("/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: int,
    payload: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([
        UserRole.therapist,
        UserRole.admin,
        UserRole.patient
    ])),
):
    try:
        original = db.get(Appointment, appointment_id)
        if not original:
            raise HTTPException(status_code=404, detail="Appointment não encontrado")

        is_patient = original.patient_user_id == current_user.id
        is_therapist = original.therapist_user_id == current_user.id
        is_admin = current_user.role == UserRole.admin

        if not (is_patient or is_therapist or is_admin):
            raise HTTPException(status_code=403, detail="Acesso negado para reagendar")

        # Regra para pacientes: apenas um reagendamento
        if is_patient and not is_admin:
            if original.rescheduled_from_id:
                raise HTTPException(
                    status_code=400,
                    detail="Esta sessão já foi reagendada anteriormente. Apenas um reagendamento é permitido."
                )
            already_rescheduled = db.execute(
                select(Appointment).where(
                    Appointment.rescheduled_from_id == original.id
                )
            ).scalars().first()
            if already_rescheduled:
                raise HTTPException(
                    status_code=400,
                    detail="Esta sessão já foi reagendada anteriormente. Apenas um reagendamento é permitido."
                )

        if original.status in (
            AppointmentStatus.completed,
            AppointmentStatus.cancelled_by_patient,
            AppointmentStatus.cancelled_by_therapist,
            AppointmentStatus.cancelled_by_admin,
            AppointmentStatus.rescheduled,
            AppointmentStatus.no_show,
        ):
            raise HTTPException(status_code=400, detail="Appointment já finalizado")

        starts_at = payload.starts_at
        ends_at = payload.ends_at

        therapist_profile = db.execute(
            select(TherapistProfile).where(
                TherapistProfile.user_id == original.therapist_user_id
            )
        ).scalar_one_or_none()

        if not therapist_profile:
            therapist_profile = db.get(TherapistProfile, original.therapist_user_id)
            if not therapist_profile:
                raise HTTPException(status_code=400, detail="Perfil do terapeuta não encontrado")

        from app.models.availability import AvailabilityPeriod, AvailabilitySlot
        
        weekday = starts_at.weekday()
        start_t = starts_at.time()
        end_t = ends_at.time()
        
        active_periods = db.execute(
            select(AvailabilityPeriod).where(
                and_(
                    AvailabilityPeriod.therapist_profile_id == therapist_profile.id,
                    AvailabilityPeriod.start_date <= starts_at.date(),
                    AvailabilityPeriod.end_date >= starts_at.date()
                )
            )
        ).scalars().all()
        
        if not active_periods:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")
        
        is_available = False
        for period in active_periods:
            slot = db.execute(
                select(AvailabilitySlot).where(
                    and_(
                        AvailabilitySlot.period_id == period.id,
                        AvailabilitySlot.weekday == weekday,
                        AvailabilitySlot.start_time <= start_t,
                        AvailabilitySlot.end_time >= end_t
                    )
                )
            ).scalars().first()
            if slot:
                is_available = True
                break
        
        if not is_available:
            raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do terapeuta")

        conflict = db.execute(
            select(Appointment).where(
                and_(
                    Appointment.therapist_user_id == original.therapist_user_id,
                    Appointment.id != original.id,
                    Appointment.status.in_([
                        AppointmentStatus.scheduled,
                        AppointmentStatus.confirmed,
                        AppointmentStatus.proposed,
                    ]),
                    starts_at < Appointment.ends_at,
                    ends_at > Appointment.starts_at,
                )
            )
        ).scalars().first()

        if conflict:
            raise HTTPException(status_code=409, detail="Horário já ocupado")

        new_appt = Appointment(
            patient_user_id=original.patient_user_id,
            therapist_user_id=therapist_profile.user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.scheduled,
            rescheduled_from_id=original.id,
            session_price=original.session_price,
            duration_minutes=payload.duration_minutes or original.duration_minutes or 50,
        )

        old_status = original.status
        original.status = AppointmentStatus.rescheduled

        db.add(new_appt)
        db.flush()

        event = AppointmentEvent(
            appointment_id=original.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.rescheduled,
            old_status=old_status.value,
            new_status=AppointmentStatus.rescheduled.value,
            event_metadata={"new_appointment_id": new_appt.id},
        )
        db.add(event)

        db.commit()
        db.refresh(new_appt)

        print(f"✅ Reagendamento criado com sucesso! Novo ID: {new_appt.id}")
        return new_appt

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao reagendar: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao reagendar")


# ==========================
# LIST MY APPOINTMENTS WITH DETAILS
# ==========================
@router.get("/me/details")
def list_my_appointments_with_details(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([
        UserRole.patient,
        UserRole.therapist,
        UserRole.admin
    ])),
):
    try:
        print(f"\n📋 Listando appointments DETALHADOS para usuário: {current_user.id}, role: {current_user.role}")

        query = select(Appointment).where(
            or_(
                Appointment.patient_user_id == current_user.id,
                Appointment.therapist_user_id == current_user.id,
            )
        ).order_by(Appointment.starts_at.desc())

        rows = db.execute(query).scalars().all()
        print(f"✅ Encontrados {len(rows)} appointments no banco")

        result = []
        for apt in rows:
            status_value = apt.status
            if hasattr(apt.status, 'value'):
                status_value = apt.status.value
            elif apt.status is not None:
                status_value = str(apt.status)
            else:
                status_value = None

            patient_data = None
            if apt.patient_user_id:
                patient = db.get(User, apt.patient_user_id)
                if patient:
                    patient_profile = db.execute(
                        select(PatientProfile).where(PatientProfile.user_id == patient.id)
                    ).scalar_one_or_none()
                    
                    masked_cpf = _mask_cpf(patient_profile.cpf) if patient_profile and patient_profile.cpf else None
                    birth_date = patient_profile.birth_date if patient_profile and hasattr(patient_profile, 'birth_date') else None
                    age = _calculate_age(birth_date) if birth_date else None
                    
                    patient_data = {
                        "id": patient.id,
                        "email": patient.email,
                        "full_name": patient_profile.full_name if patient_profile and patient_profile.full_name else patient.full_name,
                        "foto_url": patient_profile.foto_url if patient_profile else None,
                        "cpf": masked_cpf,
                        "birth_date": birth_date.isoformat() if birth_date else None,
                        "age": age
                    }
            
            therapist_data = None
            if apt.therapist_user_id:
                therapist = db.get(User, apt.therapist_user_id)
                if therapist:
                    from app.models.therapist_profile import TherapistProfile
                    therapist_profile = db.execute(
                        select(TherapistProfile).where(TherapistProfile.user_id == therapist.id)
                    ).scalar_one_or_none()
                    
                    therapist_data = {
                        "id": therapist.id,
                        "email": therapist.email,
                        "full_name": therapist_profile.full_name if therapist_profile and therapist_profile.full_name else therapist.full_name,
                        "foto_url": therapist_profile.foto_url if therapist_profile else None
                    }

            apt_dict = {
                "id": apt.id,
                "patient_user_id": apt.patient_user_id,
                "therapist_user_id": apt.therapist_user_id,
                "starts_at": apt.starts_at.isoformat() if apt.starts_at else None,
                "ends_at": apt.ends_at.isoformat() if apt.ends_at else None,
                "status": status_value,
                "session_price": float(apt.session_price) if apt.session_price else None,
                "rescheduled_from_id": apt.rescheduled_from_id,
                "duration_minutes": apt.duration_minutes,
                "created_at": apt.created_at.isoformat() if apt.created_at else None,
                "patient": patient_data,
                "therapist": therapist_data,
                "video_call_url": apt.video_call_url
            }

            result.append(apt_dict)

        print(f"✅ Retornando {len(result)} appointments com detalhes completos")
        return result

    except Exception as e:
        print(f"❌ Erro ao listar appointments detalhados: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar sessões detalhadas: {str(e)}")


# ==========================
# COMPLETE APPOINTMENT (MEDICAL RECORD) - CORRIGIDO COM REGRA PARA AUSÊNCIA DO PACIENTE
# ==========================
@router.post("/{appointment_id}/complete", response_model=MedicalRecordOut)
def complete_appointment(
    appointment_id: int,
    record_data: MedicalRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Finaliza uma sessão e registra o prontuário.
    REGRAS:
    - Se session_not_occurred = False: exige evolution e outcome
    - Se session_not_occurred = True e motivo = CLIENTE_NAO_COMPARECEU:
        * NÃO exige evolution e outcome
        * Registra apenas a ausência
        * Sessão marcada como completed (para não ser cobrada novamente)
    - Se session_not_occurred = True e outros motivos: exige motivo e pode abrir popup de reagendamento (frontend)
    """
    print(f"\n📋 Finalizando sessão ID: {appointment_id}")
    
    # Buscar appointment
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verificar permissão
    if appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o terapeuta da sessão pode finalizar")
    
    # Verificar se já existe prontuário
    existing = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == appointment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prontuário já registrado. Não é possível alterar.")
    
    # 🔥 REGRA ESPECIAL: CLIENTE NÃO COMPARECEU
    is_client_absence = (record_data.session_not_occurred and 
                         record_data.not_occurred_reason == "CLIENTE_NAO_COMPARECEU")
    
    # Validar dados conforme a regra
    if record_data.session_not_occurred:
        if not record_data.not_occurred_reason:
            raise HTTPException(status_code=400, detail="Motivo da não ocorrência é obrigatório")
        
        # Se NÃO for ausência do cliente, exige evolution e outcome? 
        # (Para outros motivos, o frontend deve abrir popup de reagendamento)
        # Não exigimos evolution/outcome para nenhum motivo de não ocorrência
        pass
    else:
        # Sessão ocorreu: exige evolution e outcome
        if not record_data.evolution:
            raise HTTPException(status_code=400, detail="Evolução do atendimento é obrigatória")
        if not record_data.outcome:
            raise HTTPException(status_code=400, detail="Desfecho clínico é obrigatório")
    
    # Criar prontuário
    medical_record = MedicalRecord(
        appointment_id=appointment_id,
        session_not_occurred=record_data.session_not_occurred,
        not_occurred_reason=record_data.not_occurred_reason,
        evolution=record_data.evolution if not record_data.session_not_occurred else None,
        outcome=record_data.outcome if not record_data.session_not_occurred else None,
        patient_reasons=record_data.patient_reasons,
        private_notes=record_data.private_notes,
        activity_instructions=record_data.activity_instructions if not record_data.session_not_occurred else None,
        links=record_data.links if not record_data.session_not_occurred else None
    )
    
    db.add(medical_record)
    
    # Atualizar status do appointment para completed
    appointment.status = AppointmentStatus.completed
    
    db.commit()
    db.refresh(medical_record)
    
    if is_client_absence:
        print(f"✅ Ausência do paciente registrada para sessão {appointment_id}")
    else:
        print(f"✅ Prontuário registrado para sessão {appointment_id}")
    
    return medical_record


# ==========================
# GET MEDICAL RECORD
# ==========================
@router.get("/{appointment_id}/medical-record", response_model=MedicalRecordOut)
def get_medical_record(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist]))
):
    """
    Obtém o prontuário de uma sessão.
    Paciente vê apenas informações não privadas.
    Terapeuta vê tudo.
    """
    print(f"\n📖 Buscando prontuário da sessão ID: {appointment_id}")
    
    # Buscar appointment
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verificar permissão
    if current_user.role == UserRole.patient:
        if appointment.patient_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    elif current_user.role == UserRole.therapist:
        if appointment.therapist_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Buscar prontuário
    medical_record = db.query(MedicalRecord).filter(MedicalRecord.appointment_id == appointment_id).first()
    if not medical_record:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado")
    
    # Paciente não vê notas privadas
    if current_user.role == UserRole.patient:
        medical_record.private_notes = None
    
    return medical_record


# ==========================
# RECIBO ENDPOINTS
# ==========================

@router.get("/{appointment_id}/receipt")
def download_receipt(
    appointment_id: int,
    format: str = "pdf",  # pdf ou html
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist]))
):
    """
    Baixa o recibo da sessão em PDF ou HTML
    """
    print(f"\n📄 Gerando recibo para sessão ID: {appointment_id}, formato: {format}")
    
    # Buscar appointment
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verificar permissão (paciente ou terapeuta da sessão)
    if current_user.id not in [appointment.patient_user_id, appointment.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Verificar se a sessão foi realizada
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Recibo disponível apenas para sessões realizadas")
    
    # Buscar perfis
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == appointment.therapist_user_id
    ).first()
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == appointment.patient_user_id
    ).first()
    
    patient_user = db.get(User, appointment.patient_user_id)
    
    if not therapist_profile or not patient_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    # Gerar HTML do recibo
    html_content = receipt_service.generate_receipt_html(
        appointment, therapist_profile, patient_profile, patient_user
    )
    
    if format == "html":
        return Response(content=html_content, media_type="text/html")
    
    # Gerar PDF
    pdf_bytes = receipt_service.generate_receipt_pdf(html_content)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=recibo_sessao_{appointment_id}.pdf"
        }
    )


@router.post("/{appointment_id}/send-receipt")
def send_receipt_by_email(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist]))
):
    """
    Envia o recibo da sessão por e-mail para o paciente
    """
    print(f"\n📧 Enviando recibo por e-mail para sessão ID: {appointment_id}")
    
    # Buscar appointment
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verificar permissão (paciente ou terapeuta da sessão)
    if current_user.id not in [appointment.patient_user_id, appointment.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Verificar se a sessão foi realizada
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Recibo disponível apenas para sessões realizadas")
    
    # Buscar perfis
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == appointment.therapist_user_id
    ).first()
    
    patient_profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == appointment.patient_user_id
    ).first()
    
    patient_user = db.get(User, appointment.patient_user_id)
    
    if not therapist_profile or not patient_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    # Gerar HTML do recibo
    html_content = receipt_service.generate_receipt_html(
        appointment, therapist_profile, patient_profile, patient_user
    )
    
    # Enviar e-mail
    email_service.send_receipt_email(
        to_email=patient_user.email,
        patient_name=patient_profile.full_name or patient_user.full_name,
        therapist_name=therapist_profile.full_name or therapist_profile.user.full_name,
        session_date=appointment.starts_at.strftime("%d/%m/%Y"),
        session_id=str(appointment.id),
        receipt_html=html_content
    )
    
    return {"message": "Recibo enviado por e-mail com sucesso"}


# ==========================
# UPDATE STATUS (COM DÉBITO, ESTORNO, MEET E E-MAIL)
# ==========================
@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentUpdateStatus,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([
        UserRole.patient,
        UserRole.therapist,
        UserRole.admin
    ])),
):
    from app.models.patient_profile import PatientProfile
    from app.models.wallet import Wallet, Ledger
    from app.core.audit import get_audit_service
    
    try:
        print("\n" + "="*70)
        print("🔄 UPDATE APPOINTMENT STATUS (INÍCIO)")
        print(f"📋 appointment_id: {appointment_id}")
        print(f"👤 current_user: ID={current_user.id}, role={current_user.role}")
        print(f"📦 payload.status: {payload.status}")
        print("="*70)

        appt = db.get(Appointment, appointment_id)
        if not appt:
            print(f"❌ Appointment {appointment_id} não encontrado")
            raise HTTPException(status_code=404, detail="Appointment não encontrado")

        is_patient = appt.patient_user_id == current_user.id
        is_therapist = appt.therapist_user_id == current_user.id
        is_admin = current_user.role == UserRole.admin

        if not (is_patient or is_therapist or is_admin):
            print("❌ Acesso negado - usuário não tem permissão")
            raise HTTPException(status_code=403, detail="Acesso negado")

        if appt.status in (
            AppointmentStatus.completed,
            AppointmentStatus.cancelled_by_patient,
            AppointmentStatus.cancelled_by_therapist,
            AppointmentStatus.cancelled_by_admin,
            AppointmentStatus.rescheduled,
            AppointmentStatus.no_show,
        ):
            print(f"❌ Appointment já finalizado com status: {appt.status}")
            raise HTTPException(status_code=400, detail="Appointment já finalizado")

        new_status = payload.status
        if isinstance(new_status, str):
            try:
                new_status = AppointmentStatus(new_status)
            except ValueError:
                raise HTTPException(status_code=400, detail="Status inválido")

        old_status = appt.status

        # 🔥 VALIDAÇÕES PARA PACIENTE
        if is_patient and not is_admin:
            if new_status == AppointmentStatus.cancelled_by_patient:
                # 🔥 CONVITES (status proposed) podem ser cancelados a qualquer momento
                if appt.status != AppointmentStatus.proposed:
                    seconds_until = (_to_utc(appt.starts_at) - _utcnow()).total_seconds()
                    if seconds_until < 24 * 3600:
                        raise HTTPException(
                            status_code=400,
                            detail="Cancelamento permitido somente com 24h de antecedência",
                        )
            elif new_status == AppointmentStatus.confirmed:
                if appt.status not in (AppointmentStatus.scheduled, AppointmentStatus.proposed):
                    raise HTTPException(
                        status_code=400,
                        detail="Só é possível confirmar sessões agendadas ou convites pendentes"
                    )
            else:
                raise HTTPException(status_code=403, detail="Ação não permitida para paciente")

        elif is_therapist and not is_admin:
            if new_status not in (
                AppointmentStatus.cancelled_by_therapist,
                AppointmentStatus.confirmed,
                AppointmentStatus.completed,
                AppointmentStatus.no_show,
                AppointmentStatus.proposed,
            ):
                raise HTTPException(status_code=403, detail="Ação não permitida para terapeuta")

        if new_status == AppointmentStatus.confirmed:
            if appt.status not in (AppointmentStatus.scheduled, AppointmentStatus.proposed):
                raise HTTPException(
                    status_code=400,
                    detail="Só é possível confirmar quando está scheduled ou proposed"
                )

        if new_status == AppointmentStatus.completed:
            now_utc = _utcnow()
            start_utc = _to_utc(appt.starts_at)
            if now_utc < start_utc:
                raise HTTPException(
                    status_code=400,
                    detail="Não é possível completar antes do início"
                )

        # PROCESSAR DÉBITO SE FOR CONFIRMAÇÃO
        if new_status == AppointmentStatus.confirmed:
            patient_profile = db.execute(
                select(PatientProfile).where(PatientProfile.user_id == appt.patient_user_id)
            ).scalar_one_or_none()

            if not patient_profile:
                raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado")

            wallet = db.execute(
                select(Wallet).where(Wallet.patient_id == patient_profile.id)
            ).scalar_one_or_none()

            if not wallet:
                raise HTTPException(status_code=404, detail="Carteira do paciente não encontrada")

            already_debited = db.execute(
                select(Ledger).where(
                    Ledger.appointment_id == appt.id,
                    Ledger.transaction_type == "session_debit"
                )
            ).scalars().first()

            if not already_debited:
                if wallet.balance < appt.session_price:
                    raise HTTPException(
                        status_code=402,
                        detail=f"Saldo insuficiente para confirmar sessão. Necessário: R$ {appt.session_price}"
                    )

                old_balance = wallet.balance
                wallet.balance -= appt.session_price

                debit_ledger = Ledger(
                    wallet_id=wallet.id,
                    appointment_id=appt.id,
                    transaction_type="session_debit",
                    amount=appt.session_price,
                    balance_after=wallet.balance,
                    description=f"Sessão com terapeuta ID {appt.therapist_user_id}"
                )
                db.add(debit_ledger)

                audit = get_audit_service(db, current_user, request)
                audit.log_session_debit(appt, wallet, old_balance, wallet.balance, appt.session_price)

                # 🔥 ENVIAR E-MAIL E GERAR MEET
                _send_confirmation_emails_and_meet(appt, db)

        # PROCESSAR ESTORNO
        is_patient_cancel = (is_patient and new_status == AppointmentStatus.cancelled_by_patient)
        is_therapist_cancel = (is_therapist and new_status == AppointmentStatus.cancelled_by_therapist)
        
        if is_patient_cancel or is_therapist_cancel:
            if old_status in [AppointmentStatus.confirmed, AppointmentStatus.scheduled]:
                
                if is_patient_cancel:
                    seconds_until = (_to_utc(appt.starts_at) - _utcnow()).total_seconds()
                    if seconds_until < 24 * 3600:
                        print(f"⚠️ Paciente cancelou com menos de 24h - sem estorno")
                    else:
                        debit_transaction = db.execute(
                            select(Ledger).where(
                                Ledger.appointment_id == appt.id,
                                Ledger.transaction_type == "session_debit"
                            )
                        ).scalar_one_or_none()

                        if debit_transaction:
                            wallet = db.get(Wallet, debit_transaction.wallet_id)
                            if wallet:
                                old_balance = wallet.balance
                                wallet.balance += debit_transaction.amount

                                refund_ledger = Ledger(
                                    wallet_id=wallet.id,
                                    appointment_id=appt.id,
                                    transaction_type="cancellation_refund",
                                    amount=debit_transaction.amount,
                                    balance_after=wallet.balance,
                                    description=f"Estorno por cancelamento - Sessão {appt.id}"
                                )
                                db.add(refund_ledger)

                                audit = get_audit_service(db, current_user, request)
                                audit.log_session_refund(
                                    appt, wallet, old_balance, wallet.balance, 
                                    debit_transaction.amount, "Cancelamento com 24h+"
                                )
                                
                                print(f"💰 Estorno realizado: R$ {debit_transaction.amount}")
                
                elif is_therapist_cancel:
                    debit_transaction = db.execute(
                        select(Ledger).where(
                            Ledger.appointment_id == appt.id,
                            Ledger.transaction_type == "session_debit"
                        )
                    ).scalar_one_or_none()

                    if debit_transaction:
                        wallet = db.get(Wallet, debit_transaction.wallet_id)
                        if wallet:
                            old_balance = wallet.balance
                            wallet.balance += debit_transaction.amount

                            refund_ledger = Ledger(
                                wallet_id=wallet.id,
                                appointment_id=appt.id,
                                transaction_type="cancellation_refund",
                                amount=debit_transaction.amount,
                                balance_after=wallet.balance,
                                description=f"Estorno por cancelamento (terapeuta) - Sessão {appt.id}"
                            )
                            db.add(refund_ledger)

                            audit = get_audit_service(db, current_user, request)
                            audit.log_session_refund(
                                appt, wallet, old_balance, wallet.balance, 
                                debit_transaction.amount, "Cancelamento por terapeuta"
                            )
                            
                            print(f"💰 Estorno realizado (terapeuta): R$ {debit_transaction.amount}")

        appt.status = new_status

        event = AppointmentEvent(
            appointment_id=appt.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.status_changed,
            old_status=old_status.value if old_status else None,
            new_status=new_status.value,
        )
        db.add(event)

        db.commit()
        db.refresh(appt)

        print(f"✅ Status atualizado com sucesso para {appt.status}")
        
        # 🔥 Se foi confirmação e não tem Meet, tentar gerar novamente
        if new_status == AppointmentStatus.confirmed and not appt.video_call_url:
            print("🔄 Gerando Meet após commit...")
            try:
                meet_url = google_meet_service.create_meet_link(appt)
                if meet_url:
                    appt.video_call_url = meet_url
                    db.commit()
                    print(f"✅ Meet gerado após commit: {meet_url}")
            except Exception as e:
                print(f"⚠️ Erro ao gerar Meet após commit: {e}")
        
        return appt

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao atualizar status: {str(e)}")