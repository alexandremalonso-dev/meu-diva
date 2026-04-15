from enum import Enum

class UserRole(str, Enum):
    patient = "patient"
    therapist = "therapist"
    company_admin = "company_admin"
    admin = "admin"
    empresa = "empresa"