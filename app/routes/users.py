from fastapi import APIRouter, Depends, HTTPException, Security, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
import traceback
import json
import secrets
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.services.email_service import email_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    try:
        print(f"📋 GET /users/me - Usuário: {current_user.id} ({current_user.email})")
        
        return {
            "id": current_user.id,
            "formatted_id": current_user.formatted_id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at
        }
    except Exception as e:
        print(f"❌ Erro em GET /users/me: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.patch("/me", response_model=UserOut)
def update_current_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        print(f"📝 PATCH /users/me - Usuário: {current_user.id}")
        
        if user_update.full_name is not None:
            current_user.full_name = user_update.full_name
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "id": current_user.id,
            "formatted_id": current_user.formatted_id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at
        }
    except Exception as e:
        print(f"❌ Erro em PATCH /users/me: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.get("", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = None,
):
    try:
        print(f"📋 GET /users - Admin: {current_user.id}")
        
        query = select(User)
        
        if role:
            query = query.where(User.role == role)
        
        users = db.execute(
            query.offset(skip).limit(limit)
        ).scalars().all()
        
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "formatted_id": user.formatted_id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value,
                "is_active": user.is_active,
                "created_at": user.created_at
            })
        return result
    except Exception as e:
        print(f"❌ Erro em GET /users: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    try:
        print(f"📋 GET /users/{user_id} - Admin: {current_user.id}")
        
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        return {
            "id": user.id,
            "formatted_id": user.formatted_id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em GET /users/{user_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    role: UserRole,
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.admin])),
):
    try:
        print(f"📝 PATCH /users/{user_id}/role - Admin: {current_user.id}")
        
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        user.role = role
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em PATCH /users/{user_id}/role: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
    

# ==========================
# EXCLUSÃO DE CONTA COM CÓDIGO
# ==========================

def generate_deletion_code() -> str:
    """Gera código de 6 dígitos para exclusão de conta"""
    return str(secrets.randbelow(900000) + 100000)


def send_deletion_code_email(to_email: str, code: str):
    """Envia e-mail com código de confirmação de exclusão"""
    subject = "Confirme a exclusão da sua conta - Meu Divã"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #E03673;">Confirme a exclusão da sua conta</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para excluir permanentemente sua conta no Meu Divã.</p>
        <p>Seu código de verificação é:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px;">
            {code}
        </div>
        <p>Este código é válido por <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou esta exclusão, ignore este e-mail.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Atenciosamente,<br>Equipe Meu Divã</p>
    </body>
    </html>
    """
    email_service._send_email(to_email, subject, body)


@router.post("/me/delete-request")
def request_account_deletion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicita exclusão da conta - envia código por e-mail"""
    try:
        print(f"🗑️ DELETE REQUEST - Usuário: {current_user.id} ({current_user.email})")
        
        if current_user.deletion_status == "pending_deletion":
            raise HTTPException(status_code=400, detail="Solicitação de exclusão já pendente")
        
        code = generate_deletion_code()
        expires_at = datetime.now() + timedelta(minutes=15)
        
        current_user.deletion_code = code
        current_user.deletion_code_expires_at = expires_at
        current_user.deletion_status = "pending_deletion"
        current_user.deletion_requested_at = datetime.now()
        current_user.deletion_scheduled_for = datetime.now() + timedelta(days=30)
        
        db.commit()
        
        try:
            send_deletion_code_email(current_user.email, code)
        except Exception as e:
            print(f"❌ Erro ao enviar e-mail: {e}")
            raise HTTPException(status_code=500, detail="Erro ao enviar código de verificação")
        
        return {
            "success": True,
            "message": "Código de verificação enviado para seu e-mail. Ele expira em 15 minutos.",
            "expires_in_minutes": 15
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em DELETE REQUEST: {str(e)}")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao solicitar exclusão: {str(e)}")


@router.post("/me/delete-confirm")
async def confirm_account_deletion(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirma exclusão da conta com código recebido por e-mail"""
    try:
        body_bytes = await request.body()
        if not body_bytes:
            raise HTTPException(status_code=400, detail="Corpo da requisição vazio")
        
        body = json.loads(body_bytes.decode('utf-8'))
        code = body.get("code")
        
        if not code:
            raise HTTPException(status_code=400, detail="Código de verificação é obrigatório")
        
        print(f"🗑️ DELETE CONFIRM - Usuário: {current_user.id} ({current_user.email}) - Código: {code}")
        
        if current_user.deletion_code != code:
            raise HTTPException(status_code=400, detail="Código de verificação inválido")
        
        if current_user.deletion_code_expires_at < datetime.now():
            raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo código.")
        
        current_user.deletion_confirmed_at = datetime.now()
        current_user.deletion_code = None
        current_user.deletion_code_expires_at = None
        
        db.commit()
        
        return {
            "success": True,
            "message": "Confirmação registrada. Sua conta será excluída permanentemente em 30 dias.",
            "scheduled_for": current_user.deletion_scheduled_for.isoformat()
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler dados: {str(e)}")
    except Exception as e:
        print(f"❌ Erro em DELETE CONFIRM: {str(e)}")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao confirmar exclusão: {str(e)}")


@router.post("/me/delete-cancel")
def cancel_account_deletion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancela a solicitação de exclusão da conta"""
    try:
        print(f"🗑️ DELETE CANCEL - Usuário: {current_user.id} ({current_user.email})")
        
        if current_user.deletion_status != "pending_deletion":
            raise HTTPException(status_code=400, detail="Não há solicitação de exclusão pendente")
        
        current_user.deletion_status = "active"
        current_user.deletion_requested_at = None
        current_user.deletion_scheduled_for = None
        current_user.deletion_confirmed_at = None
        current_user.deletion_code = None
        current_user.deletion_code_expires_at = None
        
        db.commit()
        
        return {
            "success": True,
            "message": "Solicitação de exclusão cancelada. Sua conta está segura."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Erro em DELETE CANCEL: {str(e)}")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cancelar exclusão: {str(e)}")


@router.get("/me/delete-status")
def get_deletion_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verifica o status da solicitação de exclusão"""
    try:
        return {
            "deletion_status": current_user.deletion_status or "active",
            "deletion_requested_at": current_user.deletion_requested_at.isoformat() if current_user.deletion_requested_at else None,
            "deletion_scheduled_for": current_user.deletion_scheduled_for.isoformat() if current_user.deletion_scheduled_for else None,
            "deletion_confirmed_at": current_user.deletion_confirmed_at.isoformat() if current_user.deletion_confirmed_at else None,
            "code_expires_in": (current_user.deletion_code_expires_at - datetime.now()).seconds // 60 if current_user.deletion_code_expires_at else None
        }
        
    except Exception as e:
        print(f"❌ Erro em DELETE STATUS: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao verificar status: {str(e)}")