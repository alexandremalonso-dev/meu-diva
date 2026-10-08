"""
Confirmação de e-mail no cadastro (código de 6 dígitos + link).

- O cadastro público cria a conta como NÃO verificada e envia o código por e-mail.
- O código vale 30 minutos, tem no máximo 5 tentativas e só o hash dele é guardado.
- Reenvio: no mínimo 60 s entre envios e no máximo 5 por hora.
- Quem não confirmou não consegue entrar (o login devolve 403 e reenvia o código).
- Contas que já existiam e as criadas por login social, convite ou painel do admin são verificadas
  por padrão (coluna com DEFAULT now()): só o cadastro público exige o código.
"""
import hashlib
import hmac
import html
import os
import re
import secrets
import threading
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import text

CODE_TTL_MIN = 30
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_S = 60
MAX_SENDS_PER_HOUR = 5
ROLE_LABEL = {"patient": "paciente", "therapist": "terapeuta", "empresa": "empresa"}


def _secret() -> str:
    return os.getenv("SESSION_SECRET") or os.getenv("JWT_SECRET") or "meudiva-email-verification"


def _hash(user_id: int, code: str) -> str:
    return hmac.new(_secret().encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _front_url() -> str:
    return (os.getenv("FRONTEND_URL") or "https://app.meudivaonline.com").rstrip("/")


def mask_email(email: str) -> str:
    nome, _, dominio = (email or "").partition("@")
    return (nome[:1] + "***@" + dominio) if dominio else "seu e-mail"


# ==========================
# E-MAIL
# ==========================
def _html(name: str, code: str, link: str) -> str:
    nome = html.escape((name or "").split(" ")[0] or "")
    saudacao = f"Olá, {nome}!" if nome else "Olá!"
    return f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#333">
  <h2 style="color:#E03673;margin:0 0 8px">Meu Divã</h2>
  <p style="font-size:16px">{saudacao} Falta só um passo para ativar o seu cadastro.</p>
  <p style="margin:20px 0 6px">Seu código de confirmação:</p>
  <p style="font-size:34px;letter-spacing:8px;font-weight:bold;background:#fdf0f5;border-radius:10px;padding:14px;text-align:center;margin:0">{code}</p>
  <p style="margin:24px 0 8px">Ou confirme com um clique:</p>
  <p style="margin:0"><a href="{link}" style="background:#E03673;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:bold">Confirmar meu e-mail</a></p>
  <p style="color:#777;font-size:13px;margin-top:24px">O código vale {CODE_TTL_MIN} minutos. Se você não criou uma conta no Meu Divã, pode ignorar este e-mail.</p>
</div>"""


def _send(to_email: str, name: str, code: str) -> bool:
    try:
        from app.services.email_service import email_service
        link = f"{_front_url()}/auth/verificar-email?email={quote(to_email)}&code={code}"
        ok = bool(email_service._send_email(
            to_email=to_email,
            subject="Confirme seu e-mail no Meu Divã",
            html_content=_html(name, code, link),
        ))
        if not ok:
            print(f"⚠️ [VERIFICACAO] o envio do código para {mask_email(to_email)} não foi confirmado")
        return ok
    except Exception as e:
        print(f"⚠️ [VERIFICACAO] falha ao enviar o código para {mask_email(to_email)}: {e}")
        return False


def _dispatch(to_email: str, name: str, code: str) -> None:
    """Envia em segundo plano: o cadastro não espera o servidor de e-mail."""
    threading.Thread(target=_send, args=(to_email, name, code), daemon=True).start()


# ==========================
# CÓDIGOS
# ==========================
def _issue_code(db, user_id: int, email: str, name: str) -> None:
    """Invalida os códigos anteriores, grava um novo e envia."""
    code = _new_code()
    db.execute(text(
        "UPDATE email_verifications SET expires_at = now() "
        "WHERE user_id = :u AND verified_at IS NULL AND expires_at > now()"
    ), {"u": user_id})
    db.execute(text(
        "INSERT INTO email_verifications (user_id, code_hash, expires_at) "
        "VALUES (:u, :h, now() + (:m || ' minutes')::interval)"
    ), {"u": user_id, "h": _hash(user_id, code), "m": str(CODE_TTL_MIN)})
    db.commit()
    _dispatch(email, name, code)


def _cooldown_left(db, user_id: int) -> int:
    r = db.execute(text(
        "SELECT GREATEST(0, CEIL(:c - EXTRACT(EPOCH FROM (now() - max(created_at))))) "
        "FROM email_verifications WHERE user_id = :u"
    ), {"u": user_id, "c": RESEND_COOLDOWN_S}).scalar()
    return int(r or 0)


def _sends_last_hour(db, user_id: int) -> int:
    return int(db.execute(text(
        "SELECT count(*) FROM email_verifications WHERE user_id = :u AND created_at > now() - interval '1 hour'"
    ), {"u": user_id}).scalar() or 0)


def is_verified(db, user_id: int) -> bool:
    return bool(db.execute(text("SELECT email_verified_at IS NOT NULL FROM users WHERE id = :i"), {"i": user_id}).scalar())


def start_verification(db, user) -> dict:
    """Chamado pelo cadastro público: marca a conta como não verificada e envia o primeiro código."""
    db.execute(text("UPDATE users SET email_verified_at = NULL WHERE id = :i"), {"i": user.id})
    _issue_code(db, user.id, user.email, user.full_name or "")
    print(f"📧 [VERIFICACAO] código enviado para {mask_email(user.email)} (usuário {user.id})")
    return {"verification_required": True, "email": user.email, "expires_in_minutes": CODE_TTL_MIN}


def resend(db, email: str) -> dict:
    """Reenvia o código. Sempre responde de forma neutra para não revelar quais e-mails existem."""
    row = db.execute(text(
        "SELECT id, email, full_name FROM users WHERE lower(email) = lower(:e) AND email_verified_at IS NULL"
    ), {"e": (email or "").strip()}).first()
    if not row:
        return {"sent": False, "retry_after": RESEND_COOLDOWN_S}
    espera = _cooldown_left(db, row.id)
    if espera > 0:
        return {"sent": False, "retry_after": espera}
    if _sends_last_hour(db, row.id) >= MAX_SENDS_PER_HOUR:
        print(f"⚠️ [VERIFICACAO] limite de reenvios por hora atingido ({mask_email(row.email)})")
        return {"sent": False, "retry_after": 3600, "limited": True}
    _issue_code(db, row.id, row.email, row.full_name or "")
    print(f"📧 [VERIFICACAO] código reenviado para {mask_email(row.email)}")
    return {"sent": True, "retry_after": RESEND_COOLDOWN_S}


def verify(db, email: str, code: str) -> int:
    """Confere o código. Devolve o id do usuário confirmado ou levanta HTTPException 400."""
    code = re.sub(r"\D", "", code or "")
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="Digite os 6 números do código.")
    user = db.execute(text(
        "SELECT id, email_verified_at FROM users WHERE lower(email) = lower(:e)"
    ), {"e": (email or "").strip()}).first()
    if not user:
        raise HTTPException(status_code=400, detail="Código incorreto ou expirado.")
    if user.email_verified_at is not None:
        raise HTTPException(status_code=400, detail="Este e-mail já foi confirmado. Faça login.")

    row = db.execute(text(
        "SELECT id, code_hash, attempts FROM email_verifications "
        "WHERE user_id = :u AND verified_at IS NULL AND expires_at > now() "
        "ORDER BY created_at DESC LIMIT 1 FOR UPDATE"
    ), {"u": user.id}).first()
    if not row:
        db.rollback()
        raise HTTPException(status_code=400, detail="Código expirado. Peça um novo código.")
    if row.attempts >= MAX_ATTEMPTS:
        db.rollback()
        raise HTTPException(status_code=400, detail="Muitas tentativas. Peça um novo código.")

    if not hmac.compare_digest(row.code_hash, _hash(user.id, code)):
        db.execute(text("UPDATE email_verifications SET attempts = attempts + 1 WHERE id = :i"), {"i": row.id})
        db.commit()
        restantes = MAX_ATTEMPTS - (row.attempts + 1)
        if restantes <= 0:
            raise HTTPException(status_code=400, detail="Código incorreto. Muitas tentativas: peça um novo código.")
        raise HTTPException(status_code=400, detail=f"Código incorreto. Restam {restantes} tentativa(s).")

    db.execute(text("UPDATE email_verifications SET verified_at = now() WHERE id = :i"), {"i": row.id})
    db.execute(text("UPDATE users SET email_verified_at = now() WHERE id = :i"), {"i": user.id})
    db.commit()
    print(f"✅ [VERIFICACAO] e-mail confirmado (usuário {user.id})")
    return user.id


def require_verified(db, user) -> None:
    """Usado pelo login: conta não confirmada recebe um novo código (se já passou o intervalo) e um 403."""
    if is_verified(db, user.id):
        return
    try:
        resend(db, user.email)
    except Exception as e:
        print(f"⚠️ [VERIFICACAO] não foi possível reenviar o código no login: {e}")
    raise HTTPException(
        status_code=403,
        detail=(f"Confirme seu e-mail para entrar. Enviamos um código para {mask_email(user.email)}. "
                f"Use o link do e-mail ou acesse {_front_url().replace('https://', '')}/auth/verificar-email."),
    )


def handle_existing_unverified(db, existing, payload, request):
    """
    Cadastro com um e-mail que já existe, mas que NUNCA foi confirmado: a nova tentativa assume a conta
    (nome e senha novos, novo código), para ninguém "segurar" o e-mail de outra pessoa.
    Devolve None quando a conta já é verificada (o chamador responde 409 como sempre).
    """
    row = db.execute(text("SELECT email_verified_at, role::text AS role FROM users WHERE id = :i"), {"i": existing.id}).first()
    if row is None or row.email_verified_at is not None:
        return None

    from app.routes import auth as _auth
    pedido = getattr(payload, "role", None)
    try:
        role = _auth._coerce_role(pedido) if pedido is not None else _auth.UserRole.patient
    except Exception:
        return None
    if role.value not in ROLE_LABEL:
        return None
    if role.value != row.role:
        raise HTTPException(
            status_code=409,
            detail=(f"Já existe um cadastro com este e-mail aguardando confirmação (como {ROLE_LABEL.get(row.role, row.role)}). "
                    f"Confirme o e-mail ou use outro endereço."),
        )

    nome = _auth.normalize_full_name(payload.full_name)
    existing.full_name = nome
    existing.password_hash = _auth.get_password_hash(payload.password)
    perfil = None
    if role.value == "patient":
        perfil = db.query(_auth.PatientProfile).filter(_auth.PatientProfile.user_id == existing.id).first()
    elif role.value == "therapist":
        perfil = db.query(_auth.TherapistProfile).filter(_auth.TherapistProfile.user_id == existing.id).first()
    if perfil is not None and hasattr(perfil, "full_name"):
        perfil.full_name = nome or ""
    db.commit()

    if _cooldown_left(db, existing.id) == 0 and _sends_last_hour(db, existing.id) < MAX_SENDS_PER_HOUR:
        _issue_code(db, existing.id, existing.email, nome or "")
    db.refresh(existing)
    print(f"📧 [VERIFICACAO] cadastro pendente reassumido ({mask_email(existing.email)})")
    return {
        "id": existing.id,
        "formatted_id": existing.formatted_id,
        "email": existing.email,
        "full_name": existing.full_name,
        "role": existing.role.value,
        "is_active": existing.is_active,
        "created_at": existing.created_at,
        "verification_required": True,
    }
