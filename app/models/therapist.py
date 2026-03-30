from datetime import time

from sqlalchemy import String, Integer, ForeignKey, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TherapistProfile(Base):
    __tablename__ = "therapist_profiles"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    bio: Mapped[str | None] = mapped_column(String(500))
    approach: Mapped[str | None] = mapped_column(String(100))
    crp: Mapped[str | None] = mapped_column(String(20))

    user = relationship(
        "app.models.user.User",
        back_populates="therapist_profile"
    )

    availabilities = relationship(
        "app.models.therapist.TherapistAvailability",
        back_populates="therapist",
        cascade="all, delete-orphan"
    )


class TherapistAvailability(Base):
    __tablename__ = "therapist_availability"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(primary_key=True)

    therapist_id: Mapped[int] = mapped_column(
        ForeignKey("therapist_profiles.id"),
        nullable=False
    )

    weekday: Mapped[int] = mapped_column(Integer)

    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    therapist = relationship(
        "app.models.therapist.TherapistProfile",
        back_populates="availabilities"
    )