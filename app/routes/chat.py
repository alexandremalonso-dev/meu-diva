from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, desc, func
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.appointment import Appointment
from app.models.chat_message import ChatMessage, ChatThread
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.schemas.chat import (
    ChatMessageCreate, ChatMessageOut,
    ChatConversationOut, CanChatResponse
)

router = APIRouter(prefix="/chat", tags=["chat"])


# ==========================
# HELPERS
# ==========================
def get_or_create_thread(therapist_user_id: int, patient_user_id: int, db: Session) -> ChatThread:
    therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == therapist_user_id).first()
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_user_id).first()
    if not therapist_profile or not patient_profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    thread = db.query(ChatThread).filter(
        ChatThread.patient_id == patient_profile.id,
        ChatThread.therapist_id == therapist_profile.id
    ).first()

    if not thread:
        thread = ChatThread(
            patient_id=patient_profile.id,
            therapist_id=therapist_profile.id,
            patient_user_id=patient_user_id,
            therapist_user_id=therapist_user_id
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
    return thread


def can_chat(patient_user_id: int, therapist_user_id: int, db: Session) -> tuple[bool, str]:
    appointment_exists = db.query(Appointment).filter(
        and_(
            Appointment.patient_user_id == patient_user_id,
            Appointment.therapist_user_id == therapist_user_id,
            Appointment.status.in_(['confirmed', 'completed', 'scheduled'])
        )
    ).first()
    if not appointment_exists:
        return False, "Nenhuma sessão encontrada. É necessário ter pelo menos uma sessão para conversar."

    therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == therapist_user_id).first()
    if therapist_profile:
        if hasattr(therapist_profile, 'blocked_patients') and therapist_profile.blocked_patients:
            if patient_user_id in therapist_profile.blocked_patients:
                return False, "Paciente bloqueado pelo terapeuta."
        if hasattr(therapist_profile, 'chat_enabled') and not therapist_profile.chat_enabled:
            return False, "Chat desativado pelo terapeuta."
    return True, "OK"


def _build_conversation(thread: ChatThread, current_user_id: int, other_user: User, db: Session) -> dict:
    """Monta o dict de conversa para qualquer tipo de thread."""
    foto_url = None
    if other_user.role == "therapist":
        p = db.query(TherapistProfile).filter(TherapistProfile.user_id == other_user.id).first()
        if p: foto_url = p.foto_url
    elif other_user.role == "patient":
        p = db.query(PatientProfile).filter(PatientProfile.user_id == other_user.id).first()
        if p: foto_url = p.foto_url
    elif other_user.role == "admin":
        # ✅ Busca foto do AdminProfile
        try:
            from app.models.admin_profile import AdminProfile
            p = db.query(AdminProfile).filter(AdminProfile.user_id == other_user.id).first()
            if p: foto_url = p.foto_url
        except Exception:
            pass

    last_msg = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread.id
    ).order_by(desc(ChatMessage.created_at)).first()

    unread = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread.id,
        ChatMessage.sender_id != current_user_id,
        ChatMessage.is_read == False
    ).count()

    role_label = {"therapist": "Terapeuta", "patient": "Paciente", "admin": "Administrador"}.get(other_user.role, other_user.role)

    return {
        "thread_id": thread.id,
        "appointment_id": None,
        "other_user_id": other_user.id,
        "other_user_name": other_user.full_name or other_user.email,
        "other_user_foto_url": foto_url,
        "other_user_role": role_label,
        "last_message": last_msg.message[:50] if last_msg else None,
        "last_message_at": last_msg.created_at if last_msg else None,
        "unread_count": unread,
    }


# ==========================
# GET CONVERSAS (paciente / terapeuta)
# ✅ Inclui threads com admin (patient_id = NULL)
# ==========================
@router.get("/conversations", response_model=List[ChatConversationOut])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist]))
):
    print(f"\n💬 GET /chat/conversations - Usuário: {current_user.id} ({current_user.role})")
    conversations = []
    seen_thread_ids = set()

    if current_user.role == UserRole.therapist:
        # 1. Threads normais terapeuta ↔ paciente (via appointments)
        appointments = db.query(Appointment).filter(
            and_(
                Appointment.therapist_user_id == current_user.id,
                Appointment.status.in_(['confirmed', 'completed', 'scheduled'])
            )
        ).distinct(Appointment.patient_user_id).all()

        seen_patients = set()
        for apt in appointments:
            if apt.patient_user_id in seen_patients:
                continue
            seen_patients.add(apt.patient_user_id)
            thread = get_or_create_thread(current_user.id, apt.patient_user_id, db)
            if thread.id in seen_thread_ids:
                continue
            seen_thread_ids.add(thread.id)
            patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == apt.patient_user_id).first()
            other_user = db.query(User).filter(User.id == apt.patient_user_id).first()
            if not other_user:
                continue

            last_msg = db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id).order_by(desc(ChatMessage.created_at)).first()
            unread = db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id, ChatMessage.sender_id == thread.patient_user_id, ChatMessage.is_read == False).count()

            conversations.append({
                "thread_id": thread.id,
                "appointment_id": apt.id,
                "other_user_id": apt.patient_user_id,
                "other_user_name": patient_profile.full_name if patient_profile else "Paciente",
                "other_user_foto_url": patient_profile.foto_url if patient_profile else None,
                "other_user_role": "Paciente",
                "last_message": last_msg.message[:50] if last_msg else None,
                "last_message_at": last_msg.created_at if last_msg else None,
                "unread_count": unread,
            })

        # ✅ 2. Threads com admin (patient_id = NULL, therapist_user_id = current_user.id)
        admin_threads = db.query(ChatThread).filter(
            or_(
                and_(ChatThread.therapist_user_id == current_user.id, ChatThread.patient_id == None),
                and_(ChatThread.patient_user_id == current_user.id, ChatThread.therapist_id == None),
            )
        ).all()

        for thread in admin_threads:
            if thread.id in seen_thread_ids:
                continue
            seen_thread_ids.add(thread.id)
            other_user_id = thread.patient_user_id if thread.therapist_user_id == current_user.id else thread.therapist_user_id
            other_user = db.query(User).filter(User.id == other_user_id).first()
            if not other_user or other_user.role != "admin":
                continue
            conversations.append(_build_conversation(thread, current_user.id, other_user, db))

    else:  # patient
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if not patient_profile:
            return []

        appointments = db.query(Appointment).filter(
            and_(
                Appointment.patient_user_id == current_user.id,
                Appointment.status.in_(['confirmed', 'completed', 'scheduled'])
            )
        ).distinct(Appointment.therapist_user_id).all()

        seen_therapists = set()
        for apt in appointments:
            if apt.therapist_user_id in seen_therapists:
                continue
            seen_therapists.add(apt.therapist_user_id)
            thread = get_or_create_thread(apt.therapist_user_id, current_user.id, db)
            if thread.id in seen_thread_ids:
                continue
            seen_thread_ids.add(thread.id)
            therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == apt.therapist_user_id).first()

            last_msg = db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id).order_by(desc(ChatMessage.created_at)).first()
            unread = db.query(ChatMessage).filter(ChatMessage.thread_id == thread.id, ChatMessage.sender_id == thread.therapist_user_id, ChatMessage.is_read == False).count()

            conversations.append({
                "thread_id": thread.id,
                "appointment_id": apt.id,
                "other_user_id": apt.therapist_user_id,
                "other_user_name": therapist_profile.full_name if therapist_profile else "Terapeuta",
                "other_user_foto_url": therapist_profile.foto_url if therapist_profile else None,
                "other_user_role": "Terapeuta",
                "last_message": last_msg.message[:50] if last_msg else None,
                "last_message_at": last_msg.created_at if last_msg else None,
                "unread_count": unread,
            })

        # ✅ 2. Threads com admin
        admin_threads = db.query(ChatThread).filter(
            or_(
                and_(ChatThread.patient_user_id == current_user.id, ChatThread.therapist_id == None),
                and_(ChatThread.therapist_user_id == current_user.id, ChatThread.patient_id == None),
            )
        ).all()

        for thread in admin_threads:
            if thread.id in seen_thread_ids:
                continue
            seen_thread_ids.add(thread.id)
            other_user_id = thread.therapist_user_id if thread.patient_user_id == current_user.id else thread.patient_user_id
            other_user = db.query(User).filter(User.id == other_user_id).first()
            if not other_user or other_user.role != "admin":
                continue
            conversations.append(_build_conversation(thread, current_user.id, other_user, db))

    conversations.sort(key=lambda x: x["last_message_at"] or datetime.min, reverse=True)
    print(f"✅ {len(conversations)} conversa(s) retornada(s)")
    return conversations


# ==========================
# GET MENSAGENS
# ==========================
@router.get("/messages/{thread_id}", response_model=List[ChatMessageOut])
def get_messages(
    thread_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    if current_user.id not in [thread.patient_user_id, thread.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    messages = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread_id
    ).order_by(ChatMessage.created_at.desc()).offset(offset).limit(limit).all()

    unread = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread_id,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read == False
    ).all()
    for msg in unread:
        msg.is_read = True
        msg.read_at = datetime.now()
    db.commit()

    return messages[::-1]


# ==========================
# ENVIAR MENSAGEM
# ==========================
@router.post("/messages", response_model=ChatMessageOut)
def send_message(
    message_data: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    thread = db.query(ChatThread).filter(ChatThread.id == message_data.thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    if current_user.id not in [thread.patient_user_id, thread.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Admin bypassa can_chat
    # Threads admin têm patient_id = NULL — terapeuta/paciente também bypassa can_chat nesse caso
    is_admin_thread = thread.patient_id is None and thread.therapist_id is None
    if current_user.role != UserRole.admin and not is_admin_thread:
        if current_user.role == UserRole.therapist:
            can, reason = can_chat(thread.patient_user_id, current_user.id, db)
        else:
            can, reason = can_chat(current_user.id, thread.therapist_user_id, db)
        if not can:
            raise HTTPException(status_code=403, detail=reason)

    new_message = ChatMessage(
        thread_id=message_data.thread_id,
        sender_id=current_user.id,
        message=message_data.message
    )
    db.add(new_message)
    thread.last_message_at = datetime.now()
    thread.updated_at = datetime.now()
    db.commit()
    db.refresh(new_message)
    return new_message


# ==========================
# MARCAR COMO LIDA
# ==========================
@router.patch("/messages/{message_id}/read")
def mark_as_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist, UserRole.admin]))
):
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    thread = db.query(ChatThread).filter(ChatThread.id == message.thread_id).first()
    if not thread or current_user.id not in [thread.patient_user_id, thread.therapist_user_id]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if message.sender_id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível marcar sua própria mensagem como lida")
    message.is_read = True
    message.read_at = datetime.now()
    db.commit()
    return {"success": True}


# ==========================
# ✅ ADMIN: LISTAR CONVERSAS DO ADMIN
# ==========================
@router.get("/admin/conversations", response_model=List[ChatConversationOut])
def get_admin_conversations(
    role_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    threads = db.query(ChatThread).filter(
        or_(
            ChatThread.patient_user_id == current_user.id,
            ChatThread.therapist_user_id == current_user.id
        )
    ).order_by(desc(ChatThread.last_message_at)).all()

    conversations = []
    seen_thread_ids = set()

    for thread in threads:
        if thread.id in seen_thread_ids:
            continue
        seen_thread_ids.add(thread.id)

        other_user_id = (
            thread.therapist_user_id
            if thread.patient_user_id == current_user.id
            else thread.patient_user_id
        )
        other_user = db.query(User).filter(User.id == other_user_id).first()
        if not other_user:
            continue
        if role_filter and other_user.role != role_filter:
            continue
        if search:
            name = (other_user.full_name or other_user.email or "").lower()
            if search.lower() not in name:
                continue

        conversations.append(_build_conversation(thread, current_user.id, other_user, db))

    conversations.sort(key=lambda x: x["last_message_at"] or datetime.min, reverse=True)
    return conversations


# ==========================
# ✅ ADMIN: INICIAR/ACESSAR CONVERSA — thread única, sem espelho
# ==========================
@router.post("/admin/thread/{target_user_id}")
def admin_get_or_create_thread(
    target_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # ✅ Busca thread única em qualquer direção
    thread = db.query(ChatThread).filter(
        or_(
            and_(
                ChatThread.patient_user_id == current_user.id,
                ChatThread.therapist_user_id == target_user_id
            ),
            and_(
                ChatThread.patient_user_id == target_user_id,
                ChatThread.therapist_user_id == current_user.id
            )
        )
    ).first()

    if not thread:
        # ✅ Uma única thread — admin como patient_user_id, target como therapist_user_id
        # O target verá essa mesma thread quando buscar conversas com admin
        thread = ChatThread(
            patient_id=None,
            therapist_id=None,
            patient_user_id=current_user.id,
            therapist_user_id=target_user_id
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
        print(f"✅ Thread única criada: ID {thread.id} (admin {current_user.id} ↔ user {target_user_id})")

    foto_url = None
    if target.role == "therapist":
        p = db.query(TherapistProfile).filter(TherapistProfile.user_id == target_user_id).first()
        if p: foto_url = p.foto_url
    elif target.role == "patient":
        p = db.query(PatientProfile).filter(PatientProfile.user_id == target_user_id).first()
        if p: foto_url = p.foto_url

    return {
        "thread_id": thread.id,
        "other_user_id": target_user_id,
        "other_user_name": target.full_name or target.email,
        "other_user_foto_url": foto_url,
        "other_user_role": "Terapeuta" if target.role == "therapist" else "Paciente",
    }


# ==========================
# ADMIN: LISTAR USUÁRIOS PARA CHAT
# ==========================
@router.get("/admin/users")
def admin_list_users_for_chat(
    role_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.admin]))
):
    query = db.query(User).filter(User.id != current_user.id, User.role.in_(["therapist", "patient"]))
    if role_filter:
        query = query.filter(User.role == role_filter)
    if search:
        termo = f"%{search}%"
        query = query.filter(or_(User.full_name.ilike(termo), User.email.ilike(termo)))

    users = query.order_by(User.full_name).limit(limit).all()
    result = []
    for u in users:
        foto_url = None
        if u.role == "therapist":
            p = db.query(TherapistProfile).filter(TherapistProfile.user_id == u.id).first()
            if p: foto_url = p.foto_url
        elif u.role == "patient":
            p = db.query(PatientProfile).filter(PatientProfile.user_id == u.id).first()
            if p: foto_url = p.foto_url
        result.append({"id": u.id, "full_name": u.full_name or u.email, "email": u.email, "role": u.role, "foto_url": foto_url, "is_active": u.is_active, "created_at": u.created_at})
    return result


# ==========================
# VERIFICAR SE PODE CHAT
# ==========================
@router.get("/can-chat/{other_user_id}", response_model=CanChatResponse)
def check_can_chat(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.patient, UserRole.therapist]))
):
    if current_user.role == UserRole.therapist:
        can, reason = can_chat(other_user_id, current_user.id, db)
    else:
        can, reason = can_chat(current_user.id, other_user_id, db)
    return CanChatResponse(can_chat=can, reason=reason if not can else None)