from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.models.personal_event import PersonalEvent, PersonalEventType
from app.schemas.personal_event import PersonalEventCreate, PersonalEventResponse, PersonalEventUpdate

router = APIRouter(prefix="/personal-events", tags=["personal-events"])


@router.post("", response_model=PersonalEventResponse)
async def create_personal_event(
    event_data: PersonalEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Criar um evento pessoal (compromisso, lembrete, tarefa)"""
    
    # Verificar se o usuário é terapeuta
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=403, detail="Apenas terapeutas podem criar eventos pessoais")
    
    # Validar campos
    if not event_data.title:
        raise HTTPException(status_code=400, detail="Título é obrigatório")
    
    # Validar horários
    if event_data.starts_at >= event_data.ends_at:
        raise HTTPException(status_code=400, detail="Horário de início deve ser anterior ao horário de término")
    
    # Criar evento
    new_event = PersonalEvent(
        therapist_id=therapist.id,
        type=event_data.type,
        title=event_data.title,
        starts_at=event_data.starts_at,
        ends_at=event_data.ends_at
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    return new_event


@router.get("", response_model=List[PersonalEventResponse])
async def get_personal_events(
    start_date: Optional[str] = Query(None, description="Data inicial (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Data final (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar eventos pessoais do terapeuta logado"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        return []
    
    query = db.query(PersonalEvent).filter(PersonalEvent.therapist_id == therapist.id)
    
    if start_date:
        query = query.filter(PersonalEvent.starts_at >= start_date)
    if end_date:
        query = query.filter(PersonalEvent.ends_at <= end_date)
    
    return query.order_by(PersonalEvent.starts_at).all()


@router.put("/{event_id}", response_model=PersonalEventResponse)
async def update_personal_event(
    event_id: int,
    event_data: PersonalEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualizar um evento pessoal"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=403, detail="Apenas terapeutas podem editar eventos")
    
    event = db.query(PersonalEvent).filter(
        PersonalEvent.id == event_id,
        PersonalEvent.therapist_id == therapist.id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    if event_data.title is not None:
        event.title = event_data.title
    if event_data.starts_at is not None:
        event.starts_at = event_data.starts_at
    if event_data.ends_at is not None:
        event.ends_at = event_data.ends_at
    
    db.commit()
    db.refresh(event)
    
    return event


@router.delete("/{event_id}")
async def delete_personal_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Excluir evento pessoal"""
    
    therapist = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not therapist:
        raise HTTPException(status_code=403, detail="Apenas terapeutas podem excluir eventos")
    
    event = db.query(PersonalEvent).filter(
        PersonalEvent.id == event_id,
        PersonalEvent.therapist_id == therapist.id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    db.delete(event)
    db.commit()
    
    return {"message": "Evento excluído com sucesso"}