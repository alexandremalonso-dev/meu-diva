def create_therapist_and_login(client):
    client.post(
        "/auth/register",
        json={
            "email": "therapist@test.com",
            "password": "123456",
            "role": "therapist",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "therapist@test.com",
            "password": "123456",
        },
    )

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_availability(client):
    headers = create_therapist_and_login(client)

    response = client.post(
        "/therapists/me/availability",
        headers=headers,
        json={
            "weekday": 1,
            "start_time": "09:00:00",
            "end_time": "18:00:00",
        },
    )

    assert response.status_code in [200, 201]