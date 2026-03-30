def test_register_and_login(client):
    # Registro
    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "123456",
            "role": "patient",
        },
    )
    assert response.status_code == 201

    # Login (JSON, não form-data)
    response = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "123456",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()