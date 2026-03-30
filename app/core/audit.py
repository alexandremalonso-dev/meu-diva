from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
import json
from typing import Optional, Any
from decimal import Decimal

from app.models.audit_log import AuditLog, AuditActionType
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.appointment import Appointment

class AuditService:
    """Serviço para registrar ações de auditoria"""
    
    def __init__(self, db: Session, current_user: User, request=None):
        self.db = db
        self.current_user = current_user
        self.ip_address = request.client.host if request else None
        self.user_agent = request.headers.get("user-agent") if request else None
    
    def _serialize_value(self, value: Any) -> str:
        """Serializa valores para armazenar como texto"""
        if value is None:
            return None
        # 🔥 CONVERTER Decimal para float
        if isinstance(value, Decimal):
            return str(float(value))
        if isinstance(value, (int, float, str, bool)):
            return str(value)
        if hasattr(value, 'value'):  # Para enums
            return value.value
        if isinstance(value, dict):
            # 🔥 CONVERTER Decimal em dicionários
            def convert_decimals(obj):
                if isinstance(obj, Decimal):
                    return float(obj)
                elif isinstance(obj, dict):
                    return {k: convert_decimals(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_decimals(v) for v in obj]
                return obj
            return json.dumps(convert_decimals(value), default=str)
        if hasattr(value, '__dict__'):
            # Para objetos SQLAlchemy, extrair apenas atributos relevantes
            data = {k: v for k, v in value.__dict__.items() if not k.startswith('_')}
            # 🔥 CONVERTER Decimal nos dados
            def convert_decimals(obj):
                if isinstance(obj, Decimal):
                    return float(obj)
                elif isinstance(obj, dict):
                    return {k: convert_decimals(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_decimals(v) for v in obj]
                return obj
            return json.dumps(convert_decimals(data), default=str)
        return str(value)
    
    def log_price_change(
        self,
        therapist_profile: TherapistProfile,
        old_price: float,
        new_price: float,
        appointment: Optional[Appointment] = None
    ):
        """Registra alteração de preço"""
        
        # Buscar perfil do paciente se houver appointment
        patient_profile_id = None
        if appointment:
            patient = self.db.execute(
                select(PatientProfile).where(PatientProfile.user_id == appointment.patient_user_id)
            ).scalar_one_or_none()
            if patient:
                patient_profile_id = patient.id
        
        log = AuditLog(
            user_id=self.current_user.id,
            user_role=self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role,
            action_type=AuditActionType.PRICE_CHANGE.value,
            old_value=self._serialize_value(old_price),
            new_value=self._serialize_value(new_price),
            therapist_profile_id=therapist_profile.id,
            patient_profile_id=patient_profile_id,
            appointment_id=appointment.id if appointment else None,
            description=f"Preço da sessão alterado de R$ {old_price} para R$ {new_price}",
            ip_address=self.ip_address,
            user_agent=self.user_agent
        )
        
        self.db.add(log)
        self.db.commit()
        print(f"📝 Auditoria: Alteração de preço registrada")
    
    def log_insufficient_balance(
        self,
        patient_profile: PatientProfile,
        therapist_profile: TherapistProfile,
        required_amount: float,
        current_balance: float,
        appointment_data: dict = None
    ):
        """Registra tentativa de agendamento com saldo insuficiente"""
        
        log = AuditLog(
            user_id=self.current_user.id,
            user_role=self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role,
            action_type=AuditActionType.INSUFFICIENT_BALANCE_ATTEMPT.value,
            old_value=self._serialize_value(current_balance),
            new_value=self._serialize_value(required_amount),
            patient_profile_id=patient_profile.id,
            therapist_profile_id=therapist_profile.id,
            extra_data=appointment_data,
            description=f"Tentativa de agendamento com saldo insuficiente: necessário R$ {required_amount}, disponível R$ {current_balance}",
            ip_address=self.ip_address,
            user_agent=self.user_agent
        )
        
        self.db.add(log)
        self.db.commit()
        print(f"📝 Auditoria: Tentativa com saldo insuficiente registrada")
    
    # 🔥 FUNÇÃO CORRIGIDA - CONVERTE Decimal para float
    def log_session_debit(
        self,
        appointment: Appointment,
        wallet,
        old_balance: float,
        new_balance: float,
        price: float
    ):
        """Registra débito de sessão"""
        
        # 🔥 CONVERTER Decimal para float se necessário
        def to_float(value):
            if isinstance(value, Decimal):
                return float(value)
            return value
        
        old_balance_float = to_float(old_balance)
        new_balance_float = to_float(new_balance)
        price_float = to_float(price)
        
        # Buscar perfis
        patient = self.db.execute(
            select(PatientProfile).where(PatientProfile.user_id == appointment.patient_user_id)
        ).scalar_one_or_none()
        
        therapist = self.db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == appointment.therapist_user_id)
        ).scalar_one_or_none()
        
        # 🔥 EXTRA_DATA COM VALORES CONVERTIDOS
        extra_data = {
            "session_price": price_float,
            "old_balance": old_balance_float,
            "new_balance": new_balance_float
        }
        
        log = AuditLog(
            user_id=self.current_user.id,
            user_role=self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role,
            action_type=AuditActionType.SESSION_DEBIT.value,
            old_value=self._serialize_value(old_balance_float),
            new_value=self._serialize_value(new_balance_float),
            appointment_id=appointment.id,
            patient_profile_id=patient.id if patient else None,
            therapist_profile_id=therapist.id if therapist else None,
            extra_data=extra_data,
            description=f"Débito de R$ {price_float} pela sessão {appointment.id}. Saldo: {old_balance_float} → {new_balance_float}",
            ip_address=self.ip_address,
            user_agent=self.user_agent
        )
        
        self.db.add(log)
        self.db.commit()
        print(f"📝 Auditoria: Débito de sessão registrado")
    
    def log_appointment_blocked(
        self,
        therapist_profile: TherapistProfile,
        reason: str,
        appointment_data: dict
    ):
        """Registra bloqueio de agendamento (ex: sem preço definido)"""
        
        log = AuditLog(
            user_id=self.current_user.id,
            user_role=self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role,
            action_type=AuditActionType.APPOINTMENT_BLOCKED.value,
            therapist_profile_id=therapist_profile.id,
            extra_data=appointment_data,
            description=f"Agendamento bloqueado: {reason}",
            ip_address=self.ip_address,
            user_agent=self.user_agent
        )
        
        self.db.add(log)
        self.db.commit()
        print(f"📝 Auditoria: Bloqueio de agendamento registrado")
    
    # 🔥 FUNÇÃO CORRIGIDA - CONVERTE Decimal para float
    def log_session_refund(
        self,
        appointment: Appointment,
        wallet,
        old_balance: float,
        new_balance: float,
        amount: float,
        reason: str
    ):
        """Registra estorno de sessão"""
        
        # 🔥 CONVERTER Decimal para float se necessário
        def to_float(value):
            if isinstance(value, Decimal):
                return float(value)
            return value
        
        old_balance_float = to_float(old_balance)
        new_balance_float = to_float(new_balance)
        amount_float = to_float(amount)
        
        # Buscar perfis
        patient = self.db.execute(
            select(PatientProfile).where(PatientProfile.user_id == appointment.patient_user_id)
        ).scalar_one_or_none()
        
        therapist = self.db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == appointment.therapist_user_id)
        ).scalar_one_or_none()
        
        # 🔥 EXTRA_DATA COM VALORES CONVERTIDOS
        extra_data = {
            "refund_amount": amount_float,
            "reason": reason,
            "old_balance": old_balance_float,
            "new_balance": new_balance_float
        }
        
        log = AuditLog(
            user_id=self.current_user.id,
            user_role=self.current_user.role.value if hasattr(self.current_user.role, 'value') else self.current_user.role,
            action_type=AuditActionType.SESSION_REFUND.value,
            old_value=self._serialize_value(old_balance_float),
            new_value=self._serialize_value(new_balance_float),
            appointment_id=appointment.id,
            patient_profile_id=patient.id if patient else None,
            therapist_profile_id=therapist.id if therapist else None,
            extra_data=extra_data,
            description=f"Estorno de R$ {amount_float} pela sessão {appointment.id}. Motivo: {reason}. Saldo: {old_balance_float} → {new_balance_float}",
            ip_address=self.ip_address,
            user_agent=self.user_agent
        )
        
        self.db.add(log)
        self.db.commit()
        print(f"📝 Auditoria: Estorno de sessão registrado")


# Função auxiliar para obter o serviço de auditoria
def get_audit_service(db: Session, current_user: User, request=None):
    return AuditService(db, current_user, request)