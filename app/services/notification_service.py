from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.models.notification import Notification
from app.models.user import User
from app.services.email_service import email_service

class NotificationService:
    """Serviço para gerenciar notificações do dashboard e e-mails"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_notification(
        self,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        action_link: Optional[str] = None
    ) -> Notification:
        """Cria uma notificação no dashboard"""
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data=data,
            action_link=action_link,
            is_read=False,
            created_at=datetime.utcnow()
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification
    
    def get_user_notifications(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False
    ) -> List[Notification]:
        """Retorna as notificações do usuário"""
        query = self.db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read == False)
        return query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    def get_unread_count(self, user_id: int) -> int:
        """Retorna o número de notificações não lidas"""
        return self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()
    
    def mark_as_read(self, notification_id: int, user_id: int) -> bool:
        """Marca uma notificação como lida"""
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        if notification:
            notification.is_read = True
            self.db.commit()
            return True
        return False
    
    def mark_all_as_read(self, user_id: int) -> int:
        """Marca todas as notificações do usuário como lidas"""
        result = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True})
        self.db.commit()
        return result
    
    def delete_notification(self, notification_id: int, user_id: int) -> bool:
        """Deleta uma notificação"""
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        if notification:
            self.db.delete(notification)
            self.db.commit()
            return True
        return False
    
    def should_send_email(self, user: User, event_type: str) -> bool:
        """Verifica se deve enviar e-mail para o usuário"""
        if not user.email_notifications_enabled:
            return False
        if not user.email_preferences:
            return True
        return user.email_preferences.get(event_type, True)
    
    def notify_appointment_created(self, appointment, patient_user, therapist_user):
        """Notifica sobre nova sessão criada (terapeuta convida paciente)"""
        self.create_notification(
            user_id=patient_user.id,
            notification_type="appointment_created",
            title="Novo convite de sessão",
            message=f"O terapeuta {therapist_user.full_name} te convidou para uma sessão em {appointment.starts_at.strftime('%d/%m/%Y às %H:%M')}",
            data={"appointment_id": appointment.id, "therapist_name": therapist_user.full_name},
            action_link="/patient/invites"
        )
        
        if self.should_send_email(patient_user, "invite_received"):
            email_service.send_invite_email(
                appointment,
                patient_user.email,
                patient_user.full_name or "Paciente",
                therapist_user.full_name or "Terapeuta"
            )
    
    def notify_appointment_confirmed(self, appointment, patient_user, therapist_user, meet_url: Optional[str] = None):
        """Notifica sobre confirmação de sessão"""
        self.create_notification(
            user_id=patient_user.id,
            notification_type="appointment_confirmed",
            title="Sessão agendada",
            message=f"Sua sessão com {therapist_user.full_name} foi confirmada para {appointment.starts_at.strftime('%d/%m/%Y às %H:%M')}",
            data={"appointment_id": appointment.id, "therapist_name": therapist_user.full_name, "meet_url": meet_url},
            action_link="/patient/schedule"
        )
        
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="appointment_confirmed",
            title="Sessão agendada",
            message=f"{patient_user.full_name} agendou uma nova sessão para {appointment.starts_at.strftime('%d/%m/%Y às %H:%M')}",
            data={"appointment_id": appointment.id, "patient_name": patient_user.full_name, "meet_url": meet_url},
            action_link="/therapist/schedule"
        )
        
        if self.should_send_email(patient_user, "appointment_confirmed"):
            email_service.send_appointment_confirmation(
                appointment, patient_user.email, therapist_user.email, meet_url
            )
    
    def notify_appointment_cancelled(self, appointment, patient_user, therapist_user, cancelled_by: str):
        """Notifica sobre cancelamento de sessão"""
        self.create_notification(
            user_id=patient_user.id,
            notification_type="appointment_cancelled",
            title="Sessão cancelada",
            message=f"Sua sessão com {therapist_user.full_name} do dia {appointment.starts_at.strftime('%d/%m/%Y')} foi cancelada",
            data={"appointment_id": appointment.id, "cancelled_by": cancelled_by},
            action_link="/patient/schedule"
        )
        
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="appointment_cancelled",
            title="Sessão cancelada",
            message=f"Sessão com {patient_user.full_name} do dia {appointment.starts_at.strftime('%d/%m/%Y')} foi cancelada",
            data={"appointment_id": appointment.id, "cancelled_by": cancelled_by},
            action_link="/therapist/schedule"
        )
        
        if self.should_send_email(patient_user, "appointment_cancelled"):
            email_service.send_appointment_cancelled(appointment, patient_user.email, therapist_user.email)
    
    def notify_appointment_rescheduled(self, appointment, patient_user, therapist_user, meet_url: Optional[str] = None):
        """Notifica sobre reagendamento de sessão"""
        self.create_notification(
            user_id=patient_user.id,
            notification_type="appointment_rescheduled",
            title="Sessão reagendada",
            message=f"Sua sessão com {therapist_user.full_name} foi reagendada para {appointment.starts_at.strftime('%d/%m/%Y às %H:%M')}",
            data={"appointment_id": appointment.id, "therapist_name": therapist_user.full_name, "meet_url": meet_url},
            action_link="/patient/schedule"
        )
        
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="appointment_rescheduled",
            title="Sessão reagendada",
            message=f"Sessão com {patient_user.full_name} foi reagendada para {appointment.starts_at.strftime('%d/%m/%Y às %H:%M')}",
            data={"appointment_id": appointment.id, "patient_name": patient_user.full_name, "meet_url": meet_url},
            action_link="/therapist/schedule"
        )
        
        if self.should_send_email(patient_user, "appointment_rescheduled"):
            email_service.send_appointment_rescheduled(appointment, patient_user.email, therapist_user.email, meet_url)
    
    def notify_subscription_activated(self, therapist_user, plan_name: str):
        """Notifica terapeuta sobre ativação de assinatura"""
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="subscription_activated",
            title="Assinatura ativada",
            message=f"Seu plano {plan_name} foi ativado com sucesso. Agora você tem acesso a todos os benefícios.",
            data={"plan": plan_name},
            action_link="/therapist/subscription"
        )
    
    def notify_subscription_cancelled(self, therapist_user, plan_name: str):
        """Notifica terapeuta sobre cancelamento de assinatura"""
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="subscription_cancelled",
            title="Assinatura cancelada",
            message=f"Seu plano {plan_name} foi cancelado. Você voltou para o plano Essencial.",
            data={"plan": plan_name},
            action_link="/therapist/subscription"
        )
    
    def notify_subscription_expiring(self, therapist_user, plan_name: str, days_remaining: int):
        """Notifica terapeuta sobre assinatura prestes a vencer"""
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="subscription_expiring",
            title="Assinatura vai expirar",
            message=f"Seu plano {plan_name} vai expirar em {days_remaining} dias. Renove para manter os benefícios.",
            data={"plan": plan_name, "days_remaining": days_remaining},
            action_link="/therapist/subscription"
        )
    
    def notify_receipt_available(self, patient_user, appointment, therapist_name: str, amount: float):
        """Notifica paciente que o recibo está disponível"""
        self.create_notification(
            user_id=patient_user.id,
            notification_type="receipt_available",
            title="Recibo disponível",
            message=f"O recibo da sessão com {therapist_name} realizada em {appointment.starts_at.strftime('%d/%m/%Y')} já está disponível para download.",
            data={"appointment_id": appointment.id, "therapist_name": therapist_name, "amount": amount},
            action_link=f"/patient/sessions/{appointment.id}"
        )
    
    def notify_new_chat_message(self, user_id: int, sender_name: str, thread_id: int, message_preview: str):
        """Notifica sobre nova mensagem no chat (para o destinatário)"""
        self.create_notification(
            user_id=user_id,
            notification_type="new_chat_message",
            title="Nova mensagem",
            message=f"{sender_name} enviou uma nova mensagem: {message_preview[:50]}...",
            data={"thread_id": thread_id, "sender_name": sender_name},
            action_link="/chat"
        )
    
    def notify_payment_received(self, user_id: int, user_email: str, user_name: str, therapist_name: str, amount: float, session_date: str):
        """Notifica sobre pagamento recebido"""
        self.create_notification(
            user_id=user_id,
            notification_type="payment_received",
            title="Pagamento confirmado",
            message=f"Seu pagamento de R$ {amount:.2f} para sessão com {therapist_name} foi confirmado",
            data={"amount": amount, "therapist_name": therapist_name, "session_date": session_date},
            action_link="/patient/wallet"
        )
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if user and self.should_send_email(user, "payment_received"):
            email_service.send_payment_confirmation(user_email, user_name, therapist_name, amount, session_date)
    
    def notify_pending_medical_record(self, appointment, therapist_user, patient_user):
        """Notifica o terapeuta sobre prontuário pendente (não finalizado após a sessão)"""
        self.create_notification(
            user_id=therapist_user.id,
            notification_type="medical_record_pending",
            title="Prontuário pendente",
            message=f"Você ainda não finalizou o prontuário da sessão com {patient_user.full_name} realizada em {appointment.starts_at.strftime('%d/%m/%Y às %H:%M')}",
            data={"appointment_id": appointment.id, "patient_name": patient_user.full_name},
            action_link=f"/therapist/sessions/{appointment.id}"
        )