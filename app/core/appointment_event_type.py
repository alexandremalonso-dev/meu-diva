from enum import Enum


class AppointmentEventType(str, Enum):
    created = "created"
    status_changed = "status_changed"
    rescheduled = "rescheduled"