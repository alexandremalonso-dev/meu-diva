# Import all models so SQLAlchemy can discover them
from app.models.user import User
from app.models.invite import Invite  # 🔥 ADICIONAR ESTA LINHA
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