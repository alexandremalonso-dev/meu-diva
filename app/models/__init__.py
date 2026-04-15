# app/models/__init__.py

# Import all models so SQLAlchemy can discover them

# ==========================
# MODELOS BASE (USUÁRIOS E PERFIS)
# ==========================
from app.models.user import User
from app.models.invite import Invite
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.patient_profile import PatientProfile
from app.models.patient_address import PatientAddress
from app.models.patient_goal import PatientGoal
from app.models.goal_types import GoalType
from app.models.patient_security import PatientSecurity
from app.models.patient_billing import PatientBilling
from app.models.patient_subscription import PatientSubscription

# ==========================
# MODELOS DE AGENDAMENTO E PRONTUÁRIO
# ==========================
from app.models.appointment import Appointment
from app.models.appointment_event import AppointmentEvent
from app.models.medical_record import MedicalRecord

# ==========================
# MODELOS DO TERAPEUTA (ENDERECO, DOCUMENTOS, VALIDAÇÃO)
# ==========================
from app.models.therapist_address import TherapistAddress
from app.models.therapist_document import TherapistDocument
from app.models.therapist_validation import TherapistValidation

# ==========================
# 🔥 MODELOS FINANCEIROS (INVOICES E PAYMENTS)
# ==========================
from app.models.therapist_invoice import TherapistInvoice, InvoiceStatus
from app.models.therapist_payment import TherapistPayment, PaymentStatus

# ==========================
# 🔥 MODELOS DE ASSINATURA E COMISSÃO
# ==========================
from app.models.subscription import Subscription
from app.models.commission import Commission

# ==========================
# 🔥 MODELOS DE NOTIFICAÇÕES, PLANOS E PERMISSÕES
# ==========================
from app.models.notification import Notification
from app.models.plan_price import PlanPrice
from app.models.user_permissions import UserPermission
from app.models.plan_features_config import PlanFeaturesConfig

# ==========================
# 🔥 MODELOS EMPRESARIAIS (EMPRESA, PLANOS, DOCUMENTOS, ENDEREÇOS)
# ==========================
from app.models.empresa_plano import EmpresaPlano
from app.models.empresa_documento import EmpresaDocumento
from app.models.empresa_endereco import EmpresaEndereco
from app.models.empresa_profile import EmpresaProfile