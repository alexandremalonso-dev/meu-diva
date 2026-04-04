from enum import Enum

class AppointmentStatus(str, Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    cancelled_by_patient = "cancelled_by_patient"
    cancelled_by_therapist = "cancelled_by_therapist"
    cancelled_by_admin = "cancelled_by_admin"
    proposed = "proposed"
    completed = "completed"
    no_show = "no_show"
    rescheduled = "rescheduled"
    declined = "declined"  # 🔥 NOVO: convite recusado pelo paciente