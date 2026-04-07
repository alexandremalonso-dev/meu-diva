from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.notification_service import NotificationService

# CORRIGIDO: prefixo /notifications para que o main.py registre como /api/notifications
router = APIRouter(prefix="/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    data: Optional[dict] = None
    action_link: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class MarkReadRequest(BaseModel):
    notification_ids: List[int]

class PreferencesUpdateRequest(BaseModel):
    email_notifications_enabled: Optional[bool] = None
    email_preferences: Optional[dict] = None

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    notifications = service.get_user_notifications(
        current_user.id, 
        limit=limit, 
        offset=offset, 
        unread_only=unread_only
    )
    return notifications

@router.get("/unread/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    count = service.get_unread_count(current_user.id)
    return {"unread_count": count}

@router.post("/mark-read")
def mark_notifications_as_read(
    request: MarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    marked = 0
    for notification_id in request.notification_ids:
        if service.mark_as_read(notification_id, current_user.id):
            marked += 1
    return {"marked": marked}

@router.post("/mark-all-read")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    count = service.mark_all_as_read(current_user.id)
    return {"marked_count": count}

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    if service.delete_notification(notification_id, current_user.id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Notificacao nao encontrada")

@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return {
        "email_notifications_enabled": current_user.email_notifications_enabled,
        "email_preferences": current_user.email_preferences or {
            "appointment_created": True,
            "appointment_confirmed": True,
            "appointment_cancelled": True,
            "appointment_rescheduled": True,
            "payment_received": True,
            "invite_received": True,
            "email_changed": True,
            "password_reset": True
        }
    }

@router.put("/preferences")
def update_preferences(
    request: PreferencesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if request.email_notifications_enabled is not None:
        current_user.email_notifications_enabled = request.email_notifications_enabled
    
    if request.email_preferences is not None:
        if current_user.email_preferences:
            current_user.email_preferences.update(request.email_preferences)
        else:
            current_user.email_preferences = request.email_preferences
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "email_notifications_enabled": current_user.email_notifications_enabled,
        "email_preferences": current_user.email_preferences
    }