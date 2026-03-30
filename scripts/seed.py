import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal

from app.models.user import User
from app.models.therapist import TherapistProfile
from app.models.therapist import TherapistAvailability
from app.models.appointment import Appointment, AppointmentStatus

from app.core.security import get_password_hash
from app.core.roles import UserRole


def create_user_if_not_exists(db: Session, email: str, password: str, role: UserRole):

    existing = db.query(User).filter(User.email == email).first()

    if existing:
        print(f"Usuário {email} já existe.")
        return existing

    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    print(f"Usuário {email} criado com sucesso.")
    return user


def create_therapist_profile_if_not_exists(db: Session, therapist_id: int):

    existing = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == therapist_id
    ).first()

    if existing:
        print("Perfil do terapeuta já existe.")
        return existing

    profile = TherapistProfile(
        user_id=therapist_id,
        bio="Psicanalista clínico",
        session_price=150
    )

    db.add(profile)
    db.commit()
    print("Perfil do terapeuta criado.")
    return profile


def create_availability_if_not_exists(db: Session, therapist_id: int):

    existing = db.query(TherapistAvailability).filter(
        TherapistAvailability.therapist_user_id == therapist_id
    ).first()

    if existing:
        print("Disponibilidade já existe.")
        return

    availability = TherapistAvailability(
        therapist_user_id=therapist_id,
        weekday=1,
        start_time="09:00",
        end_time="17:00"
    )

    db.add(availability)
    db.commit()

    print("Disponibilidade criada.")


def create_test_appointments(db: Session, therapist_id: int, patient_id: int):

    existing = db.query(Appointment).first()

    if existing:
        print("Sessões já existem.")
        return

    print("Criando sessões de teste...")

    for i in range(5):

        appointment = Appointment(
            therapist_user_id=therapist_id,
            patient_user_id=patient_id,
            scheduled_at=datetime.utcnow() + timedelta(days=i),
            duration_minutes=50,
            status=AppointmentStatus.scheduled
        )

        db.add(appointment)

    db.commit()

    print("Sessões criadas.")


def run():

    db = SessionLocal()

    try:

        admin = create_user_if_not_exists(
            db, "admin@test.com", "SenhaSegura123!", UserRole.admin
        )

        therapist = create_user_if_not_exists(
            db, "therapist@test.com", "SenhaSegura123!", UserRole.therapist
        )

        patient = create_user_if_not_exists(
            db, "patient@test.com", "SenhaSegura123!", UserRole.patient
        )

        create_therapist_profile_if_not_exists(db, therapist.id)

        create_availability_if_not_exists(db, therapist.id)

        create_test_appointments(db, therapist.id, patient.id)

    finally:

        db.close()


if __name__ == "__main__":
    run()