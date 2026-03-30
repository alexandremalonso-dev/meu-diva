"""
Script para testar o fluxo completo de confirmação de sessão com envio de e-mail
Cria sessão diretamente com status "proposed" (não requer pagamento)
Sessão agendada para 30/03/2026 às 07:00
"""
import os
import sys
from pathlib import Path
import requests
import json
import time
import datetime

# Adicionar o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configuração
BASE_URL = "http://localhost:8000/api"

# Credenciais de teste
TEST_THERAPIST = {
    "email": "therapist2@test.com",
    "password": "123456"
}

TEST_PATIENT = {
    "email": "patient92@test.com",
    "password": "123456"
}

def login(email, password):
    """Faz login e retorna o token"""
    print(f"🔐 Login: {email}")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro no login: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    token = data.get("access_token")
    print(f"✅ Login bem-sucedido")
    return token

def get_user_info(token):
    """Obtém informações do usuário"""
    response = requests.get(
        f"{BASE_URL}/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao obter usuário: {response.status_code}")
        return None
    
    return response.json()

def get_appointments(token):
    """Lista appointments do usuário"""
    response = requests.get(
        f"{BASE_URL}/appointments/me/details",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao listar appointments: {response.status_code}")
        return []
    
    appointments = response.json()
    print(f"📋 Encontrados {len(appointments)} appointments")
    return appointments

def create_appointment(therapist_token, patient_user_id, therapist_user_id):
    """Cria uma sessão diretamente com status 'proposed' para 30/03/2026 07:00"""
    print(f"📨 Criando sessão para paciente ID {patient_user_id}...")
    
    # Data e hora para a sessão: 30/03/2026 às 07:00
    starts_at = datetime.datetime(2026, 3, 30, 7, 0, 0)
    ends_at = starts_at + datetime.timedelta(minutes=50)
    
    print(f"📅 Data da sessão: {starts_at.strftime('%d/%m/%Y %H:%M')}")
    
    response = requests.post(
        f"{BASE_URL}/appointments",
        headers={
            "Authorization": f"Bearer {therapist_token}",
            "Content-Type": "application/json"
        },
        json={
            "patient_user_id": patient_user_id,
            "therapist_user_id": therapist_user_id,
            "starts_at": starts_at.isoformat(),
            "ends_at": ends_at.isoformat(),
            "duration_minutes": 50,
            "status": "proposed"
        }
    )
    
    if response.status_code != 201:
        print(f"❌ Erro ao criar sessão: {response.status_code} - {response.text}")
        return None
    
    appointment = response.json()
    print(f"✅ Sessão criada: ID {appointment['id']}")
    return appointment

def confirm_appointment(patient_token, appointment_id):
    """Paciente confirma a sessão"""
    print(f"✅ Confirmando sessão ID {appointment_id}...")
    
    response = requests.patch(
        f"{BASE_URL}/appointments/{appointment_id}/status",
        headers={
            "Authorization": f"Bearer {patient_token}",
            "Content-Type": "application/json"
        },
        json={"status": "confirmed"}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao confirmar sessão: {response.status_code} - {response.text}")
        return None
    
    appointment = response.json()
    print(f"✅ Sessão confirmada! Status: {appointment['status']}")
    print(f"📧 E-mail de confirmação deve ter sido enviado para paciente e terapeuta")
    print(f"🎥 Link do Meet: {appointment.get('video_call_url', 'N/A')}")
    return appointment

def complete_session(therapist_token, appointment_id, medical_record_data):
    """Terapeuta finaliza a sessão com prontuário"""
    print(f"📝 Finalizando sessão ID {appointment_id}...")
    
    response = requests.post(
        f"{BASE_URL}/appointments/{appointment_id}/complete",
        headers={
            "Authorization": f"Bearer {therapist_token}",
            "Content-Type": "application/json"
        },
        json=medical_record_data
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao finalizar sessão: {response.status_code} - {response.text}")
        return None
    
    record = response.json()
    print(f"✅ Sessão finalizada! Prontuário ID: {record['id']}")
    return record

def send_receipt(patient_token, appointment_id):
    """Testa envio de recibo por e-mail"""
    print(f"📧 Solicitando envio de recibo para sessão ID {appointment_id}...")
    
    response = requests.post(
        f"{BASE_URL}/appointments/{appointment_id}/send-receipt",
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao enviar recibo: {response.status_code} - {response.text}")
        return False
    
    print(f"✅ Recibo enviado por e-mail!")
    return True

def main():
    print("=" * 60)
    print("🧪 TESTE DE FLUXO COMPLETO DE SESSÃO")
    print("=" * 60)
    print("📅 Sessão agendada para: 30/03/2026 às 07:00")
    print("=" * 60)
    
    # 1. Login como terapeuta
    therapist_token = login(TEST_THERAPIST["email"], TEST_THERAPIST["password"])
    if not therapist_token:
        print("❌ Falha no login do terapeuta")
        return
    
    therapist_info = get_user_info(therapist_token)
    print(f"👤 Terapeuta: {therapist_info['email']} (ID: {therapist_info['id']})")
    
    # 2. Login como paciente
    patient_token = login(TEST_PATIENT["email"], TEST_PATIENT["password"])
    if not patient_token:
        print("❌ Falha no login do paciente")
        return
    
    patient_info = get_user_info(patient_token)
    print(f"👤 Paciente: {patient_info['email']} (ID: {patient_info['id']})")
    
    # 3. Criar sessão (terapeuta cria)
    print("\n📨 CRIANDO SESSÃO...")
    appointment = create_appointment(therapist_token, patient_info["id"], therapist_info["id"])
    if not appointment:
        print("❌ Falha ao criar sessão")
        return
    
    # 4. Listar appointments do paciente para ver a sessão
    print("\n📋 LISTANDO APPOINTMENTS DO PACIENTE...")
    appointments = get_appointments(patient_token)
    
    # 5. Paciente confirma a sessão
    print("\n✅ CONFIRMANDO SESSÃO...")
    confirmed_appointment = confirm_appointment(patient_token, appointment["id"])
    if not confirmed_appointment:
        print("❌ Falha ao confirmar sessão")
        return
    
    # 6. Aguardar um pouco para o e-mail ser enviado
    print("\n⏳ Aguardando processamento do e-mail...")
    time.sleep(3)
    
    # 7. Simular que a sessão ocorreu e terapeuta finaliza
    print("\n📝 FINALIZANDO SESSÃO (PRONTUÁRIO)...")
    medical_record_data = {
        "appointment_id": appointment["id"],
        "session_not_occurred": False,
        "evolution": "Paciente participou ativamente. Sessão produtiva.",
        "outcome": "IN_PROGRESS",
        "patient_reasons": ["Ansiedade", "Autoestima"],
        "activity_instructions": "Praticar exercícios de respiração",
        "private_notes": "Paciente respondeu bem à intervenção"
    }
    
    record = complete_session(therapist_token, appointment["id"], medical_record_data)
    if not record:
        print("⚠️ Não foi possível finalizar a sessão (pode já estar finalizada)")
    else:
        print(f"✅ Prontuário registrado!")
    
    # 8. Enviar recibo por e-mail
    print("\n📧 ENVIANDO RECIBO POR E-MAIL...")
    send_receipt(patient_token, appointment["id"])
    
    # 9. Aguardar e verificar e-mails
    print("\n⏳ Aguardando envio dos e-mails...")
    time.sleep(3)
    
    # 10. Listar appointments atualizados
    print("\n📋 APPOINTMENTS ATUALIZADOS:")
    updated_appointments = get_appointments(patient_token)
    
    for apt in updated_appointments:
        if apt["id"] == appointment["id"]:
            meet_url = apt.get('video_call_url', 'N/A')
            if meet_url and meet_url != 'N/A':
                meet_url = meet_url[:50] + "..."
            print(f"   ID: {apt['id']} | Status: {apt['status']} | Meet: {meet_url}")
    
    print("\n" + "=" * 60)
    print("✅ TESTE CONCLUÍDO!")
    print("=" * 60)
    print("\n📧 Verifique os e-mails no Mailtrap: https://mailtrap.io/inboxes")
    print("   Você deve ver:")
    print("   1. E-mail de confirmação da sessão (após confirmação)")
    print("   2. E-mail com recibo (após finalização)")
    print("\n🎥 O link do Google Meet deve estar disponível na sessão confirmada")

if __name__ == "__main__":
    main()