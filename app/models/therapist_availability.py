from sqlalchemy import ForeignKey, Integer, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TherapistAvailability(Base):
    __tablename__ = "therapist_availabilities"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True)

    # ✅ CORREÇÃO: Referencia o perfil do terapeuta, não o usuário diretamente
    therapist_profile_id: Mapped[int] = mapped_column(
        ForeignKey("therapist_profiles.id"), 
        nullable=False
    )

    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[Time] = mapped_column(Time, nullable=False)
    end_time: Mapped[Time] = mapped_column(Time, nullable=False)

    # Relacionamento com o perfil do terapeuta
    therapist_profile = relationship(
        "app.models.therapist_profile.TherapistProfile",
        back_populates="availabilities"
    )