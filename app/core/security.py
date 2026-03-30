from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi import Request, HTTPException, status
from app.db.database import SessionLocal
from app.models.user import User
from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ALGORITHM = "HS256"

# =========================
# Password
# =========================

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

# =========================
# JWT - CORE (PADRÃO ÚNICO)
# =========================

def create_token(data: dict, expires_delta: timedelta, token_type: str):
    to_encode = data.copy()
    to_encode.update({
        "type": token_type,
        "exp": datetime.utcnow() + expires_delta
    })
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(data: dict):
    return create_token(data, timedelta(minutes=30), "access")


def create_refresh_token(data: dict):
    return create_token(data, timedelta(days=7), "refresh")


def decode_token(token: str):
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado"
        )

# =========================
# AUTH - Cookie + Header
# =========================

def get_token_from_request(request: Request):
    auth_header = request.headers.get("Authorization")

    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]

    return request.cookies.get("token")

# =========================
# CURRENT USER
# =========================

def get_current_user(request: Request):
    token = get_token_from_request(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado",
        )

    payload = decode_token(token)

    # 🔥 GARANTIA CRÍTICA
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido (não é access token)",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido (sem subject)",
        )

    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    db.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )

    return user