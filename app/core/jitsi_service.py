"""
Serviço de integração com Jitsi Meet
Gera salas de videochamada embutíveis em iframe
"""

import uuid
import requests
from datetime import datetime, timedelta
from typing import Optional
import jwt
import os

# Configuração do Jitsi (self-hosted ou público)
JITSI_DOMAIN = os.getenv("JITSI_DOMAIN", "meet.jit.si")  # público
JITSI_APP_ID = os.getenv("JITSI_APP_ID", "")  # para self-hosted
JITSI_SECRET = os.getenv("JITSI_SECRET", "")  # para autenticação

class JitsiService:
    """Serviço para geração de salas Jitsi Meet"""
    
    def __init__(self):
        self.domain = JITSI_DOMAIN
        self.app_id = JITSI_APP_ID
        self.secret = JITSI_SECRET
    
    def generate_room_name(self, appointment_id: int) -> str:
        """Gera um nome único para a sala"""
        # Formato: meudiva-sessao-{appointment_id}-{uuid_curto}
        short_uuid = uuid.uuid4().hex[:8]
        return f"meudiva-sessao-{appointment_id}-{short_uuid}"
    
    def generate_room_url(self, appointment_id: int, is_therapist: bool = False) -> str:
        """Gera a URL da sala Jitsi"""
        room_name = self.generate_room_name(appointment_id)
        
        # URL base
        base_url = f"https://{self.domain}/{room_name}"
        
        # Parâmetros para melhor experiência
        params = {
            "config.startWithVideoMuted": "false",
            "config.startWithAudioMuted": "false",
            "interfaceConfig.APP_NAME": "Meu Divã",
            "userInfo.displayName": "Terapeuta" if is_therapist else "Paciente"
        }
        
        # Montar URL com parâmetros
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query_string}"
    
    def create_meet_link(self, appointment) -> Optional[str]:
        """
        Cria um link para a sala Jitsi
        Compatível com a interface do Google Meet
        """
        try:
            # Gerar nome da sala baseado no ID da sessão
            room_name = self.generate_room_name(appointment.id)
            
            # URL completa
            meet_url = f"https://{self.domain}/{room_name}"
            
            print(f"✅ Sala Jitsi criada: {meet_url}")
            return meet_url
            
        except Exception as e:
            print(f"❌ Erro ao criar sala Jitsi: {e}")
            return None
    
    def generate_token(self, room_name: str, user_name: str, is_moderator: bool = False) -> Optional[str]:
        """
        Gera token JWT para autenticação (opcional, para self-hosted)
        """
        if not self.secret:
            return None
        
        try:
            payload = {
                "context": {
                    "user": {
                        "name": user_name,
                        "id": str(uuid.uuid4())
                    }
                },
                "aud": "jitsi",
                "iss": self.app_id,
                "sub": self.domain,
                "room": room_name,
                "exp": datetime.utcnow() + timedelta(hours=4),
                "moderator": is_moderator
            }
            
            token = jwt.encode(payload, self.secret, algorithm="HS256")
            return token
            
        except Exception as e:
            print(f"❌ Erro ao gerar token Jitsi: {e}")
            return None

# Instância global
jitsi_service = JitsiService()