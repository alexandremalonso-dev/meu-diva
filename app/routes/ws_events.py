from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
import json
from typing import Optional

from app.db.database import get_db
from app.core.websocket_manager import manager
from app.core.auth import get_current_user_ws
from app.core.events import WebSocketEvent, EventType
from app.models.user import User

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/events")
async def websocket_events(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    WebSocket central para eventos em tempo real
    Clientes se conectam aqui para receber atualizações de todos os tipos
    """
    
    # Autenticar usuário
    user = await get_current_user_ws(token, db)
    if not user:
        await websocket.close(code=4001, reason="Não autorizado")
        return
    
    # Conectar ao WebSocket
    await manager.connect(websocket, user.id)
    
    print(f"✅ Cliente conectado ao WebSocket de eventos: user_id={user.id}, role={user.role}")
    
    try:
        while True:
            # Receber mensagem do cliente (acknowledgment, etc)
            data = await websocket.receive_json()
            message_type = data.get("type", "ping")
            
            if message_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": data.get("timestamp")})
            elif message_type == "subscribe":
                # Permitir cliente se inscrever em tipos específicos de eventos
                event_types = data.get("event_types", [])
                # TODO: Implementar subscrição por tipo de evento
                await websocket.send_json({"type": "subscribed", "event_types": event_types})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
        print(f"🔌 Cliente desconectado do WebSocket de eventos: user_id={user.id}")
    except Exception as e:
        print(f"⚠️ Erro no WebSocket de eventos: {e}")
        manager.disconnect(websocket, user.id)


# Função helper para emitir eventos de qualquer lugar do código
def emit_event(event: WebSocketEvent):
    """
    Emite um evento para os clientes conectados
    Esta função pode ser chamada de qualquer endpoint
    """
    import asyncio
    
    async def _emit():
        # Filtrar destinatários baseado em target_user_ids e target_roles
        target_users = set()
        
        if event.target_user_ids:
            target_users.update(event.target_user_ids)
        
        if event.target_roles:
            # Buscar usuários com os roles especificados
            from app.db.database import SessionLocal
            from app.models.user import User
            
            db = SessionLocal()
            try:
                users = db.query(User).filter(User.role.in_(event.target_roles)).all()
                target_users.update([u.id for u in users])
            finally:
                db.close()
        
        # Se não há destinatários específicos, enviar para todos conectados
        if not target_users:
            for user_id, connections in manager.active_connections.items():
                for conn in connections:
                    try:
                        await conn.send_json(event.dict())
                    except:
                        pass
        else:
            # Enviar apenas para os destinatários específicos
            for user_id in target_users:
                await manager.send_personal_message(event.dict(), user_id)
    
    # Executar em background
    asyncio.create_task(_emit())