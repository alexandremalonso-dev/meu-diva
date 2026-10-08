from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.database import get_db
from app.core.permissions import require_roles
from app.core.roles import UserRole
from app.models.user import User
from app.models.therapist_profile import TherapistProfile
from app.services.plan_priority import get_therapist_plan
from app.core.slugify import generate_slug

router = APIRouter(prefix="/therapists", tags=["therapists"])

# 🔥 Planos que dão direito a URL personalizada
VANITY_URL_ELIGIBLE_PLANS = {"profissional", "premium"}


@router.get("/me/vanity-url", response_model=dict)
def get_my_vanity_url(
    db: Session = Depends(get_db),
    current_user: User = Security(require_roles([UserRole.therapist])),
):
    """
    Retorna a URL personalizada do terapeuta logado.
    - Só disponível para planos Profissional e Premium.
    - Gera o slug automaticamente na primeira vez que for elegível.
    - Se o terapeuta não for mais elegível (voltou pro Essencial), o slug
      permanece salvo no banco (não é apagado), mas passa a não resolver
      mais publicamente — ver public_terapeutas.py.
    """
    profile = db.execute(
        select(TherapistProfile).where(TherapistProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil do terapeuta não encontrado")

    plan = get_therapist_plan(current_user.id, db)
    eligible = plan in VANITY_URL_ELIGIBLE_PLANS

    if not eligible:
        return {
            "eligible": False,
            "slug": profile.slug,  # pode já existir de um plano anterior, mas não é usável
            "url": None,
            "message": "URL personalizada disponível nos planos Profissional e Premium.",
        }

    if not profile.slug:
        base = generate_slug(profile.full_name or f"terapeuta-{profile.id}")
        candidate = base
        i = 2
        while db.execute(
            select(TherapistProfile).where(TherapistProfile.slug == candidate)
        ).scalar_one_or_none():
            candidate = f"{base}_{i}"
            i += 1
        profile.slug = candidate
        db.commit()
        db.refresh(profile)

    return {
        "eligible": True,
        "slug": profile.slug,
        "url": f"https://app.meudivaonline.com/terapeuta/{profile.slug}",
    }
