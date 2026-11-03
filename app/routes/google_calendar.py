"""
Integração Google Calendar — terapeuta conecta sua conta pessoal
e sessões confirmadas/reagendadas/canceladas são sincronizadas.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
import json
import os
from datetime import datetime, timezone

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.appointment import Appointment
from app.models.patient_profile import PatientProfile

router = APIRouter(prefix="/google-calendar", tags=["google-calendar"])

# ── Credenciais OAuth (do client_secret JSON enviado) ──────────────────────
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")  # asaas-google-credenciais: o MESMO cliente do login com Google (o cliente dedicado do calendario foi desativado)
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

# 🔥 CORRIGIDO: Usa BACKEND_URL do environment
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
REDIRECT_URI = os.environ.get(
    "GOOGLE_CALENDAR_REDIRECT_URI",
    f"{BACKEND_URL}/api/google-calendar/callback"
)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

SCOPES = "openid email https://www.googleapis.com/auth/calendar.events"  # asaas-agenda: openid+email (nao sensiveis) so para mostrar QUAL conta do Google esta conectada

# Validação para garantir que as chaves existem
if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    print("⚠️ Google Calendar: credenciais não configuradas")

# =============================================================
# asaas-google-seguranca: STATE do OAuth aleatorio, assinado, com validade e de USO UNICO.
# Antes o state era so o numero do usuario e o callback nao conferia quem era: qualquer um ligava a PROPRIA agenda ao perfil de um terapeuta.
# =============================================================
def _segredo_state() -> bytes:
    seg = os.environ.get("SESSION_SECRET") or os.environ.get("JWT_SECRET")
    if not seg:
        raise HTTPException(status_code=503, detail="Integração indisponível no momento.")
    return seg.encode()


def _assinar_state(corpo: str) -> str:
    import hashlib, hmac
    return hmac.new(_segredo_state(), corpo.encode(), hashlib.sha256).hexdigest()[:16]


def _gerar_state(user_id: int, db: Session) -> str:
    import secrets, time
    from sqlalchemy import text
    corpo = f"{int(user_id)}.{int(time.time()):x}.{secrets.token_urlsafe(9)}"
    state = f"gc.{corpo}.{_assinar_state(corpo)}"
    db.execute(text("DELETE FROM oauth_states WHERE state LIKE 'gc.%' AND created_at < now() - interval '1 day'"))
    db.execute(text("INSERT INTO oauth_states (state, created_at) VALUES (:s, now())"), {"s": state})
    db.commit()
    return state


def _validar_state(state: str, db: Session) -> int:
    import hmac, time
    from sqlalchemy import text
    partes = (state or "").split(".")
    invalido = HTTPException(status_code=400, detail="State inválido ou expirado")
    if len(partes) != 5 or partes[0] != "gc" or not partes[1].isdigit():
        raise invalido
    corpo = ".".join(partes[1:4])
    if not hmac.compare_digest(partes[4], _assinar_state(corpo)):
        raise invalido
    try:
        criado = int(partes[2], 16)
    except ValueError:
        raise invalido
    if not (0 <= time.time() - criado <= 900):
        raise invalido
    usado = db.execute(text("DELETE FROM oauth_states WHERE state = :s RETURNING 1"), {"s": state}).first()
    db.commit()
    if not usado:
        raise invalido
    return int(partes[1])


# ==========================
# HELPERS
# ==========================
def _get_google_auth_url(state: str) -> str:
    """Monta a URL de autorização do Google."""
    from urllib.parse import urlencode
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


async def _exchange_code_for_tokens(code: str) -> dict:
    """Troca o authorization code por access + refresh token."""
    import httpx
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            }
        )
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Erro OAuth Google: {res.text}")
        return res.json()


async def _refresh_access_token(refresh_token: str) -> str:
    """Usa o refresh token para obter um novo access token."""
    import httpx
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "refresh_token": refresh_token,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
            }
        )
        if res.status_code != 200:
            try:
                erro_google = (res.json() or {}).get("error", "")
            except Exception:
                erro_google = ""
            if erro_google in ("invalid_grant", "invalid_client", "unauthorized_client", "disabled_client"):
                raise HTTPException(status_code=401, detail="Refresh token inválido")  # recusa DEFINITIVA: a conexao nao vale mais
            raise HTTPException(status_code=503, detail="Google indisponível agora")  # erro temporario: nao desconecta ninguem
        return res.json()["access_token"]


async def _get_valid_access_token(profile: TherapistProfile, db: Session) -> str:
    """Retorna access token válido, renovando se necessário."""
    if not profile.google_calendar_token:
        raise HTTPException(status_code=400, detail="Google Calendar não conectado")

    token_data = profile.google_calendar_token
    if isinstance(token_data, str):
        token_data = json.loads(token_data)

    expires_at = token_data.get("expires_at", 0)
    now_ts = datetime.now(timezone.utc).timestamp()

    if now_ts >= expires_at - 60:
        try:
            new_access = await _refresh_access_token(token_data["refresh_token"])
        except HTTPException as e:
            if e.status_code == 401:  # asaas-google-seguranca: o Google recusou a renovacao: a tela deve pedir para RECONECTAR (nao mostrar "Conectado")
                token_data["erro"] = "reconectar"
                profile.google_calendar_enabled = False
                profile.google_calendar_token = token_data
                db.commit()
            raise
        import httpx
        async with httpx.AsyncClient() as client:
            info = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"access_token": new_access}
            )
        new_expires = now_ts + int(info.json().get("expires_in", 3600))
        token_data["access_token"] = new_access
        token_data["expires_at"] = new_expires

        profile.google_calendar_token = token_data
        db.commit()

    return token_data["access_token"]


async def _upsert_calendar_event(
    access_token: str,
    appointment: Appointment,
    patient_name: str,
    therapist_name: str,
    meet_url: str | None,
    calendar_event_id: str | None = None
) -> str | None:
    """Cria ou atualiza um evento no Google Calendar do terapeuta."""
    import httpx

    starts = appointment.starts_at
    ends = appointment.ends_at
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=timezone.utc)

    event_body = {
        "summary": f"Sessão com {patient_name}",
        "description": (
            f"Sessão de terapia — Meu Divã\n"
            f"Paciente: {patient_name}\n"
            f"Terapeuta: {therapist_name}\n"
            + (f"Link Meet: {meet_url}" if meet_url else "")
        ),
        "start": {"dateTime": starts.isoformat(), "timeZone": "America/Sao_Paulo"},
        "end": {"dateTime": ends.isoformat(), "timeZone": "America/Sao_Paulo"},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 30}]},
    }
    if meet_url:
        event_body["location"] = meet_url
    _cor_evento = os.environ.get("GOOGLE_CALENDAR_EVENT_COLOR_ID", "4")  # asaas-cor-calendario: 4 = Flamingo (o rosa mais proximo da marca; a API so aceita as cores 1 a 11). Vazio = cor da agenda
    if _cor_evento in [str(_i) for _i in range(1, 12)]:
        event_body["colorId"] = _cor_evento

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        if calendar_event_id:
            res = await client.put(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{calendar_event_id}",
                headers=headers,
                json=event_body,
            )
        else:
            res = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers=headers,
                json=event_body,
            )

    if res.status_code in (404, 410) and calendar_event_id:
        # asaas-agenda: o evento foi apagado na agenda do Google: cria de novo em vez de desistir para sempre
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers=headers,
                json=event_body,
            )

    if res.status_code in (200, 201):
        appointment._gcal_ok = True
        return res.json().get("id")
    try:
        _err = (res.json() or {}).get("error") or {}
        _motivo = (_err.get("errors") or [{}])[0].get("reason") or _err.get("message") or ""
    except Exception:
        _motivo = ""
    appointment._gcal_erro = f"o Google respondeu {res.status_code} ({str(_motivo)[:80]})"
    print(f"⚠️ Google Calendar erro {res.status_code}: {res.text[:200]}")
    return None


async def _delete_calendar_event(access_token: str, calendar_event_id: str):
    """Remove um evento do Google Calendar."""
    import httpx
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.delete(
            f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{calendar_event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if res.status_code not in (204, 410):
        print(f"⚠️ Erro ao deletar evento GCal: {res.status_code}")


# ==========================
# FUNÇÃO PÚBLICA — chamada pelo appointments.py
# ==========================
async def sync_appointment_to_calendar(
    appointment: Appointment,
    action: str,
    db: Session
):
    """
    Sincroniza um appointment com o Google Calendar do terapeuta.
    Chamada a partir do update_appointment_status.
    """
    try:
        profile = db.execute(
            select(TherapistProfile).where(TherapistProfile.user_id == appointment.therapist_user_id)
        ).scalar_one_or_none()

        if not profile or not profile.google_calendar_enabled or not profile.google_calendar_token:
            return

        patient_profile = db.execute(
            select(PatientProfile).where(PatientProfile.user_id == appointment.patient_user_id)
        ).scalar_one_or_none()
        patient_name = (patient_profile.full_name if patient_profile else f"Paciente #{appointment.patient_user_id}")
        if not os.environ.get("GOOGLE_CALENDAR_NOME_COMPLETO"):  # asaas-agenda: o evento vai para o celular e a tela bloqueada do terapeuta: so o PRIMEIRO nome do paciente
            patient_name = ((patient_name or "Paciente").split() or ["Paciente"])[0]

        therapist_name = profile.full_name or "Terapeuta"
        meet_url = appointment.video_call_url

        access_token = await _get_valid_access_token(profile, db)

        existing_event_id = getattr(appointment, "google_calendar_event_id", None)

        if action == "cancel":
            if existing_event_id:
                await _delete_calendar_event(access_token, existing_event_id)
                appointment.google_calendar_event_id = None
                db.commit()
            return

        event_id = await _upsert_calendar_event(
            access_token, appointment, patient_name, therapist_name, meet_url, existing_event_id
        )
        if event_id and event_id != existing_event_id:
            appointment.google_calendar_event_id = event_id
            db.commit()
            print(f"✅ GCal sync: evento {event_id} para sessão {appointment.id}")

    except Exception as e:
        print(f"⚠️ GCal sync ignorado (não crítico): {e}")
        appointment._gcal_erro = str(getattr(e, "detail", e))[:200]  # asaas-agenda: guarda o motivo para o botao Sincronizar mostrar


# ==========================
# ROTAS
# ==========================

@router.get("/status")
def get_calendar_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Retorna se o terapeuta tem o Google Calendar conectado."""
    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    connected = bool(profile.google_calendar_enabled and profile.google_calendar_token)
    token_data = profile.google_calendar_token or {}
    if isinstance(token_data, str):
        try:
            token_data = json.loads(token_data)
        except Exception:
            token_data = {}

    return {
        "connected": connected,
        "email": token_data.get("email"),
        "precisa_reconectar": bool(token_data.get("erro") == "reconectar"),
    }


@router.get("/connect")
def connect_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Inicia o fluxo OAuth — redireciona para o Google."""
    state = _gerar_state(current_user.id, db)  # asaas-google-seguranca
    auth_url = _get_google_auth_url(state)
    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """Recebe o callback do Google, troca o code por tokens e salva."""
    user_id = _validar_state(state, db)  # asaas-google-seguranca: o state precisa ser o que NOS geramos (assinado, recente e de uso unico)

    tokens = await _exchange_code_for_tokens(code)

    import httpx
    async with httpx.AsyncClient() as client:
        info_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
    email = info_res.json().get("email", "") if info_res.status_code == 200 else ""

    expires_at = datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600)

    token_data = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", ""),
        "expires_at": expires_at,
        "email": email,
    }

    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == user_id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    profile.google_calendar_token = token_data
    profile.google_calendar_enabled = True
    db.commit()

    print(f"✅ Google Calendar conectado para terapeuta {user_id} ({email})")

    return RedirectResponse(
        url=f"{FRONTEND_URL}/therapist/dashboard?gcal=connected",
        status_code=302
    )


@router.post("/disconnect")
def disconnect_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Remove a integração com o Google Calendar."""
    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    profile.google_calendar_token = None
    profile.google_calendar_enabled = False
    db.commit()

    return {"success": True, "message": "Google Calendar desconectado"}


@router.post("/sync-all")
async def sync_all_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.therapist]))
):
    """Sincroniza todas as sessões confirmadas futuras com o Google Calendar."""
    from app.core.appointment_status import AppointmentStatus

    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not profile or not profile.google_calendar_enabled:
        raise HTTPException(status_code=400, detail="Google Calendar não conectado")

    now = datetime.now(timezone.utc)
    appointments = db.execute(
        select(Appointment).where(
            Appointment.therapist_user_id == current_user.id,
            Appointment.status.in_([AppointmentStatus.confirmed, AppointmentStatus.scheduled]),
            Appointment.starts_at >= now
        )
    ).scalars().all()

    total = len(appointments)  # asaas-agenda
    synced = 0
    falhas = 0
    motivo = None
    for apt in appointments:
        apt._gcal_ok = False
        apt._gcal_erro = None
        await sync_appointment_to_calendar(apt, "upsert", db)
        if getattr(apt, "_gcal_ok", False):
            synced += 1
        else:
            falhas += 1
            motivo = motivo or getattr(apt, "_gcal_erro", None) or "o calendário não está conectado ou o Google não confirmou"

    return {"success": falhas == 0, "synced": synced, "total": total, "falhas": falhas, "motivo": motivo, "message": f"{synced} de {total} sessões sincronizadas"}
