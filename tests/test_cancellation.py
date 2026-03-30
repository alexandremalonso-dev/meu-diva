from datetime import datetime, timedelta, timezone
import base64
import json


# ==========================
# HELPERS
# ==========================

def create_user(client, email, role):
    client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "123456",
            "role": role,
        },
    )


def login(client, email):
    response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "123456",
        },
    )
    return response.json()["access_token"]


def extract_user_id_from_token(token):
    payload_part = token.split(".")[1]
    padded = payload_part + "=" * (-len(payload_part) % 4)
    decoded = base64.urlsafe_b64decode(padded)
    payload = json.loads(decoded)
    return int(payload["sub"])


def create_availability_for_datetime(client, token, dt):
    client.post(
        "/therapists/me/availability",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "weekday": dt.weekday(),
            "start_time": "00:00:00",
            "end_time": "23:59:00",
        },
    )


def setup_appointment(client, hours_offset):
    # Criar terapeuta
    create_user(client, "therapist@test.com", "therapist")
    therapist_token = login(client, "therapist@test.com")
    therapist_id = extract_user_id_from_token(therapist_token)

    # Calcular horário real
    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(hours=hours_offset)

    # Criar disponibilidade coerente
    create_availability_for_datetime(client, therapist_token, starts_at)

    # Criar paciente
    create_user(client, "patient@test.com", "patient")
    patient_token = login(client, "patient@test.com")

    response = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": therapist_id,
            "starts_at": starts_at.isoformat(),
            "duration_minutes": 50,
        },
    )

    assert response.status_code in (200, 201), response.json()

    return response.json()["id"], patient_token


# ==========================
# TESTES
# ==========================

def test_patient_cancel_within_policy(client):
    appointment_id, patient_token = setup_appointment(client, 48)

    response = client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={"status": "cancelled_by_patient"},
    )

    assert response.status_code == 200


def test_patient_cancel_less_than_24h_returns_400(client):
    appointment_id, patient_token = setup_appointment(client, 5)

    response = client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={"status": "cancelled_by_patient"},
    )

    assert response.status_code == 400


def test_admin_can_cancel_less_than_24h(client):
    create_user(client, "admin@test.com", "admin")
    admin_token = login(client, "admin@test.com")

    appointment_id, _ = setup_appointment(client, 5)

    response = client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "cancelled_by_admin"},
    )

    assert response.status_code == 200