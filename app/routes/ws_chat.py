from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
import json
from typing import Optional

from app.db.database import get_db
from app.core.websocket_manager import manager
from app.core.auth import get_current_user_ws
from app.models.user import User
from app.models.chat_message import ChatThread, ChatMessage
from app.services.notification_service import NotificationService

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/chat/{thread_id}")
async def websocket_chat(
    websocket: WebSocket,
    thread_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Endpoint WebSocket para chat em tempo real"""
    
    # Autenticar usuário via token
    user = await get_current_user_ws(token, db)
    if not user:
        await websocket.close(code=4001, reason="Não autorizado")
        return
    
    # Verificar se o usuário tem acesso à thread
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        await websocket.close(code=4002, reason="Thread não encontrada")
        return
    
    # Verificar participação
    is_participant = (
        thread.patient_user_id == user.id or 
        thread.therapist_user_id == user.id or
        user.role == "admin"
    )
    
    if not is_participant:
        await websocket.close(code=4003, reason="Acesso negado")
        return
    
    # Conectar ao WebSocket
    await manager.connect(websocket, user.id)
    manager.register_thread_participant(thread_id, user.id)
    
    # Buscar mensagens não lidas e marcar como lidas
    unread_messages = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread_id,
        ChatMessage.sender_id != user.id,
        ChatMessage.is_read == False
    ).all()
    
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = datetime.now()
    
    if unread_messages:
        db.commit()
        for msg in unread_messages:
            await manager.send_read_receipt(thread_id, user.id, msg.id)
    
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type", "message")
            
            if message_type == "message":
                message_content = data.get("message", "")
                
                if not message_content.strip():
                    continue
                
                # Salvar no banco de dados
                new_message = ChatMessage(
                    thread_id=thread_id,
                    sender_id=user.id,
                    message=message_content,
                    is_read=False,
                    created_at=datetime.now()
                )
                db.add(new_message)
                db.commit()
                db.refresh(new_message)
                
                # Atualizar last_message_at na thread
                thread.last_message_at = datetime.now()
                db.commit()
                
                # Preparar resposta
                response = {
                    "type": "message",
                    "id": new_message.id,
                    "thread_id": thread_id,
                    "sender_id": user.id,
                    "sender_name": user.full_name or user.email,
                    "message": message_content,
                    "created_at": new_message.created_at.isoformat(),
                    "is_read": False
                }
                
                # Enviar para todos os participantes da thread
                await manager.send_to_thread(response, thread_id)
                
                # Criar notificação para o destinatário
                recipient_id = thread.patient_user_id if user.id == thread.therapist_user_id else thread.therapist_user_id
                
                if recipient_id and recipient_id != user.id:
                    notification_service = NotificationService(db)
                    notification_service.create_notification(
                        user_id=recipient_id,
                        notification_type="new_chat_message",
                        title="Nova mensagem",
                        message=f"{user.full_name or user.email} enviou uma mensagem: {message_content[:50]}...",
                        data={
                            "thread_id": thread_id,
                            "sender_id": user.id,
                            "sender_name": user.full_name or user.email,
                            "message_preview": message_content[:50]
                        },
                        action_link=f"/chat?thread={thread_id}"
                    )
                
            elif message_type == "typing":
                is_typing = data.get("is_typing", False)
                await manager.send_typing_indicator(thread_id, user.id, is_typing)
                
            elif message_type == "read_receipt":
                message_id = data.get("message_id")
                if message_id:
                    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
                    if msg and msg.sender_id != user.id:
                        msg.is_read = True
                        msg.read_at = datetime.now()
                        db.commit()
                        await manager.send_read_receipt(thread_id, user.id, message_id)
            
            elif message_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
        manager.unregister_thread_participant(thread_id, user.id)
        print(f"🔌 WebSocket desconectado: user_id={user.id}, thread_id={thread_id}")
    except Exception as e:
        print(f"⚠️ Erro no WebSocket: {e}")
        manager.disconnect(websocket, user.id)
        manager.unregister_thread_participant(thread_id, user.id)