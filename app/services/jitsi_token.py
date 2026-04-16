import jwt
import os
from datetime import datetime, timedelta

JITSI_APP_ID = os.getenv("JITSI_APP_ID", "meudiva")
JITSI_APP_SECRET = os.getenv("JITSI_APP_SECRET")
JITSI_DOMAIN = os.getenv("JITSI_DOMAIN", "meet.meudivaonline.com").replace(":8000", "")

def generate_meet_token(room_name: str, user_id: int, user_name: str, is_moderator: bool = True):
    now = datetime.utcnow()

    payload = {
        "aud": JITSI_APP_ID,
        "iss": JITSI_APP_ID,
        "sub": JITSI_DOMAIN,
        "room": room_name,
        "exp": now + timedelta(hours=1),
        "nbf": now,
        "context": {
            "user": {
                "id": str(user_id),
                "name": user_name,
                "avatar": f"https://meudiva-api-prod-592671373665.southamerica-east1.run.app/api/users/{user_id}/avatar",
                "email": f"user_{user_id}@meudiva.com.br"
            }
        }
    }

    if is_moderator:
        payload["moderator"] = True

    return jwt.encode(payload, JITSI_APP_SECRET, algorithm="HS256")