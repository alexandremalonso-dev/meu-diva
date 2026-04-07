from jose import jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User


async def get_current_user_ws(token: str, db: Session):
    """
    Autentica um usuário via token para conexão WebSocket
    """
    try:
        # Decodificar o token JWT
        payload = jwt.decode(
            token, 
            settings.jwt_secret, 
            algorithms=["HS256"]
        )
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Buscar usuário no banco
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user or not user.is_active:
            return None
        
        return user
        
    except jwt.ExpiredSignatureError:
        print("⚠️ Token expirado na conexão WebSocket")
        return None
    except jwt.JWTError as e:
        print(f"⚠️ Erro ao decodificar token WebSocket: {e}")
        return None
    except Exception as e:
        print(f"⚠️ Erro inesperado na autenticação WebSocket: {e}")
        return None