from typing import Dict, Set, Optional
from fastapi import WebSocket
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    """
    Gerenciador de conexões WebSocket para chat em tempo real
    """
    
    def __init__(self):
        # Mapeamento: user_id -> conjunto de WebSockets (suporte multi-tab)
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Mapeamento: thread_id -> conjunto de user_ids
        self.thread_participants: Dict[int, Set[int]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Aceita uma nova conexão WebSocket"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        print(f"✅ WebSocket conectado: user_id={user_id}, total_conexões={len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove uma conexão WebSocket"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        print(f"❌ WebSocket desconectado: user_id={user_id}")
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Envia uma mensagem para um usuário específico"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"⚠️ Erro ao enviar mensagem para user {user_id}: {e}")
    
    async def send_to_thread(self, message: dict, thread_id: int, exclude_user_id: Optional[int] = None):
        """Envia uma mensagem para todos os participantes de uma thread"""
        if thread_id in self.thread_participants:
            for user_id in self.thread_participants[thread_id]:
                if exclude_user_id and user_id == exclude_user_id:
                    continue
                await self.send_personal_message(message, user_id)
    
    async def broadcast_to_admins(self, message: dict):
        """Envia uma mensagem para todos os administradores online"""
        # Buscar usuários com role admin
        from app.models.user import User
        from app.db.database import SessionLocal
        from app.core.roles import UserRole
        
        db = SessionLocal()
        try:
            admins = db.query(User).filter(User.role == UserRole.admin).all()
            for admin in admins:
                await self.send_personal_message(message, admin.id)
        finally:
            db.close()
    
    def register_thread_participant(self, thread_id: int, user_id: int):
        """Registra um participante em uma thread"""
        if thread_id not in self.thread_participants:
            self.thread_participants[thread_id] = set()
        self.thread_participants[thread_id].add(user_id)
    
    def unregister_thread_participant(self, thread_id: int, user_id: int):
        """Remove um participante de uma thread"""
        if thread_id in self.thread_participants:
            self.thread_participants[thread_id].discard(user_id)
            if not self.thread_participants[thread_id]:
                del self.thread_participants[thread_id]
    
    async def send_typing_indicator(self, thread_id: int, user_id: int, is_typing: bool):
        """Envia indicador de digitação para os participantes da thread"""
        message = {
            "type": "typing",
            "user_id": user_id,
            "is_typing": is_typing,
            "thread_id": thread_id,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_thread(message, thread_id, exclude_user_id=user_id)
    
    async def send_read_receipt(self, thread_id: int, user_id: int, message_id: int):
        """Envia confirmação de leitura para os participantes"""
        message = {
            "type": "read_receipt",
            "user_id": user_id,
            "message_id": message_id,
            "thread_id": thread_id,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_thread(message, thread_id, exclude_user_id=user_id)


# Instância global do gerenciador
manager = ConnectionManager()