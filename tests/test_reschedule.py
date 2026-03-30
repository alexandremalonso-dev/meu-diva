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


def setup_base_appointment(client, hours_ahead=48):
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

    return response.json(), therapist_token, patient_token


# ==========================
# TESTE SUCESSO
# ==========================

def test_reschedule_success(client):
    original_appt, therapist_token, _ = setup_base_appointment(client)

    new_start = datetime.now(timezone.utc) + timedelta(hours=72)
    new_end = new_start + timedelta(minutes=50)
    weekday = new_start.weekday()

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
        f"/appointments/{original_appt['id']}/reschedule",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={
            "therapist_user_id": original_appt["therapist_user_id"],
            "starts_at": new_start.isoformat(),
            "ends_at": new_end.isoformat(),
        },
    )

    assert response.status_code == 200

    new_appt = response.json()

    assert new_appt["rescheduled_from_id"] == original_appt["id"]
    assert new_appt["status"] == "scheduled"

    original_check = client.get(
        "/appointments/me",
        headers={"Authorization": f"Bearer {therapist_token}"},
    )

    found = [a for a in original_check.json() if a["id"] == original_appt["id"]][0]
    assert found["status"] == "rescheduled"


# ==========================
# TESTE CONFLITO
# ==========================

def test_reschedule_conflict_409(client):
    original_appt, therapist_token, patient_token = setup_base_appointment(client)

    second_start = datetime.now(timezone.utc) + timedelta(hours=72)
    second_end = second_start + timedelta(minutes=50)
    weekday = second_start.weekday()

    client.post(
        "/therapists/me/availability",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={
            "weekday": weekday,
            "start_time": "00:00:00",
            "end_time": "23:59:00",
        },
    )

    # 🔴 CRIAR CONFLITO COM PACIENTE (correto no modelo A)
    conflict_response = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": original_appt["therapist_user_id"],
            "starts_at": second_start.isoformat(),
            "ends_at": second_end.isoformat(),
        },
    )

    assert conflict_response.status_code == 201

    response = client.post(
        f"/appointments/{original_appt['id']}/reschedule",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={
            "therapist_user_id": original_appt["therapist_user_id"],
            "starts_at": second_start.isoformat(),
            "ends_at": second_end.isoformat(),
        },
    )

    assert response.status_code == 409


# ==========================
# BLOQUEIO TERMINAL
# ==========================

def test_reschedule_block_terminal(client):
    original_appt, therapist_token, _ = setup_base_appointment(client, hours_ahead=-2)

    client.patch(
        f"/appointments/{original_appt['id']}/status",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={"status": "completed"},
    )

    new_start = datetime.now(timezone.utc) + timedelta(hours=24)
    new_end = new_start + timedelta(minutes=50)

    response = client.post(
        f"/appointments/{original_appt['id']}/reschedule",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={
            "therapist_user_id": original_appt["therapist_user_id"],
            "starts_at": new_start.isoformat(),
            "ends_at": new_end.isoformat(),
        },
    )

    assert response.status_code == 400