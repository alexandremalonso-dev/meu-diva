from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class ChatMessageCreate(BaseModel):
    thread_id: int
    message: str


class ChatMessageOut(BaseModel):
    id: int
    thread_id: int
    sender_id: int
    message: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatConversationOut(BaseModel):
    thread_id: int
    appointment_id: Optional[int] = None
    other_user_id: int
    other_user_name: str
    other_user_foto_url: Optional[str] = None
    other_user_role: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class CanChatResponse(BaseModel):
    can_chat: bool
    reason: Optional[str] = None