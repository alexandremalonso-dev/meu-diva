import os
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from fastapi import HTTPException
import httpx

# Configurações OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

oauth = OAuth(Config(environ=os.environ))

# Configurar Google OAuth
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
        redirect_uri=f"{BACKEND_URL}/api/auth/google/callback"
    )
    print("✅ Google OAuth configurado")
else:
    print("⚠️ Google OAuth não configurado - faltam credenciais")

# Configurar Microsoft OAuth
if MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET:
    oauth.register(
        name="microsoft",
        client_id=MICROSOFT_CLIENT_ID,
        client_secret=MICROSOFT_CLIENT_SECRET,
        server_metadata_url="https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
        redirect_uri=f"{BACKEND_URL}/api/auth/microsoft/callback"
    )
    print("✅ Microsoft OAuth configurado")
else:
    print("⚠️ Microsoft OAuth não configurado - faltam credenciais")


async def get_google_user_info(access_token: str) -> dict:
    """Busca informações do usuário no Google"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Erro ao buscar dados do Google")
        return response.json()


async def get_microsoft_user_info(access_token: str) -> dict:
    """Busca informações do usuário na Microsoft"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Erro ao buscar dados da Microsoft")
        
        # Buscar também email (pode vir separado)
        email_response = await client.get(
            "https://graph.microsoft.com/v1.0/me/mail",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        data = response.json()
        if email_response.status_code == 200:
            email_data = email_response.json()
            if email_data.get("value"):
                data["email"] = email_data["value"][0].get("emailAddress", {}).get("address")
        
        return data