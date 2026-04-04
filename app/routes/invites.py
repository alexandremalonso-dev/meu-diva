from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_
from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.core.auth import get_current_user
from app.core.appointment_status import AppointmentStatus
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment
from app.models.appointment_event import AppointmentEvent
from app.core.appointment_event_type import AppointmentEventType
from app.schemas.invite import InviteCreate, InviteOut

router = APIRouter(prefix="/invites", tags=["convites"])

@router.post("", response_model=InviteOut, status_code=201)
def create_invite(
    payload: InviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist]))
):
    """
    Terapeuta envia convite para paciente
    """
    print("\n" + "="*70)
    print("📨 CRIANDO CONVITE")
    print(f"👤 Terapeuta ID: {current_user.id}")
    print(f"📦 Payload: {payload}")
    print("="*70)
    
    try:
        # Validar se o terapeuta é o mesmo do payload
        if payload.therapist_user_id != current_user.id:
            raise HTTPException(
                status_code=403, 
                detail="Você só pode criar convites como terapeuta logado"
            )
        
        # Validar se o paciente existe
        patient = db.execute(
            select(User).where(
                User.id == payload.patient_user_id,
                User.role == UserRole.patient,
                User.is_active == True
            )
        ).scalar_one_or_none()
        
        if not patient:
            raise HTTPException(
                status_code=404, 
                detail="Paciente não encontrado ou inativo"
            )
        
        # Buscar perfil do terapeuta para preço
        therapist_profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
        ).scalar_one_or_none()
        
        if not therapist_profile:
            raise HTTPException(
                status_code=400,
                detail="Perfil do terapeuta não encontrado"
            )
        
        # Calcular ends_at se não fornecido
        ends_at = payload.ends_at
        if not ends_at:
            ends_at = payload.starts_at + timedelta(minutes=payload.duration_minutes)
        
        # Verificar conflito de horários
        existing = db.execute(
            select(Appointment).where(
                Appointment.therapist_user_id == current_user.id,
                Appointment.starts_at < ends_at,
                Appointment.ends_at > payload.starts_at,
                Appointment.status.in_([
                    AppointmentStatus.scheduled,
                    AppointmentStatus.confirmed,
                    AppointmentStatus.proposed
                ])
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Já existe uma sessão neste horário"
            )
        
        # Criar appointment com status PROPOSED
        appointment = Appointment(
            therapist_user_id=current_user.id,
            patient_user_id=payload.patient_user_id,
            starts_at=payload.starts_at,
            ends_at=ends_at,
            status=AppointmentStatus.proposed,
            session_price=therapist_profile.session_price,
            duration_minutes=payload.duration_minutes or 50,
        )
        
        db.add(appointment)
        db.flush()
        
        # Registrar evento
        event = AppointmentEvent(
            appointment_id=appointment.id,
            actor_user_id=current_user.id,
            event_type=AppointmentEventType.created,
            old_status=None,
            new_status=appointment.status.value,
        )
        db.add(event)
        
        db.commit()
        db.refresh(appointment)
        
        print(f"✅ Convite criado com ID: {appointment.id}, Status: {appointment.status}")
        print("="*70 + "\n")
        
        # Buscar dados do paciente para retornar
        patient_profile = db.execute(
            select(PatientProfile).where(PatientProfile.user_id == payload.patient_user_id)
        ).scalar_one_or_none()
        
        return {
            "id": appointment.id,
            "patient_user_id": appointment.patient_user_id,
            "therapist_user_id": appointment.therapist_user_id,
            "starts_at": appointment.starts_at,
            "ends_at": appointment.ends_at,
            "duration_minutes": payload.duration_minutes,
            "status": appointment.status.value,
            "created_at": appointment.created_at,
            "patient_name": patient_profile.full_name if patient_profile and patient_profile.full_name else patient.full_name,
            "patient_email": patient.email,
            "patient_foto_url": patient_profile.foto_url if patient_profile else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro ao criar convite: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.get("/me", response_model=list[InviteOut])
def list_my_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista convites (para paciente ou terapeuta)
    """
    print(f"\n📋 Listando convites para usuário {current_user.id} ({current_user.role})")
    
    if current_user.role == UserRole.patient:
        # Paciente vê convites recebidos
        query = select(Appointment).where(
            Appointment.patient_user_id == current_user.id,
            Appointment.status == AppointmentStatus.proposed
        )
    else:
        # Terapeuta vê convites enviados
        query = select(Appointment).where(
            Appointment.therapist_user_id == current_user.id,
            Appointment.status == AppointmentStatus.proposed
        )
    
    invites = db.execute(
        query.order_by(Appointment.starts_at.asc())
    ).scalars().all()
    
    print(f"✅ Encontrados {len(invites)} convites")
    
    # Enriquecer com dados dos pacientes/terapeutas
    result = []
    for inv in invites:
        if current_user.role == UserRole.therapist:
            # Terapeuta vendo convites enviados → buscar dados do paciente
            patient = db.get(User, inv.patient_user_id)
            patient_profile = db.execute(
                select(PatientProfile).where(PatientProfile.user_id == inv.patient_user_id)
            ).scalar_one_or_none()
            
            result.append({
                "id": inv.id,
                "patient_user_id": inv.patient_user_id,
                "therapist_user_id": inv.therapist_user_id,
                "starts_at": inv.starts_at,
                "ends_at": inv.ends_at,
                "duration_minutes": int((inv.ends_at - inv.starts_at).total_seconds() / 60),
                "status": inv.status.value,
                "created_at": inv.created_at,
                "patient_name": patient_profile.full_name if patient_profile and patient_profile.full_name else (patient.full_name if patient else None),
                "patient_email": patient.email if patient else None,
                "patient_foto_url": patient_profile.foto_url if patient_profile else None
            })
        else:
            # PACIENTE vendo convites recebidos → buscar dados COMPLETOS do terapeuta
            therapist = db.get(User, inv.therapist_user_id)
            
            # Buscar também o perfil do terapeuta para especialidades, bio e foto
            therapist_profile = db.execute(
                select(TherapistProfile).where(TherapistProfile.user_id == inv.therapist_user_id)
            ).scalar_one_or_none()
            
            result.append({
                "id": inv.id,
                "patient_user_id": inv.patient_user_id,
                "therapist_user_id": inv.therapist_user_id,
                "starts_at": inv.starts_at,
                "ends_at": inv.ends_at,
                "duration_minutes": int((inv.ends_at - inv.starts_at).total_seconds() / 60),
                "status": inv.status.value,
                "created_at": inv.created_at,
                "therapist": {
                    "full_name": therapist_profile.full_name if therapist_profile and therapist_profile.full_name else (therapist.full_name if therapist else None),
                    "email": therapist.email if therapist else None,
                    "foto_url": therapist_profile.foto_url if therapist_profile else None,
                    "session_price": therapist_profile.session_price if therapist_profile else None
                }
            })
    
    print(f"📦 Retornando {len(result)} convites com dados completos")
    return result


@router.patch("/{invite_id}")
def update_invite_status(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza status do convite (aceitar/recusar)
    """
    print(f"\n🔄 Atualizando convite ID: {invite_id}")
    
    appointment = db.get(Appointment, invite_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Convite não encontrado")
    
    # Verificar permissão
    if current_user.role == UserRole.patient and appointment.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    if current_user.role == UserRole.therapist and appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Se for paciente, aceitar o convite
    if current_user.role == UserRole.patient and appointment.status == AppointmentStatus.proposed:
        appointment.status = AppointmentStatus.confirmed
        print(f"✅ Convite {invite_id} aceito pelo paciente")
        
        # 🔥 AGORA SIM, GERAR MEET APÓS CONFIRMAÇÃO
        from app.core.google_meet import google_meet_service
        try:
            meet_url = google_meet_service.create_meet_link(appointment)
            if meet_url:
                appointment.video_call_url = meet_url
                print(f"✅ Meet gerado após confirmação: {meet_url}")
        except Exception as e:
            print(f"⚠️ Erro ao gerar Meet: {e}")
    
    db.commit()
    db.refresh(appointment)
    
    return {"id": appointment.id, "status": appointment.status.value, "video_call_url": appointment.video_call_url}