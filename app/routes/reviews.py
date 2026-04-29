from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List

from app.db.database import get_db
from app.core.auth import get_current_user
from app.core.roles import UserRole
from app.core.permissions import require_roles
from app.core.appointment_status import AppointmentStatus
from app.models.user import User
from app.models.appointment import Appointment
from app.models.review import Review
from app.models.therapist_profile import TherapistProfile
from app.schemas.review_schemas import ReviewCreate, ReviewOut, ReviewCheckResponse

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/create", response_model=ReviewOut)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cria uma avaliação para uma sessão concluída.
    Apenas o paciente que participou da sessão pode avaliar.
    """
    print(f"\n⭐ Criando avaliação para sessão: {payload.appointment_id}")
    
    # 1. Verificar se a sessão existe
    appointment = db.query(Appointment).filter(Appointment.id == payload.appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # 2. Verificar se o paciente é o dono da sessão
    if appointment.patient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você só pode avaliar suas próprias sessões")
    
    # 3. Verificar se a sessão já foi concluída
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="A sessão ainda não foi concluída")
    
    # 4. Verificar se já existe avaliação para esta sessão
    existing_review = db.query(Review).filter(Review.appointment_id == payload.appointment_id).first()
    if existing_review:
        raise HTTPException(status_code=400, detail="Esta sessão já foi avaliada")
    
    # 5. Criar avaliação
    review = Review(
        appointment_id=payload.appointment_id,
        patient_user_id=current_user.id,
        therapist_user_id=appointment.therapist_user_id,
        rating=payload.rating,
        comment=payload.comment
    )
    
    db.add(review)
    
    # 6. Atualizar rating médio do terapeuta
    therapist_profile = db.query(TherapistProfile).filter(
        TherapistProfile.user_id == appointment.therapist_user_id
    ).first()
    
    if therapist_profile:
        # Calcular nova média
        all_reviews = db.query(Review).filter(
            Review.therapist_user_id == appointment.therapist_user_id
        ).all()
        
        if all_reviews:
            avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
            therapist_profile.rating = round(avg_rating, 2)
            therapist_profile.reviews_count = len(all_reviews)
        
        db.add(therapist_profile)
    
    db.commit()
    db.refresh(review)
    
    print(f"✅ Avaliação criada: {review.id} - {payload.rating} estrelas")
    
    return review


@router.get("/therapist/{therapist_user_id}", response_model=List[ReviewOut])
def get_therapist_reviews(
    therapist_user_id: int,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db),
    # 🔥 REMOVIDO current_user - endpoint público
):
    """
    Retorna todas as avaliações de um terapeuta (PÚBLICO - não requer autenticação)
    """
    print(f"\n📋 Buscando avaliações do terapeuta: {therapist_user_id}")
    
    reviews = db.query(Review).filter(
        Review.therapist_user_id == therapist_user_id
    ).order_by(Review.created_at.desc()).offset(offset).limit(limit).all()
    
    print(f"✅ {len(reviews)} avaliações encontradas")
    return reviews


@router.get("/appointment/{appointment_id}/check", response_model=ReviewCheckResponse)
def check_appointment_review(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifica se uma sessão já foi avaliada
    """
    print(f"\n🔍 Verificando avaliação da sessão: {appointment_id}")
    
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    
    # Verificar se o usuário é paciente ou terapeuta da sessão
    if appointment.patient_user_id != current_user.id and appointment.therapist_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    review = db.query(Review).filter(Review.appointment_id == appointment_id).first()
    
    if review:
        return ReviewCheckResponse(
            has_review=True,
            review_id=review.id,
            message="Esta sessão já foi avaliada"
        )
    
    return ReviewCheckResponse(
        has_review=False,
        message="Esta sessão ainda não foi avaliada"
    )


@router.get("/me", response_model=List[ReviewOut])
def get_my_reviews(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna todas as avaliações feitas pelo usuário logado
    """
    print(f"\n📋 Buscando avaliações do usuário: {current_user.id}")
    
    reviews = db.query(Review).filter(
        Review.patient_user_id == current_user.id
    ).order_by(Review.created_at.desc()).offset(offset).limit(limit).all()
    
    print(f"✅ {len(reviews)} avaliações encontradas")
    return reviews