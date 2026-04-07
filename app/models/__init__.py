# Import all models so SQLAlchemy can discover them
from app.models.user import User
from app.models.invite import Invite
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.appointment import Appointment
from app.models.appointment_event import AppointmentEvent
from app.models.patient_profile import PatientProfile
from app.models.patient_address import PatientAddress
from app.models.patient_goal import PatientGoal
from app.models.goal_types import GoalType
from app.models.patient_security import PatientSecurity
from app.models.patient_billing import PatientBilling
from app.models.patient_subscription import PatientSubscription
from app.models.medical_record import MedicalRecord
from app.models.therapist_address import TherapistAddress
from app.models.therapist_document import TherapistDocument
from app.models.therapist_validation import TherapistValidation

# 🔥 NOVOS MODELOS - ASSINATURA E COMISSÃO
from app.models.subscription import Subscription
from app.models.commission import Commission

# 🔥 NOVOS MODELOS - NOTIFICAÇÕES E PLANOS
from app.models.notification import Notification
from app.models.plan_price import PlanPrice
from app.models.user_permissions import UserPermission
from app.models.plan_features_config import PlanFeaturesConfig