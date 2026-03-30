from datetime import datetime, timedelta, timezone


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


def setup_appointment(client, hours_ahead=48):
    """
    Cria terapeuta, paciente, disponibilidade
    e retorna (appointment_id, therapist_token, patient_token)
    """

    create_user(client, "therapist@test.com", "therapist")
    therapist_token = login(client, "therapist@test.com")
    therapist_id = 1

    create_user(client, "patient@test.com", "patient")
    patient_token = login(client, "patient@test.com")

    starts_at = datetime.now(timezone.utc) + timedelta(hours=hours_ahead)
    ends_at = starts_at + timedelta(minutes=50)
    weekday = starts_at.weekday()

    client.post(
        "/therapists/me/availability",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={
            "weekday": weekday,
            "start_time": "00:00:00",
            "end_time": "23:59:00",
        },
    )

    response = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": therapist_id,
            "starts_at": starts_at.isoformat(),
            "ends_at": ends_at.isoformat(),
        },
    )

    assert response.status_code == 201, response.json()

    return response.json()["id"], therapist_token, patient_token


# ==========================
# TESTE CONFIRMAÇÃO
# ==========================

def test_valid_confirmation(client):
    appointment_id, therapist_token, _ = setup_appointment(client)

    response = client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={"status": "confirmed"},
    )

    assert response.status_code == 200


# ==========================
# TRANSIÇÃO INVÁLIDA
# ==========================

def test_invalid_transition_confirm_after_completed(client):
    # Criar appointment no passado
    appointment_id, therapist_token, _ = setup_appointment(client, hours_ahead=-2)

    # Completar primeiro
    client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={"status": "completed"},
    )

    # Tentar confirmar depois
    response = client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={"status": "confirmed"},
    )

    assert response.status_code == 400


# ==========================
# BLOQUEIO TERMINAL
# ==========================

def test_terminal_status_block(client):
    appointment_id, _, patient_token = setup_appointment(client)

    # Cancelar como paciente
    client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={"status": "cancelled_by_patient"},
    )

    # Tentar alterar novamente
    response = client.patch(
        f"/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={"status": "cancelled_by_patient"},
    )

    assert response.status_code == 400