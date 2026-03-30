from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from jose import jwt
import json
import traceback

from app.db.database import get_db
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.therapist_profile import TherapistProfile
from app.schemas.auth import RegisterRequest, LoginRequest
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.core.roles import UserRole
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


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
    raise HTTPException(status_code=422, detail="role inválido. Use: patient | therapist | admin")


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    print(f"\n📝 Criando novo usuário: {payload.email}")
    
    existing = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=409, detail="Email já cadastrado")

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

    # Criar perfil baseado na role
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
            print(f"✅ Perfil de paciente criado para usuário {user.id}")
        elif role == UserRole.therapist:
            therapist_profile = TherapistProfile(
                user_id=user.id,
                full_name=payload.full_name or "",
                session_price=None,
                session_duration_30min=True,
                session_duration_50min=True
            )
            db.add(therapist_profile)
            print(f"✅ Perfil de terapeuta criado para usuário {user.id}")
    except Exception as e:
        print(f"❌ Erro ao criar perfil: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar perfil: {str(e)}")

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
    print("\n🔐 ========== LOGIN ==========")
    print(f"📧 Email: {payload.email}")

    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    print(f"✅ Usuário autenticado: ID {user.id}, Role {user.role}")

    access_token = create_access_token(
        {"sub": str(user.id), "email": user.email}
    )
    refresh_token = create_refresh_token(
        {"sub": str(user.id)}
    )

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
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    print("\n🔄 POST /auth/refresh")

    refresh_token = None
    try:
        body = await request.json()
        refresh_token = body.get("refresh_token")
    except:
        pass

    if not refresh_token:
        refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token não encontrado")

    try:
        payload = jwt.decode(refresh_token, settings.jwt_secret, algorithms=["HS256"])

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")

        user = db.get(User, int(user_id))
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")

        new_access_token = create_access_token(
            {"sub": str(user.id), "email": user.email}
        )

        return {"access_token": new_access_token}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail="Refresh token inválido")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno no servidor")


@router.get("/me")
def get_current_user_route(
    current_user: User = Depends(get_current_user)
):
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
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logout realizado com sucesso"}