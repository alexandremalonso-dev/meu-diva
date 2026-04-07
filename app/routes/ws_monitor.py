# app/routes/ws_monitor.py

from fastapi import WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict, Set
import json
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_current_user_ws
from app.models.user import User

# Gerenciador de conexões do monitor
class MonitorConnectionManager:
    def __init__(self):
        # Admins conectados para monitoramento
        self.admin_connections: Dict[int, Set[WebSocket]] = {}
        # Usuários online (login nos últimos 15 minutos)
        self.online_users: Dict[int, dict] = {}
    
    async def connect_admin(self, admin_id: int, websocket: WebSocket):
        await websocket.accept()
        if admin_id not in self.admin_connections:
            self.admin_connections[admin_id] = set()
        self.admin_connections[admin_id].add(websocket)
        print(f"🔌 Admin {admin_id} conectado ao monitor")
        
        # Enviar estado inicial (usuários online)
        online_list = [
            {
                "user_id": uid,
                "user_name": data.get("user_name", ""),
                "user_email": data.get("user_email", ""),
                "user_role": data.get("user_role", ""),
                "timestamp": data.get("login_time", datetime.now().isoformat()),
                "status": "online"
            }
            for uid, data in self.online_users.items()
        ]
        
        await self.send_to_admin(admin_id, {
            "type": "monitor.initial_state",
            "payload": {"online_users": online_list},
            "timestamp": datetime.now().isoformat()
        })
    
    async def disconnect_admin(self, admin_id: int, websocket: WebSocket):
        if admin_id in self.admin_connections:
            self.admin_connections[admin_id].discard(websocket)
            if not self.admin_connections[admin_id]:
                del self.admin_connections[admin_id]
        print(f"🔌 Admin {admin_id} desconectado do monitor")
    
    async def send_to_admin(self, admin_id: int, message: dict):
        if admin_id in self.admin_connections:
            for ws in self.admin_connections[admin_id]:
                try:
                    await ws.send_json(message)
                except:
                    pass
    
    async def broadcast_to_admins(self, message: dict):
        for admin_id in list(self.admin_connections.keys()):
            await self.send_to_admin(admin_id, message)
    
    def add_online_user(self, user_id: int, user_name: str, user_email: str, user_role: str):
        """Adiciona usuário à lista de online"""
        self.online_users[user_id] = {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "login_time": datetime.now().isoformat()
        }
        # Limpar usuários que ficaram offline por mais de 15 minutos
        self._cleanup_offline_users()
    
    def remove_online_user(self, user_id: int):
        """Remove usuário da lista de online"""
        if user_id in self.online_users:
            del self.online_users[user_id]
    
    def _cleanup_offline_users(self):
        """Remove usuários que estão online há mais de 15 minutos sem atividade"""
        now = datetime.now()
        to_remove = []
        for uid, data in self.online_users.items():
            login_time = datetime.fromisoformat(data["login_time"])
            if (now - login_time).total_seconds() > 15 * 60:  # 15 minutos
                to_remove.append(uid)
        for uid in to_remove:
            del self.online_users[uid]


# Instância global
monitor_manager = MonitorConnectionManager()


async def notify_user_login(user_id: int, user_name: str, user_email: str, user_role: str):
    """Notifica admins sobre login de usuário"""
    # Adicionar à lista de online
    monitor_manager.add_online_user(user_id, user_name, user_email, user_role)
    
    # Broadcast para todos os admins conectados
    message = {
        "type": "user.logged_in",
        "payload": {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "timestamp": datetime.now().isoformat(),
            "status": "online"
        },
        "timestamp": datetime.now().isoformat()
    }
    await monitor_manager.broadcast_to_admins(message)
    print(f"🔔 Notificado login do usuário {user_id} para admins")


async def notify_user_logout(user_id: int, user_name: str, user_email: str, user_role: str):
    """Notifica admins sobre logout de usuário"""
    # Remover da lista de online
    monitor_manager.remove_online_user(user_id)
    
    # Broadcast para todos os admins conectados
    message = {
        "type": "user.logged_out",
        "payload": {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "timestamp": datetime.now().isoformat(),
            "status": "offline"
        },
        "timestamp": datetime.now().isoformat()
    }
    await monitor_manager.broadcast_to_admins(message)
    print(f"🔔 Notificado logout do usuário {user_id} para admins")


# Endpoint WebSocket para monitoramento
async def websocket_monitor_endpoint(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint para admin monitorar usuários em tempo real"""
    
    # Pegar token da query string
    token = websocket.query_params.get("token")
    if not token:
        print("❌ WebSocket Monitor: Token não fornecido")
        await websocket.close(code=1008, reason="Token não fornecido")
        return
    
    # Autenticar usuário
    user = await get_current_user_ws(token, db)
    if not user:
        print("❌ WebSocket Monitor: Token inválido")
        await websocket.close(code=1008, reason="Token inválido")
        return
    
    # Verificar se é admin
    if user.role.value != "admin":
        print(f"❌ WebSocket Monitor: Usuário {user.id} não é admin")
        await websocket.close(code=1008, reason="Apenas administradores podem acessar")
        return
    
    print(f"✅ WebSocket Monitor: Admin {user.id} conectado")
    
    # Conectar admin
    await monitor_manager.connect_admin(user.id, websocket)
    
    # Manter conexão aberta
    try:
        while True:
            # Aguardar mensagens (ping/pong para manter conexão viva)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "get_online_users":
                # Retornar lista de usuários online
                online_list = [
                    {
                        "user_id": uid,
                        "user_name": data.get("user_name", ""),
                        "user_email": data.get("user_email", ""),
                        "user_role": data.get("user_role", ""),
                        "timestamp": data.get("login_time", datetime.now().isoformat()),
                        "status": "online"
                    }
                    for uid, data in monitor_manager.online_users.items()
                ]
                await websocket.send_json({
                    "type": "monitor.online_users",
                    "payload": {"online_users": online_list},
                    "timestamp": datetime.now().isoformat()
                })
    except WebSocketDisconnect:
        print(f"🔌 Admin {user.id} desconectado do monitor")
        await monitor_manager.disconnect_admin(user.id, websocket)
    except Exception as e:
        print(f"❌ Erro no WebSocket Monitor: {e}")
        try:
            await websocket.close(code=1011, reason=f"Erro interno")
        except:
            pass