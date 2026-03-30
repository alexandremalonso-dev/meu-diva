import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from datetime import datetime, timedelta, time
from faker import Faker

from app.db.database import SessionLocal
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.therapist_availability import TherapistAvailability
from app.models.appointment import Appointment
from app.core.appointment_status import AppointmentStatus
from app.core.security import get_password_hash
from app.core.roles import UserRole

fake = Faker()
db = SessionLocal()

def create_therapists():
    therapist_profiles = []  # ← Renomeado para clareza
    print("Criando terapeutas...")
    for i in range(10):
        email = f"therapist{i}@test.com"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # Se já existe, buscar o perfil correspondente
            profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == existing.id).first()
            if profile:
                therapist_profiles.append(profile)
            continue
            
        user = User(
            email=email,
            password_hash=get_password_hash("123456"),
            role=UserRole.therapist,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = TherapistProfile(
            user_id=user.id,
            bio=fake.text(),
            specialties=", ".join(fake.words(nb=3)),
            session_price=random.choice([120, 150, 180, 200, 250])
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
        therapist_profiles.append(profile)  # ← Agora guarda o perfil
    return therapist_profiles

def create_patients():
    patients = []
    print("Criando pacientes...")
    for i in range(200):
        email = f"patient{i}@test.com"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            patients.append(existing)
            continue
        user = User(
            email=email,
            password_hash=get_password_hash("123456"),
            role=UserRole.patient,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        patients.append(user)
    return patients

def create_availability():
    print("Criando disponibilidade...")
    profiles = db.query(TherapistProfile).all()
    for profile in profiles:
        # Verificar se já existe disponibilidade para este perfil
        exists = db.query(TherapistAvailability).filter(
            TherapistAvailability.therapist_profile_id == profile.id
        ).first()
        if exists:
            continue
        
        # Criar disponibilidade para todos os dias da semana (segunda a sexta)
        for weekday in range(5):  # 0=segunda, 4=sexta
            # Criar 2 horários por dia: manhã e tarde
            for hour in [9, 14]:  # 9h e 14h
                availability = TherapistAvailability(
                    therapist_profile_id=profile.id,  # ✅ Usando o ID do perfil
                    weekday=weekday,
                    start_time=time(hour, 0),
                    end_time=time(hour + 1, 50)  # 1h50 de duração (permite sessões de 50min)
                )
                db.add(availability)
        db.commit()
        print(f"  Disponibilidade criada para terapeuta {profile.user_id}")

def create_appointments(therapist_profiles, patients):
    print("Criando sessões...")
    # Buscar todos os perfis de terapeuta do banco (não confiar na lista passada)
    profiles = db.query(TherapistProfile).all()
    
    if not profiles:
        print("⚠️ Nenhum perfil de terapeuta encontrado!")
        return
        
    for _ in range(1000):
        therapist_profile = random.choice(profiles)
        patient = random.choice(patients)
        
        # Gerar data aleatória nos próximos 90 dias
        days_ahead = random.randint(1, 90)
        hour = random.randint(9, 16)
        start = datetime.utcnow() + timedelta(days=days_ahead, hours=hour)
        end = start + timedelta(minutes=50)
        
        # Escolher status aleatório
        status = random.choices(
            [AppointmentStatus.scheduled, AppointmentStatus.cancelled_by_patient],
            weights=[70, 30]
        )[0]
        
        appointment = Appointment(
            therapist_user_id=therapist_profile.user_id,  # ✅ Agora é um perfil, tem user_id
            patient_user_id=patient.id,
            starts_at=start,
            ends_at=end,
            status=status,
            session_price=therapist_profile.session_price
        )
        db.add(appointment)
        
        if _ % 100 == 0:
            db.commit()
            print(f"  {_} sessões criadas...")
    
    db.commit()
    print("  Todas as sessões criadas.")

def run():
    print("🚀 Iniciando seed massivo do Meu Divã...")
    
    # Passo 1: Criar terapeutas (retorna lista de perfis)
    therapist_profiles = create_therapists()
    print(f"✅ {len(therapist_profiles)} terapeutas criados")
    
    # Passo 2: Criar pacientes
    patients = create_patients()
    print(f"✅ {len(patients)} pacientes criados")
    
    # Passo 3: Criar disponibilidade
    create_availability()
    print("✅ Disponibilidade criada")
    
    # Passo 4: Criar sessões
    create_appointments(therapist_profiles, patients)
    
    print("🎉 Seed massivo finalizado com sucesso!")
    print(f"📊 Total: {len(therapist_profiles)} terapeutas, {len(patients)} pacientes, 1000 sessões")

if __name__ == "__main__":
    run()