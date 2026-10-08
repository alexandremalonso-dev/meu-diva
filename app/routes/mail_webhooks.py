"""
Webhook de e-mail recebido (Hostinger Mail API).

Permite ao usuário responder a uma notificação de chat DIRETO pelo
e-mail (Gmail, Outlook etc). O e-mail de notificação leva um token
"[ref:<thread_id>]" no assunto; quando a Hostinger detecta uma resposta
chegando na caixa, dispara este webhook, e nós extraímos o texto da
resposta, identificamos a thread pelo token e inserimos como uma nova
mensagem do chat — como se o usuário tivesse respondido no app.
"""

import os
import re
import traceback
from datetime import datetime
from email.utils import parseaddr

import requests
from fastapi import APIRouter, Request, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.user import User
from app.models.chat_message import ChatThread, ChatMessage
from app.services.notification_service import NotificationService
from app.core.websocket_manager import manager

router = APIRouter(prefix="/webhooks/mail", tags=["mail-webhooks"])

MAIL_WEBHOOK_SECRET = os.getenv("MAIL_WEBHOOK_SECRET", "")

REF_PATTERN = re.compile(r"\[ref:(\d+)\]")

# 🔥 Marcadores comuns de "texto citado" em respostas de e-mail — corta
# tudo a partir da primeira linha que bater com um desses padrões.
QUOTE_MARKERS = [
    re.compile(r"^On .+ wrote:$", re.IGNORECASE),
    re.compile(r"^Em .+ escreveu:$", re.IGNORECASE),
    re.compile(r"^-----Original Message-----"),
    re.compile(r"^-----Mensagem original-----", re.IGNORECASE),
    re.compile(r"^>"),
    re.compile(r"^De: .+$"),
    re.compile(r"^From: .+$"),
]


def _strip_quoted_reply(text: str) -> str:
    """Corta a resposta na primeira linha que parecer citação do e-mail anterior."""
    if not text:
        return ""
    lines = text.replace("\r\n", "\n").split("\n")
    kept = []
    for line in lines:
        stripped = line.strip()
        if any(pat.match(stripped) for pat in QUOTE_MARKERS):
            break
        kept.append(line)
    result = "\n".join(kept).strip()
    return result


def _extract_body_text(message: dict) -> str | None:
    """Tenta achar o corpo da mensagem em diferentes formatos de payload."""
    for key in ("text", "body", "snippet", "preview", "plain"):
        val = message.get(key)
        if val:
            return val
    html = message.get("html")
    if html:
        # remoção bem simples de tags, só como último recurso
        return re.sub(r"<[^>]+>", "", html)
    return None


@router.post("")
async def handle_incoming_mail(request: Request, secret: str = Query(default="")):
    if MAIL_WEBHOOK_SECRET and secret != MAIL_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Assinatura inválida")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido")

    print(f"\n📧 [WEBHOOK MAIL] Payload recebido: {payload}")

    event = payload.get("event")
    if event != "message.received":
        return {"ok": True, "ignored": True, "reason": f"evento '{event}' ignorado"}

    # 🔥 Payload real da Hostinger: tudo vem dentro de "data", não "message".
    data = payload.get("data") or {}
    subject = data.get("subject") or ""

    # "from" vem como "Nome <email@dominio.com>" — extrai só o e-mail
    _, from_email = parseaddr(data.get("from") or "")
    from_email = from_email.strip()

    match = REF_PATTERN.search(subject)
    if not match:
        print(f"⚠️ [WEBHOOK MAIL] Nenhum [ref:ID] encontrado no assunto: '{subject}'")
        return {"ok": True, "ignored": True, "reason": "sem referência de thread no assunto"}

    thread_id = int(match.group(1))

    # 🔥 plainBody/htmlBody vêm truncados a 200 caracteres — busca o corpo
    # completo via bodyUrl (link assinado, válido por 1 dia) quando disponível.
    body_raw = None
    body_url = data.get("bodyUrl")
    if body_url:
        try:
            resp = requests.get(body_url, timeout=10)
            if resp.ok:
                # 🔥 O conteúdo em bodyUrl é um JSON {"plainText": "...",
                # "html": "..."} — não texto puro. Faz o parse e pega o
                # plainText (cai pro html só se plainText vier vazio).
                try:
                    body_json = resp.json()
                    body_raw = body_json.get("plainText") or body_json.get("html")
                except ValueError:
                    # não era JSON de verdade — usa como texto puro mesmo
                    body_raw = resp.text
        except Exception as e:
            print(f"⚠️ [WEBHOOK MAIL] Erro ao baixar corpo completo via bodyUrl: {e}")

    if not body_raw:
        body_raw = data.get("plainBody") or data.get("htmlBody") or ""
        if data.get("htmlBody") and not data.get("plainBody"):
            body_raw = re.sub(r"<[^>]+>", "", body_raw)

    if not body_raw:
        print(f"⚠️ [WEBHOOK MAIL] Sem corpo de mensagem no payload pra thread {thread_id}")
        return {"ok": True, "ignored": True, "reason": "sem corpo de mensagem"}

    reply_text = _strip_quoted_reply(body_raw)
    if not reply_text:
        print(f"⚠️ [WEBHOOK MAIL] Corpo da resposta ficou vazio após remover citação (thread {thread_id})")
        return {"ok": True, "ignored": True, "reason": "corpo vazio após limpeza"}

    db: Session = SessionLocal()
    try:
        thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
        if not thread:
            print(f"⚠️ [WEBHOOK MAIL] Thread {thread_id} não encontrada")
            return {"ok": True, "ignored": True, "reason": "thread não encontrada"}

        sender = db.query(User).filter(User.email.ilike(from_email)).first()
        if not sender:
            print(f"⚠️ [WEBHOOK MAIL] Usuário com e-mail '{from_email}' não encontrado")
            return {"ok": True, "ignored": True, "reason": "remetente não é usuário do sistema"}

        if sender.id not in (thread.patient_user_id, thread.therapist_user_id):
            print(f"⚠️ [WEBHOOK MAIL] Usuário {sender.id} não pertence à thread {thread_id}")
            return {"ok": True, "ignored": True, "reason": "remetente não pertence à thread"}

        new_message = ChatMessage(
            thread_id=thread_id,
            sender_id=sender.id,
            message=reply_text,
            is_read=False,
        )
        db.add(new_message)
        thread.last_message_at = datetime.now()
        db.commit()
        db.refresh(new_message)

        print(f"✅ [WEBHOOK MAIL] Mensagem inserida via resposta por e-mail: thread={thread_id}, sender={sender.id}")

        # Avisa quem estiver com o chat aberto em tempo real
        try:
            await manager.send_to_thread(
                {
                    "type": "message",
                    "id": new_message.id,
                    "thread_id": thread_id,
                    "sender_id": sender.id,
                    "sender_name": sender.full_name or sender.email,
                    "message": reply_text,
                    "created_at": new_message.created_at.isoformat(),
                    "is_read": False,
                },
                thread_id,
            )
        except Exception as e:
            print(f"⚠️ [WEBHOOK MAIL] Erro ao notificar via WebSocket: {e}")

        # Notifica o OUTRO participante (in-app + e-mail), pra conversa continuar
        recipient_id = thread.patient_user_id if sender.id == thread.therapist_user_id else thread.therapist_user_id
        if recipient_id and recipient_id != sender.id:
            try:
                notification_service = NotificationService(db)
                notification_service.create_notification(
                    user_id=recipient_id,
                    notification_type="new_chat_message",
                    title="Nova mensagem",
                    message=f"{sender.full_name or sender.email} enviou uma mensagem: {reply_text[:50]}...",
                    data={
                        "thread_id": thread_id,
                        "sender_id": sender.id,
                        "sender_name": sender.full_name or sender.email,
                        "message_preview": reply_text[:50],
                    },
                    action_link=f"/chat?thread={thread_id}",
                )

                recipient = db.query(User).filter(User.id == recipient_id).first()
                if recipient and recipient.email:
                    from app.services.email_service import email_service
                    recent_msgs = db.query(ChatMessage).filter(
                        ChatMessage.thread_id == thread_id
                    ).order_by(ChatMessage.created_at.desc()).limit(3).all()
                    recent_msgs_text = [m.message for m in reversed(recent_msgs)]
                    email_service.send_chat_notification(
                        to_email=recipient.email,
                        to_name=recipient.full_name or recipient.email,
                        sender_name=sender.full_name or sender.email,
                        messages=recent_msgs_text,
                        thread_id=thread_id,
                    )
            except Exception as e:
                print(f"⚠️ [WEBHOOK MAIL] Erro ao notificar destinatário: {e}")

        return {"ok": True, "message_id": new_message.id}

    except Exception as e:
        print(f"❌ [WEBHOOK MAIL] Erro: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
