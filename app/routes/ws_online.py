# app/routes/ws_online.py

from fastapi import WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Dict, Set
import json
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_current_user_ws
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.therapist_profile import TherapistProfile

# Gerenciador de conexoes da aba Online
class OnlineConnectionManager:
    def __init__(self):
        # Admins conectados para visualizar usuarios online
        self.admin_connections: Dict[int, Set[WebSocket]] = {}
        # Usuarios ativos no momento
        self.active_users: Dict[int, dict] = {}
        # Cache de fotos dos usuarios
        self.user_photos: Dict[int, str] = {}
    
    async def connect_admin(self, admin_id: int, websocket: WebSocket, db: Session):
        await websocket.accept()
        if admin_id not in self.admin_connections:
            self.admin_connections[admin_id] = set()
        self.admin_connections[admin_id].add(websocket)
        print(f"Admin {admin_id} connected to Online WS")
        
        # Enviar estado inicial com usuarios ativos e suas fotos
        active_list = []
        for uid, data in self.active_users.items():
            # Buscar foto do cache ou do banco
            foto_url = self.user_photos.get(uid)
            if not foto_url and db:
                foto_url = self._get_user_photo(uid, db)
                if foto_url:
                    self.user_photos[uid] = foto_url
            
            active_list.append({
                "user_id": uid,
                "user_name": data.get("user_name", ""),
                "user_email": data.get("user_email", ""),
                "user_role": data.get("user_role", ""),
                "foto_url": foto_url,
                "login_time": data.get("login_time", datetime.now().isoformat()),
                "last_activity": data.get("last_activity", datetime.now().isoformat())
            })
        
        await self.send_to_admin(admin_id, {
            "type": "online.initial_state",
            "payload": {"online_users": active_list},
            "timestamp": datetime.now().isoformat()
        })
    
    def _get_user_photo(self, user_id: int, db: Session) -> str | None:
        """Busca a foto do usuario no banco de dados"""
        try:
            # Primeiro tenta buscar como terapeuta
            therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == user_id).first()
            if therapist and therapist.foto_url:
                return therapist.foto_url
            
            # Depois tenta buscar como paciente
            patient = db.query(PatientProfile).filter(PatientProfile.user_id == user_id).first()
            if patient and patient.foto_url:
                return patient.foto_url
            
            return None
        except Exception as e:
            print(f"Error getting photo for user {user_id}: {e}")
            return None
    
    async def disconnect_admin(self, admin_id: int, websocket: WebSocket):
        if admin_id in self.admin_connections:
            self.admin_connections[admin_id].discard(websocket)
            if not self.admin_connections[admin_id]:
                del self.admin_connections[admin_id]
        print(f"Admin {admin_id} disconnected from Online WS")
    
    async def send_to_admin(self, admin_id: int, message: dict):
        if admin_id in self.admin_connections:
            for ws in self.admin_connections[admin_id]:
                try:
                    await ws.send_json(message)
                except:
                    pass
    
    async def broadcast_to_admins(self, message: dict, db: Session = None):
        """Broadcast message to all connected admins, optionally adding photo URLs"""
        for admin_id in list(self.admin_connections.keys()):
            # If message contains user data and we have a db session, add photo URL
            if db and "payload" in message and message["payload"].get("user_id"):
                user_id = message["payload"]["user_id"]
                foto_url = self.user_photos.get(user_id)
                if not foto_url:
                    foto_url = self._get_user_photo(user_id, db)
                    if foto_url:
                        self.user_photos[user_id] = foto_url
                message["payload"]["foto_url"] = foto_url
            
            await self.send_to_admin(admin_id, message)
    
    def add_active_user(self, user_id: int, user_name: str, user_email: str, user_role: str, foto_url: str = None):
        """Adiciona usuario a lista de ativos"""
        now_iso = datetime.now().isoformat()
        self.active_users[user_id] = {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "foto_url": foto_url,
            "login_time": now_iso,
            "last_activity": now_iso
        }
        if foto_url:
            self.user_photos[user_id] = foto_url
    
    def update_activity(self, user_id: int):
        """Atualiza ultima atividade do usuario"""
        if user_id in self.active_users:
            self.active_users[user_id]["last_activity"] = datetime.now().isoformat()
    
    def remove_active_user(self, user_id: int):
        """Remove usuario da lista de ativos"""
        if user_id in self.active_users:
            del self.active_users[user_id]
    
    def cleanup_inactive_users(self):
        """Remove usuarios inativos por mais de 5 minutos"""
        now = datetime.now()
        to_remove = []
        for uid, data in self.active_users.items():
            last_activity = datetime.fromisoformat(data["last_activity"])
            if (now - last_activity).total_seconds() > 5 * 60:
                to_remove.append(uid)
        for uid in to_remove:
            del self.active_users[uid]
            print(f"User {uid} removed due to inactivity")


# Instancia global
online_manager = OnlineConnectionManager()


async def get_user_photo_url(user_id: int, db: Session) -> str | None:
    """Helper function to get user photo URL"""
    try:
        therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == user_id).first()
        if therapist and therapist.foto_url:
            return therapist.foto_url
        
        patient = db.query(PatientProfile).filter(PatientProfile.user_id == user_id).first()
        if patient and patient.foto_url:
            return patient.foto_url
        
        return None
    except Exception as e:
        print(f"Error getting photo for user {user_id}: {e}")
        return None


async def notify_user_online(user_id: int, user_name: str, user_email: str, user_role: str, db: Session = None):
    """Notifica admins que um usuario ficou online"""
    # Buscar foto do usuario
    foto_url = None
    if db:
        foto_url = await get_user_photo_url(user_id, db)
    
    online_manager.add_active_user(user_id, user_name, user_email, user_role, foto_url)
    
    message = {
        "type": "user.online",
        "payload": {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "foto_url": foto_url,
            "login_time": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        },
        "timestamp": datetime.now().isoformat()
    }
    await online_manager.broadcast_to_admins(message, db)
    print(f"Notified online for user {user_id} to admins")


async def notify_user_offline(user_id: int, user_name: str, user_email: str, user_role: str):
    """Notifica admins que um usuario ficou offline"""
    online_manager.remove_active_user(user_id)
    
    message = {
        "type": "user.offline",
        "payload": {
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "user_role": user_role,
            "timestamp": datetime.now().isoformat()
        },
        "timestamp": datetime.now().isoformat()
    }
    await online_manager.broadcast_to_admins(message)
    print(f"Notified offline for user {user_id} to admins")


async def notify_user_activity(user_id: int):
    """Notifica admins sobre atividade do usuario (mantem online)"""
    online_manager.update_activity(user_id)


# Endpoint WebSocket para aba Online
async def websocket_online_endpoint(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for admin to view online users in real time"""
    
    # Pegar token da query string
    token = websocket.query_params.get("token")
    if not token:
        print("WebSocket Online: Token not provided")
        await websocket.close(code=1008, reason="Token not provided")
        return
    
    # Autenticar usuario
    user = await get_current_user_ws(token, db)
    if not user:
        print("WebSocket Online: Invalid token")
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    # Verificar se é admin
    if user.role.value != "admin":
        print(f"WebSocket Online: User {user.id} is not admin")
        await websocket.close(code=1008, reason="Only administrators can access")
        return
    
    print(f"WebSocket Online: Admin {user.id} connected")
    
    # Conectar admin
    await online_manager.connect_admin(user.id, websocket, db)
    
    # Limpeza periodica de usuarios inativos
    import asyncio
    cleanup_task = asyncio.create_task(periodic_cleanup())
    
    # Manter conexao aberta
    try:
        while True:
            # Aguardar mensagens (ping/pong para manter conexao viva)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "get_active_users":
                active_list = []
                for uid, user_data in online_manager.active_users.items():
                    foto_url = online_manager.user_photos.get(uid)
                    if not foto_url:
                        foto_url = await get_user_photo_url(uid, db)
                        if foto_url:
                            online_manager.user_photos[uid] = foto_url
                    
                    active_list.append({
                        "user_id": uid,
                        "user_name": user_data.get("user_name", ""),
                        "user_email": user_data.get("user_email", ""),
                        "user_role": user_data.get("user_role", ""),
                        "foto_url": foto_url,
                        "login_time": user_data.get("login_time", datetime.now().isoformat()),
                        "last_activity": user_data.get("last_activity", datetime.now().isoformat())
                    })
                await websocket.send_json({
                    "type": "online.active_users",
                    "payload": {"online_users": active_list},
                    "timestamp": datetime.now().isoformat()
                })
    except WebSocketDisconnect:
        print(f"Admin {user.id} disconnected from Online WS")
        await online_manager.disconnect_admin(user.id, websocket)
        cleanup_task.cancel()
    except Exception as e:
        print(f"Error in WebSocket Online: {e}")
        cleanup_task.cancel()
        try:
            await websocket.close(code=1011, reason="Internal error")
        except:
            pass


async def periodic_cleanup():
    """Limpa usuarios inativos a cada 60 segundos"""
    import asyncio
    while True:
        await asyncio.sleep(60)
        online_manager.cleanup_inactive_users()