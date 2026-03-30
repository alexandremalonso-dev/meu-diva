from fastapi import Request, HTTPException, status, Depends
from jose import jwt, JWTError
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from sqlalchemy.orm import Session

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = None

    # 🔥 1. TENTA COOKIE
    token = request.cookies.get("access_token")

    # 🔥 2. FALLBACK HEADER (Swagger etc)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        print("❌ Nenhum token fornecido")
        raise HTTPException(status_code=401, detail="Não autenticado")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")

        user = db.get(User, int(user_id))

        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")

        return user

    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")