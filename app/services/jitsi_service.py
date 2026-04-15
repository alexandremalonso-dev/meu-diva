"""
Serviço de integração com Jitsi Meet (Self-Hosted com JWT)
"""
import os
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Optional

class JitsiService:
    """Serviço para geração de salas Jitsi Meet com autenticação JWT"""
    
    def __init__(self):
        # Configurações do self-hosted
        self.domain = os.getenv("JITSI_DOMAIN", "meet.jit.si")
        self.app_id = os.getenv("JITSI_APP_ID", "meudiva_app_id")
        self.app_secret = os.getenv("JITSI_APP_SECRET")
        self.token_ttl = int(os.getenv("JITSI_TOKEN_TTL", 3600))  # 1 hora
        self.use_jwt = os.getenv("JITSI_USE_JWT", "false").lower() == "true"
    
    def generate_room_name(self, appointment_id: int) -> str:
        """
        Gera um nome único para a sala da sessão
        Formato: meudiva-sessao-{appointment_id}
        """
        return f"meudiva-sessao-{appointment_id}"
    
    def generate_token(self, room_name: str, user_id: int, user_name: str, is_moderator: bool = False) -> Optional[str]:
        """
        Gera token JWT para acesso à sala Jitsi
        
        Args:
            room_name: Nome da sala
            user_id: ID do usuário
            user_name: Nome do usuário
            is_moderator: Se é moderador (terapeuta = True)
        
        Returns:
            Token JWT ou None se não configurado
        """
        if not self.use_jwt or not self.app_secret:
            return None
        
        now = datetime.utcnow()
        
        payload = {
            "iss": self.app_id,
            "aud": self.domain,
            "sub": self.domain,
            "room": room_name,
            "exp": now + timedelta(seconds=self.token_ttl),
            "nbf": now,
            "context": {
                "user": {
                    "id": str(user_id),
                    "name": user_name,
                }
            }
        }
        
        # Moderador (terapeuta) tem permissões especiais
        if is_moderator:
            payload["context"]["user"]["moderator"] = True
            payload["moderator"] = True
        
        token = jwt.encode(payload, self.app_secret, algorithm="HS256")
        return token
    
    def get_meet_url(self, appointment_id: int, user_id: int, user_name: str, is_moderator: bool = False) -> str:
        """
        Retorna URL da sala Jitsi para embed
        
        Args:
            appointment_id: ID da sessão
            user_id: ID do usuário
            user_name: Nome do usuário para exibição
            is_moderator: Se é terapeuta (moderador) ou paciente (participante)
        
        Returns:
            URL completa
        """
        room_name = self.generate_room_name(appointment_id)
        
        # Gerar token JWT se self-hosted estiver configurado
        token = self.generate_token(room_name, user_id, user_name, is_moderator)
        
        # URL base
        base_url = f"https://{self.domain}/{room_name}"
        
        # Apenas o nome do usuário (URL enxuta - evita erro de tamanho)
        url = f"{base_url}#userInfo.displayName={user_name}"
        
        # Adicionar token se disponível
        if token:
            url = f"{base_url}#userInfo.displayName={user_name}&jwt={token}"
        
        return url

# Instância global
jitsi_service = JitsiService()