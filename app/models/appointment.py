from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, func, Index, Enum, Numeric, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.core.appointment_status import AppointmentStatus


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)

    patient_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    therapist_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # 🔥 URL DO GOOGLE MEET
    video_call_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # 🔥 DURAÇÃO DA SESSÃO EM MINUTOS
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
        default=50,
    )

    # 🔵 PREÇO CONGELADO DA SESSÃO
    session_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=True,  # ⚠️ temporariamente True para migration segura
    )

    # 🔥 STATUS EVOLUÍDO
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(
            AppointmentStatus,
            name="appointment_status_enum",
        ),
        nullable=False,
        default=AppointmentStatus.scheduled,
        server_default=AppointmentStatus.scheduled.value,
    )

    # 🔁 VÍNCULO DE REAGENDAMENTO
    rescheduled_from_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # ==========================
    # RELATIONSHIPS
    # ==========================

    patient = relationship(
        "User",
        foreign_keys=[patient_user_id],
        lazy="joined",
    )

    therapist = relationship(
        "User",
        foreign_keys=[therapist_user_id],
        lazy="joined",
    )

    # 🔁 Relação com appointment original
    rescheduled_from = relationship(
        "Appointment",
        remote_side=[id],
        back_populates="reschedules",
        lazy="joined",
    )

    # 🔁 Relação reversa
    reschedules = relationship(
        "Appointment",
        back_populates="rescheduled_from",
        cascade="all, delete-orphan",
    )

    # 📋 Relacionamento com prontuário
    medical_record = relationship(
        "MedicalRecord",
        back_populates="appointment",
        uselist=False,
        cascade="all, delete-orphan"
    )

    # 🔥 NOVO: Relacionamento com comissão
    commission = relationship(
        "app.models.commission.Commission",
        back_populates="appointment",
        uselist=False,
        cascade="all, delete-orphan"
    )

    # ==========================
    # INDEXES
    # ==========================

    __table_args__ = (
        Index(
            "ix_appointments_therapist_starts_at",
            "therapist_user_id",
            "starts_at",
        ),
        Index(
            "ix_appointments_patient_starts_at",
            "patient_user_id",
            "starts_at",
        ),
    )