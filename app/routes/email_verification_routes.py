from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth - Confirmação de e-mail"])


class VerifyEmailPayload(BaseModel):
    email: EmailStr
    code: str


class ResendPayload(BaseModel):
    email: EmailStr


@router.post("/verify-email")
def verify_email(payload: VerifyEmailPayload, db: Session = Depends(get_db)):
    """Confirma o e-mail com o código e já devolve o login (mesmo formato do /login)."""
    from app.services import email_verification as ev
    from app.routes import auth as _auth

    user_id = ev.verify(db, str(payload.email), payload.code)
    user = db.get(_auth.User, user_id)

    access_token = _auth.create_access_token({"sub": str(user.id), "email": user.email})
    refresh_token = _auth.create_refresh_token({"sub": str(user.id)})
    try:
        _auth._emit_user_login_event(user, db)
        _auth._notify_online_user_login_sync(user, db)
    except Exception as e:
        print(f"⚠️ [VERIFICACAO] evento de login não emitido: {e}")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "verified": True,
        "user": {
            "id": user.id,
            "formatted_id": user.formatted_id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
        },
    }


@router.post("/resend-verification")
def resend_verification(payload: ResendPayload, db: Session = Depends(get_db)):
    """Reenvia o código. A resposta é sempre neutra (não revela se o e-mail existe)."""
    from app.services import email_verification as ev
    r = ev.resend(db, str(payload.email))
    return {"success": True, "sent": r["sent"], "retry_after": r["retry_after"], "limited": bool(r.get("limited"))}
