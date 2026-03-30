from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from jose import jwt
from datetime import datetime, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.core.config import settings

# ============================================
# TEMPOS DE EXPIRAÇÃO POR ROLE
# ============================================

ACCESS_TOKEN_EXPIRE_MINUTES_PATIENT = 120   # 2 horas para paciente
ACCESS_TOKEN_EXPIRE_MINUTES_THERAPIST = 720 # 12 horas para terapeuta
ACCESS_TOKEN_EXPIRE_MINUTES_ADMIN = 480     # 8 horas para admin

# ============================================
# FUNÇÃO PARA CRIAR TOKEN
# ============================================

def create_access_token(data: dict, user_role: str = None) -> str:
    """
    Cria token JWT com tempo de expiração baseado na role do usuário
    """
    to_encode = data.copy()
    
    # Define tempo de expiração baseado na role
    if user_role == "patient":
        expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_PATIENT
    elif user_role == "therapist":
        expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_THERAPIST
    else:
        expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_ADMIN
    
    expire = datetime.utcnow() + timedelta(minutes=expire_minutes)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.jwt_secret, 
        algorithm="HS256"
    )
    return encoded_jwt

# ============================================
# SECURITY SCHEME (Swagger + JWT)
# ============================================

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Obtém o usuário atual via JWT (Bearer Token)
    Compatível com Swagger (Authorize)
    """

    if not credentials:
        print("❌ Nenhum token fornecido")
        raise HTTPException(status_code=401, detail="Não autenticado")

    token = credentials.credentials
    print(f"🔐 Token recebido: {token[:20]}...")

    try:
        # ✅ CORRIGIDO: usar jwt_secret (como está no config.py)
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")

        user_id = int(user_id)

    except jwt.ExpiredSignatureError:
        print("❌ Token expirado")
        raise HTTPException(status_code=401, detail="Token expirado")

    except jwt.JWTError as e:
        print(f"❌ JWT inválido: {e}")
        raise HTTPException(status_code=401, detail="Token inválido")

    except Exception as e:
        print(f"❌ Erro inesperado: {e}")
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário inativo")

    print(f"✅ Usuário autenticado: {user.id}")

    return user


# 🔥 NOVA FUNÇÃO: get_current_user_optional
async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Obtém o usuário atual a partir do token JWT, mas retorna None se não autenticado.
    Útil para endpoints públicos que podem ter ou não usuário logado.
    """
    if not credentials:
        return None

    token = credentials.credentials

    try:
        # ✅ CORRIGIDO: usar jwt_secret (como está no config.py)
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")

        if not user_id:
            return None

        user_id = int(user_id)

    except:
        # Qualquer erro (token inválido, expirado, etc) retorna None
        return None

    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if not user or not user.is_active:
        return None

    return user


# Compatibilidade (se algum código ainda usa isso)
oauth2_scheme = HTTPBearer()