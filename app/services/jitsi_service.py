"""
Serviço de integração com Jitsi Meet (Self-Hosted / JWT opcional)
"""

import os
import jwt
from datetime import datetime, timedelta
from typing import Optional


class JitsiService:
    """Serviço para geração de salas Jitsi Meet"""

    def __init__(self):
        # 🔥 IMPORTANTE: remover :8000 automaticamente
        raw_domain = os.getenv("JITSI_DOMAIN", "meet.jit.si")
        self.domain = raw_domain.replace(":8000", "")

        self.app_id = os.getenv("JITSI_APP_ID", "meudiva")
        self.app_secret = os.getenv("JITSI_APP_SECRET")
        self.token_ttl = int(os.getenv("JITSI_TOKEN_TTL", 3600))

        # 🔥 padrão seguro
        self.use_jwt = os.getenv("JITSI_USE_JWT", "false").lower() == "true"

    # ==========================
    # ROOM
    # ==========================
    def generate_room_name(self, appointment_id: int) -> str:
        return f"meudiva-sessao-{appointment_id}"

    # ==========================
    # TOKEN (JWT)
    # ==========================
    def generate_token(
        self,
        room_name: str,
        user_id: int,
        user_name: str,
        is_moderator: bool = False
    ) -> Optional[str]:

        if not self.use_jwt or not self.app_secret:
            return None

        now = datetime.utcnow()

        payload = {
            "aud": self.app_id,
            "iss": self.app_id,
            "sub": self.domain,
            "room": room_name,
            "exp": now + timedelta(seconds=self.token_ttl),
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

        return jwt.encode(payload, self.app_secret, algorithm="HS256")

    # ==========================
    # URL
    # ==========================
    def get_meet_url(
        self,
        appointment_id: int,
        user_id: int,
        user_name: str,
        is_moderator: bool = False
    ) -> str:

        room_name = self.generate_room_name(appointment_id)

        base_url = f"https://{self.domain}/{room_name}"

        token = self.generate_token(
            room_name,
            user_id,
            user_name,
            is_moderator
        )

        # 🔥 CORREÇÃO CRÍTICA:
        # NÃO usar displayName na URL (quebra no self-hosted)
        if token:
            return f"{base_url}?jwt={token}"

        return base_url


# instância global
jitsi_service = JitsiService()