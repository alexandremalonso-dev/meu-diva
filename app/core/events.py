from enum import Enum
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel


class EventType(str, Enum):
    """Tipos de eventos que podem ser emitidos"""
    
    # Sessões / Appointments
    APPOINTMENT_CREATED = "appointment.created"
    APPOINTMENT_UPDATED = "appointment.updated"
    APPOINTMENT_CANCELLED = "appointment.cancelled"
    APPOINTMENT_RESCHEDULED = "appointment.rescheduled"
    APPOINTMENT_COMPLETED = "appointment.completed"
    APPOINTMENT_CONFIRMED = "appointment.confirmed"
    
    # Prontuários
    MEDICAL_RECORD_CREATED = "medical_record.created"
    MEDICAL_RECORD_UPDATED = "medical_record.updated"
    COMPLAINT_CREATED = "complaint.created"
    
    # Convites
    INVITE_CREATED = "invite.created"
    INVITE_ACCEPTED = "invite.accepted"
    INVITE_DECLINED = "invite.declined"
    
    # Pagamentos e Wallet
    PAYMENT_CONFIRMED = "payment.confirmed"
    WALLET_UPDATED = "wallet.updated"
    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_CANCELLED = "subscription.cancelled"
    SUBSCRIPTION_UPDATED = "subscription.updated"
    
    # Documentos e Validação
    DOCUMENT_UPLOADED = "document.uploaded"
    DOCUMENT_VALIDATED = "document.validated"
    THERAPIST_VALIDATED = "therapist.validated"
    
    # Perfil
    PROFILE_UPDATED = "profile.updated"
    AVAILABILITY_UPDATED = "availability.updated"
    PRICE_UPDATED = "price.updated"
    
    # Chat
    CHAT_MESSAGE = "chat.message"
    CHAT_READ = "chat.read"
    
    # Notificações
    NOTIFICATION_CREATED = "notification.created"


class WebSocketEvent(BaseModel):
    """Estrutura do evento WebSocket"""
    type: EventType
    payload: dict
    target_user_ids: Optional[list[int]] = None  # Se None, envia para todos conectados
    target_roles: Optional[list[str]] = None     # Ex: ["admin", "therapist"]
    timestamp: datetime = datetime.now()
    
    def dict(self):
        return {
            "type": self.type.value,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat()
        }


# Mapeamento de ações para eventos
ACTION_EVENT_MAP = {
    # Appointments
    "appointment_created": EventType.APPOINTMENT_CREATED,
    "appointment_confirmed": EventType.APPOINTMENT_CONFIRMED,
    "appointment_cancelled": EventType.APPOINTMENT_CANCELLED,
    "appointment_rescheduled": EventType.APPOINTMENT_RESCHEDULED,
    "appointment_completed": EventType.APPOINTMENT_COMPLETED,
    
    # Medical Records
    "medical_record_completed": EventType.MEDICAL_RECORD_CREATED,
    "complaint_saved": EventType.COMPLAINT_CREATED,
    
    # Invites
    "invite_created": EventType.INVITE_CREATED,
    "invite_accepted": EventType.INVITE_ACCEPTED,
    "invite_declined": EventType.INVITE_DECLINED,
    
    # Payments
    "payment_confirmed": EventType.PAYMENT_CONFIRMED,
    "wallet_updated": EventType.WALLET_UPDATED,
    
    # Subscriptions
    "subscription_created": EventType.SUBSCRIPTION_CREATED,
    "subscription_cancelled": EventType.SUBSCRIPTION_CANCELLED,
    
    # Documents
    "document_uploaded": EventType.DOCUMENT_UPLOADED,
    "document_validated": EventType.DOCUMENT_VALIDATED,
    
    # Profile
    "profile_updated": EventType.PROFILE_UPDATED,
    "availability_updated": EventType.AVAILABILITY_UPDATED,
    "price_updated": EventType.PRICE_UPDATED,
    
    # Chat
    "chat_message": EventType.CHAT_MESSAGE,
    
    # Notifications
    "notification_created": EventType.NOTIFICATION_CREATED,
}


def create_event(event_type: EventType, payload: dict, target_user_ids: list[int] = None, target_roles: list[str] = None) -> WebSocketEvent:
    """Cria um evento WebSocket"""
    return WebSocketEvent(
        type=event_type,
        payload=payload,
        target_user_ids=target_user_ids,
        target_roles=target_roles
    )