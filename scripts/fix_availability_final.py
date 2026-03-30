import sys
import os
# Adiciona a raiz do projeto ao path para conseguir importar os módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.therapist_availability import TherapistAvailability
from app.models.therapist_profile import TherapistProfile
import random

db = SessionLocal()

print("🔍 Buscando dados...")

# Buscar todos os perfis de terapeuta
profiles = db.query(TherapistProfile).all()
print(f"📊 Encontrados {len(profiles)} perfis de terapeuta")

# Buscar todas as disponibilidades
availabilities = db.query(TherapistAvailability).all()
print(f"📊 Encontradas {len(availabilities)} disponibilidades")

# Coletar IDs dos perfis
profile_ids = [p.id for p in profiles]

# Atualizar disponibilidades sem therapist_profile_id
count = 0
for av in availabilities:
    if av.therapist_profile_id is None:
        av.therapist_profile_id = random.choice(profile_ids)
        count += 1

db.commit()
print(f"✅ {count} disponibilidades atualizadas com therapist_profile_id")

# Verificar se ainda há NULLs
remaining = db.query(TherapistAvailability).filter(TherapistAvailability.therapist_profile_id.is_(None)).count()
print(f"📊 Ainda NULL: {remaining}")

db.close()

if remaining == 0:
    print("🎉 Tudo pronto! Agora você pode criar a migration NOT NULL.")
else:
    print("⚠️ Ainda há valores NULL. Execute o script novamente.")