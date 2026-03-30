import requests
import json
import random

# Dados do Zenklub
service_types = ["psicologo", "psicanalista", "coach", "nutricionista", "psiquiatra", "terapeuta"]
genders = ["homem", "mulher", "nao_binario", "genero_fluido"]
ethnicities = ["branca", "preta", "parda", "amarela", "indigena"]
formations = ["doutorado", "mestrado", "especializacao", "pos_graduacao"]
approaches = [
    "Cognitivo-Comportamental", "Psicanálise", "Humanista", "Gestalt", 
    "Fenomenológica", "Corporal", "Junguiana", "Logoterapia"
]
reasons = [
    "Ansiedade", "Depressão", "Relacionamentos", "Autoestima", 
    "Estresse", "Burnout", "Luto", "Trauma", "Fobias", "TOC"
]

# URL da API
BASE_URL = "http://localhost:8000"
token = "SEU_TOKEN_ADMIN_AQUI"

headers = {"Authorization": f"Bearer {token}"}

# Criar 10 terapeutas de exemplo
for i in range(1, 11):
    profile_data = {
        "bio": f"Psicólogo especializado em {random.choice(reasons)}. {random.randint(5, 20)} anos de experiência.",
        "session_price": random.choice([120, 150, 180, 200, 250, 300]),
        "gender": random.choice(genders),
        "ethnicity": random.choice(ethnicities),
        "lgbtqia_ally": random.choice([True, False]),
        "formation": random.choice(formations),
        "approaches": random.sample(approaches, random.randint(1, 3)),
        "specialties_list": random.sample(reasons, random.randint(2, 5)),
        "reasons": random.sample(reasons, random.randint(3, 7)),
        "service_types": random.sample(service_types, random.randint(1, 2)),
        "languages_list": ["Português"] + random.sample(["Inglês", "Espanhol", "Francês", "Alemão"], random.randint(0, 2)),
        "total_sessions": random.randint(50, 1000),
        "verified": random.choice([True, False]),
        "featured": random.choice([True, False])
    }
    
    response = requests.post(
        f"{BASE_URL}/therapists/me/profile",
        headers=headers,
        json=profile_data
    )
    
    if response.status_code == 200:
        print(f"✅ Terapeuta {i} criado")
    else:
        print(f"❌ Erro: {response.text}")