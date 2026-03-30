from datetime import datetime, timedelta, timezone


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


def test_conflict_409_same_time(client):
    # Criar terapeuta (primeiro usuário → id = 1)
    create_user(client, "therapist@test.com", "therapist")
    therapist_token = login(client, "therapist@test.com")
    therapist_id = 1

    # Criar paciente (segundo usuário → id = 2)
    create_user(client, "patient@test.com", "patient")
    patient_token = login(client, "patient@test.com")

    starts_at = datetime.now(timezone.utc) + timedelta(hours=48)
    ends_at = starts_at + timedelta(minutes=50)
    weekday = starts_at.weekday()

    # Criar disponibilidade correta
    client.post(
        "/therapists/me/availability",
        headers={"Authorization": f"Bearer {therapist_token}"},
        json={
            "weekday": weekday,
            "start_time": "00:00:00",
            "end_time": "23:59:00",
        },
    )

    # Primeiro appointment
    response1 = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": therapist_id,
            "starts_at": starts_at.isoformat(),
            "ends_at": ends_at.isoformat(),
        },
    )

    assert response1.status_code == 201, response1.json()

    # Segundo appointment no mesmo horário → deve dar 409
    response2 = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": therapist_id,
            "starts_at": starts_at.isoformat(),
            "ends_at": ends_at.isoformat(),
        },
    )

    assert response2.status_code == 409


def test_conflict_409_overlap(client):
    # Criar terapeuta (id = 1)
    create_user(client, "therapist2@test.com", "therapist")
    therapist_token = login(client, "therapist2@test.com")
    therapist_id = 1

    # Criar paciente (id = 2)
    create_user(client, "patient2@test.com", "patient")
    patient_token = login(client, "patient2@test.com")

    starts_at = datetime.now(timezone.utc) + timedelta(hours=72)
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

    response1 = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": therapist_id,
            "starts_at": starts_at.isoformat(),
            "ends_at": ends_at.isoformat(),
        },
    )

    assert response1.status_code == 201, response1.json()

    overlap_start = starts_at + timedelta(minutes=20)
    overlap_end = overlap_start + timedelta(minutes=50)

    response2 = client.post(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
        json={
            "therapist_user_id": therapist_id,
            "starts_at": overlap_start.isoformat(),
            "ends_at": overlap_end.isoformat(),
        },
    )

    assert response2.status_code == 409