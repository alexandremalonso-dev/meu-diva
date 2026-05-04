from fastapi import APIRouter, Depends, HTTPException, Request, Response, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from jose import jwt
from pydantic import BaseModel, EmailStr
import json
import traceback
import secrets
import asyncio
from datetime import datetime, timedelta
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.therapist_profile import TherapistProfile
from app.schemas.auth import RegisterRequest, LoginRequest
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.core.roles import UserRole
from app.dependencies import get_current_user
from app.services.email_service import email_service
from app.services.notification_service import NotificationService

# OAuth imports
from authlib.integrations.starlette_client import OAuthError
from app.core.oauth import oauth, get_google_user_info, get_microsoft_user_info

# WebSocket events (Monitor - existing tab)
from app.core.events import EventType, create_event
from app.routes.ws_events import emit_event

router = APIRouter(prefix="/auth", tags=["auth"])

# Temporary storage for codes (use Redis in production)
email_verification_codes = {}
password_reset_codes = {}


# ==========================
# PYDANTIC SCHEMAS
# ==========================

class ForgotPasswordPayload(BaseModel):
    email: EmailStr

class ResetPasswordPayload(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class RequestEmailChangePayload(BaseModel):
    new_email: EmailStr

class VerifyEmailChangePayload(BaseModel):
    code: str

class DeletionCodeRequest(BaseModel):
    code: str


# ==========================
# HELPERS
# ==========================

def _coerce_role(value) -> UserRole:
    if value is None:
        return UserRole.patient
    if isinstance(value, UserRole):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        try:
            return UserRole(v)
        except Exception:
            pass
    raise HTTPException(status_code=422, detail="role invalido. Use: patient | therapist | admin")


def generate_verification_code() -> str:
    return str(secrets.randbelow(900000) + 100000)


def send_verification_email(to_email: str, code: str, new_email: str):
    subject = "Confirme sua alteracao de e-mail - Meu Diva"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E03673;">Confirme sua alteracao de e-mail</h2>
        <p>Ola,</p>
        <p>Recebemos uma solicitacao para alterar seu e-mail para: <strong>{new_email}</strong></p>
        <p>Seu codigo de verificacao e:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 8px;">
            {code}
        </div>
        <p>Este codigo e valido por <strong>15 minutos</strong>.</p>
        <p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Atenciosamente,<br>Equipe Meu Diva</p>
    </body>
    </html>
    """
    email_service._send_email(to_email, subject, body)


def send_password_reset_email(to_email: str, code: str):
    subject = "Redefinicao de senha - Meu Diva"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E03673;">Redefinicao de senha</h2>
        <p>Ola,</p>
        <p>Recebemos uma solicitacao para redefinir sua senha.</p>
        <p>Seu codigo de verificacao e:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 8px;">
            {code}
        </div>
        <p>Este codigo e valido por <strong>15 minutos</strong>.</p>
        <p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Atenciosamente,<br>Equipe Meu Diva</p>
    </body>
    </html>
    """
    email_service._send_email(to_email, subject, body)


def _emit_user_login_event(user: User, db: Session):
    try:
        event = create_event(
            event_type=EventType.USER_LOGGED_IN,
            payload={
                "user_id": user.id,
                "user_formatted_id": user.formatted_id,
                "user_name": user.full_name or user.email,
                "user_email": user.email,
                "user_role": user.role.value,
                "timestamp": datetime.now().isoformat()
            },
            target_roles=["admin"]
        )
        emit_event(event)
    except Exception as e:
        print(f"[Monitor] Error emitting login event: {e}")


def _emit_user_logout_event(user: User, db: Session):
    try:
        event = create_event(
            event_type=EventType.USER_LOGGED_OUT,
            payload={
                "user_id": user.id,
                "user_formatted_id": user.formatted_id,
                "user_name": user.full_name or user.email,
                "user_email": user.email,
                "user_role": user.role.value,
                "timestamp": datetime.now().isoformat()
            },
            target_roles=["admin"]
        )
        emit_event(event)
    except Exception as e:
        print(f"[Monitor] Error emitting logout event: {e}")


def _notify_online_user_login_sync(user: User, db: Session):
    try:
        from app.routes.ws_online import notify_user_online
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(notify_user_online(
                user_id=user.id,
                user_name=user.full_name or user.email,
                user_email=user.email,
                user_role=user.role.value,
                db=db
            ))
        finally:
            loop.close()
    except Exception as e:
        print(f"[Online] Error notifying login: {e}")
        traceback.print_exc()


def _notify_online_user_logout_sync(user: User):
    try:
        from app.routes.ws_online import notify_user_offline
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(notify_user_offline(
                user_id=user.id,
                user_name=user.full_name or user.email,
                user_email=user.email,
                user_role=user.role.value
            ))
        finally:
            loop.close()
    except Exception as e:
        print(f"[Online] Error notifying logout: {e}")
        traceback.print_exc()


# ==========================
# REGISTER / LOGIN / REFRESH / LOGOUT
# ==========================

@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=409, detail="Email ja cadastrado")

    role = UserRole.patient
    requested_role = getattr(payload, "role", None)
    if requested_role is not None:
        role = _coerce_role(requested_role)

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=get_password_hash(payload.password),
        role=role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    try:
        if role == UserRole.patient:
            patient_profile = PatientProfile(
                user_id=user.id,
                full_name=payload.full_name or "",
                email=payload.email,
                timezone="America/Sao_Paulo",
                preferred_language="pt-BR"
            )
            db.add(patient_profile)
        elif role == UserRole.therapist:
            therapist_profile = TherapistProfile(
                user_id=user.id,
                full_name=payload.full_name or "",
                session_price=None,
                session_duration_30min=True,
                session_duration_50min=True
            )
            db.add(therapist_profile)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating profile: {str(e)}")

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "formatted_id": user.formatted_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
        "created_at": user.created_at
    }


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciais invalidas")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    _emit_user_login_event(user, db)
    _notify_online_user_login_sync(user, db)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "formatted_id": user.formatted_id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value
        }
    }


@router.post("/refresh")
async def refresh_token(request: Request, db: Session = Depends(get_db)):
    refresh_token = None
    try:
        body = await request.json()
        refresh_token = body.get("refresh_token")
    except:
        pass

    if not refresh_token:
        refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    try:
        payload = jwt.decode(refresh_token, settings.jwt_secret, algorithms=["HS256"])

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.get(User, int(user_id))
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        new_access_token = create_access_token({"sub": str(user.id), "email": user.email})
        return {"access_token": new_access_token}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/me")
def get_current_user_route(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "formatted_id": current_user.formatted_id,
        "email": current_user.email,
        "role": current_user.role.value,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    response.delete_cookie("refresh_token")
    _emit_user_logout_event(current_user, db)
    _notify_online_user_logout_sync(current_user)
    return {"message": "Logout realizado com sucesso"}


# ==========================
# EMAIL CHANGE WITH VERIFICATION
# ==========================

@router.post("/request-email-change")
def request_email_change(
    payload: RequestEmailChangePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import re
    new_email = payload.new_email

    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, new_email):
        raise HTTPException(status_code=400, detail="E-mail inválido")

    existing_user = db.query(User).filter(User.email == new_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso")

    code = generate_verification_code()
    email_verification_codes[current_user.id] = {
        "code": code,
        "new_email": new_email,
        "expires_at": datetime.now() + timedelta(minutes=15)
    }

    try:
        send_verification_email(current_user.email, code, new_email)
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar e-mail: {str(e)}")

    return {"success": True, "message": "Código enviado para seu e-mail atual"}


@router.post("/verify-email-change")
def verify_email_change(
    payload: VerifyEmailChangePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    code = payload.code
    old_email = current_user.email

    stored = email_verification_codes.get(current_user.id)
    if not stored:
        raise HTTPException(status_code=400, detail="Nenhuma solicitação encontrada")

    if datetime.now() > stored["expires_at"]:
        del email_verification_codes[current_user.id]
        raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo")

    if stored["code"] != code:
        raise HTTPException(status_code=400, detail="Código inválido")

    new_email = stored["new_email"]
    current_user.email = new_email
    db.commit()

    try:
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if patient_profile:
            patient_profile.email = new_email
            db.commit()
    except:
        pass

    notification_service = NotificationService(db)
    notification_service.create_notification(
        user_id=current_user.id,
        notification_type="email_changed",
        title="E-mail alterado",
        message=f"Seu e-mail foi alterado de {old_email} para {new_email}",
        data={"old_email": old_email, "new_email": new_email},
        action_link="/profile"
    )

    del email_verification_codes[current_user.id]
    return {"success": True, "message": "E-mail alterado com sucesso", "new_email": new_email}


# ==========================
# PASSWORD RESET
# ==========================

@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordPayload,
    db: Session = Depends(get_db)
):
    email = payload.email

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"success": True, "message": "Se o e-mail existir, um código será enviado"}

    code = generate_verification_code()
    password_reset_codes[user.id] = {
        "code": code,
        "expires_at": datetime.now() + timedelta(minutes=15)
    }

    try:
        send_password_reset_email(email, code)
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar e-mail: {str(e)}")

    return {"success": True, "message": "Código enviado para seu e-mail"}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordPayload,
    db: Session = Depends(get_db)
):
    email = payload.email
    code = payload.code
    new_password = payload.new_password

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter pelo menos 6 caracteres")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    stored = password_reset_codes.get(user.id)
    if not stored:
        raise HTTPException(status_code=400, detail="Nenhuma solicitação de redefinição encontrada")

    if datetime.now() > stored["expires_at"]:
        del password_reset_codes[user.id]
        raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo")

    if stored["code"] != code:
        raise HTTPException(status_code=400, detail="Código inválido")

    user.password_hash = get_password_hash(new_password)
    db.commit()

    notification_service = NotificationService(db)
    notification_service.create_notification(
        user_id=user.id,
        notification_type="password_reset",
        title="Senha alterada",
        message="Sua senha foi alterada com sucesso. Se não foi você, entre em contato.",
        data={},
        action_link="/profile"
    )

    del password_reset_codes[user.id]
    return {"success": True, "message": "Senha redefinida com sucesso"}


# ==========================
# DELETE ACCOUNT WITH VERIFICATION
# ==========================

account_deletion_codes = {}

@router.post("/request-account-deletion")
async def request_account_deletion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    code = generate_verification_code()
    account_deletion_codes[current_user.id] = {
        "code": code,
        "expires_at": datetime.now() + timedelta(minutes=15)
    }

    subject = "Código para exclusão da conta - Meu Divã"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2 style="color: #E03673;">Confirmação de exclusão de conta</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para excluir permanentemente sua conta no Meu Divã.</p>
        <p>Seu código de verificação é:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; border-radius: 8px;">
            {code}
        </div>
        <p>Este código é válido por <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou esta exclusão, ignore este e-mail.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Meu Divã - Cuidado que Acolhe</p>
    </body>
    </html>
    """
    email_service._send_email(current_user.email, subject, body)
    return {"success": True, "message": "Código enviado para seu e-mail"}


@router.post("/confirm-account-deletion")
async def confirm_account_deletion(
    payload: DeletionCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    code = payload.code

    stored = account_deletion_codes.get(current_user.id)
    if not stored:
        raise HTTPException(status_code=400, detail="Nenhuma solicitação de exclusão encontrada")

    if datetime.now() > stored["expires_at"]:
        del account_deletion_codes[current_user.id]
        raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo")

    if stored["code"] != code:
        raise HTTPException(status_code=400, detail="Código inválido")

    user_id = current_user.id
    user_email = current_user.email
    user_role = current_user.role

    current_user.email = f"deleted_{user_id}@deleted.com"
    current_user.full_name = "Usuário Deletado"
    current_user.is_active = False
    current_user.password_hash = None

    if user_role == UserRole.patient:
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == user_id).first()
        if patient_profile:
            patient_profile.full_name = "Usuário Deletado"
            patient_profile.email = f"deleted_{user_id}@deleted.com"
            patient_profile.phone = None
            patient_profile.foto_url = None
            patient_profile.birth_date = None
            patient_profile.cpf = None
            patient_profile.address = None

    elif user_role == UserRole.therapist:
        therapist_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == user_id).first()
        if therapist_profile:
            therapist_profile.full_name = "Usuário Deletado"
            therapist_profile.bio = None
            therapist_profile.phone = None
            therapist_profile.foto_url = None
            therapist_profile.cnpj = None
            therapist_profile.cpf = None
            therapist_profile.bank_agency = None
            therapist_profile.bank_account = None
            therapist_profile.pix_key = None
            therapist_profile.instagram_url = None

    db.commit()
    del account_deletion_codes[current_user.id]

    print(f"✅ Conta {user_email} (ID: {user_id}) foi deletada/anonimizada com sucesso")
    return {"success": True, "message": "Sua conta foi excluída permanentemente"}


# ==========================
# GOOGLE LOGIN
# ==========================

@router.get("/google/login")
async def google_login(request: Request):
    if not oauth.google:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    import os
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "https://meudiva-api-backend-592671373665.southamerica-east1.run.app/api/auth/google/callback"
    )
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not oauth.google:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = await get_google_user_info(token["access_token"])

        email = user_info.get("email")
        full_name = user_info.get("name", email)

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        user = db.query(User).filter(User.email == email).first()
        is_new_user = False

        if not user:
            is_new_user = True
            user = User(email=email, full_name=full_name, role=UserRole.patient, is_active=True, password_hash=None)
            db.add(user)
            db.flush()
            db.add(PatientProfile(user_id=user.id, full_name=full_name, email=email, timezone="America/Sao_Paulo", preferred_language="pt-BR"))
            db.commit()
            db.refresh(user)

        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        _emit_user_login_event(user, db)
        _notify_online_user_login_sync(user, db)

        if is_new_user:
            NotificationService(db).create_notification(
                user_id=user.id, notification_type="welcome",
                title="Welcome to Meu Diva!",
                message="Your registration was successful via Google. Explore the platform and start your emotional care journey.",
                action_link="/dashboard"
            )

        return RedirectResponse(url=f"{settings.FRONTEND_URL}/oauth-callback?access_token={access_token}&refresh_token={refresh_token}")

    except OAuthError as e:
        raise HTTPException(status_code=400, detail=f"Google authentication error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error in Google callback: {e}")
        raise HTTPException(status_code=500, detail="Internal error processing Google login")


# ==========================
# MICROSOFT LOGIN
# ==========================

@router.get("/microsoft/login")
async def microsoft_login(request: Request):
    if not oauth.microsoft:
        raise HTTPException(status_code=503, detail="Microsoft OAuth not configured")
    redirect_uri = request.url_for("microsoft_callback")
    return await oauth.microsoft.authorize_redirect(request, redirect_uri)


@router.get("/microsoft/callback")
async def microsoft_callback(request: Request, db: Session = Depends(get_db)):
    if not oauth.microsoft:
        raise HTTPException(status_code=503, detail="Microsoft OAuth not configured")

    try:
        token = await oauth.microsoft.authorize_access_token(request)
        user_info = await get_microsoft_user_info(token["access_token"])

        email = user_info.get("email") or user_info.get("userPrincipalName")
        full_name = user_info.get("displayName", email)

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Microsoft")

        user = db.query(User).filter(User.email == email).first()
        is_new_user = False

        if not user:
            is_new_user = True
            user = User(email=email, full_name=full_name, role=UserRole.patient, is_active=True, password_hash=None)
            db.add(user)
            db.flush()
            db.add(PatientProfile(user_id=user.id, full_name=full_name, email=email, timezone="America/Sao_Paulo", preferred_language="pt-BR"))
            db.commit()
            db.refresh(user)

        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        _emit_user_login_event(user, db)
        _notify_online_user_login_sync(user, db)

        if is_new_user:
            NotificationService(db).create_notification(
                user_id=user.id, notification_type="welcome",
                title="Welcome to Meu Diva!",
                message="Your registration was successful via Microsoft. Explore the platform and start your emotional care journey.",
                action_link="/dashboard"
            )

        return RedirectResponse(url=f"{settings.FRONTEND_URL}/oauth-callback?access_token={access_token}&refresh_token={refresh_token}")

    except OAuthError as e:
        raise HTTPException(status_code=400, detail=f"Microsoft authentication error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error in Microsoft callback: {e}")
        raise HTTPException(status_code=500, detail="Internal error processing Microsoft login")


# ==========================
# APPLE LOGIN
# ==========================

@router.post("/apple/callback")
async def apple_callback(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        identity_token = body.get("identity_token")
        given_name = body.get("given_name")
        family_name = body.get("family_name")
        apple_email = body.get("email")

        if not identity_token:
            raise HTTPException(status_code=400, detail="identity_token is required")

        import base64
        import json as json_lib

        parts = identity_token.split(".")
        if len(parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid identity token")

        payload_b64 = parts[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        apple_payload = json_lib.loads(base64.urlsafe_b64decode(payload_b64))

        email = apple_payload.get("email") or apple_email
        apple_user_id = apple_payload.get("sub")

        if not email and not apple_user_id:
            raise HTTPException(status_code=400, detail="Could not extract user info from Apple token")

        if not email:
            email = f"apple_{apple_user_id}@privaterelay.appleid.com"

        full_name = None
        if given_name or family_name:
            full_name = f"{given_name or ''} {family_name or ''}".strip()

        user = db.query(User).filter(User.email == email).first()
        is_new_user = False

        if not user:
            is_new_user = True
            user = User(email=email, full_name=full_name or email.split("@")[0], role=UserRole.patient, is_active=True, password_hash=None)
            db.add(user)
            db.flush()
            db.add(PatientProfile(user_id=user.id, full_name=full_name or email.split("@")[0], email=email, timezone="America/Sao_Paulo", preferred_language="pt-BR"))
            db.commit()
            db.refresh(user)
        elif full_name and not user.full_name:
            user.full_name = full_name
            db.commit()

        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token_val = create_refresh_token({"sub": str(user.id)})

        _emit_user_login_event(user, db)
        _notify_online_user_login_sync(user, db)

        if is_new_user:
            NotificationService(db).create_notification(
                user_id=user.id, notification_type="welcome",
                title="Bem-vindo ao Meu Divã!",
                message="Seu cadastro foi realizado com sucesso via Apple. Explore a plataforma!",
                action_link="/dashboard"
            )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token_val,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "formatted_id": user.formatted_id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in Apple callback: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal error processing Apple login")