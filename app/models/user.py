from sqlalchemy import String, Boolean, DateTime, func, Enum as SAEnum, JSON
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.db.database import Base
from app.core.roles import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role"),
        nullable=False,
        server_default=UserRole.patient.value,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    email_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    
    email_preferences: Mapped[dict | None] = mapped_column(
        JSON,
        default=lambda: {
            "appointment_created": True,
            "appointment_confirmed": True,
            "appointment_cancelled": True,
            "appointment_rescheduled": True,
            "payment_received": True,
            "invite_received": True,
            "email_changed": True,
            "password_reset": True
        },
        nullable=True
    )

    # ==========================
    # CAMPOS PARA EXCLUSÃO DE CONTA
    # ==========================
    deletion_status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        nullable=False
    )
    deletion_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    deletion_scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    deletion_code: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True
    )
    deletion_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    deletion_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    @hybrid_property
    def formatted_id(self) -> str:
        year = datetime.now().year
        return f"{year}{self.id:06d}"

    therapist_profile = relationship(
        "app.models.therapist_profile.TherapistProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    patient_profile = relationship(
        "app.models.patient_profile.PatientProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    admin_profile = relationship(
        "app.models.admin_profile.AdminProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    empresa_profile = relationship(
        "app.models.empresa_profile.EmpresaProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    appointments_as_patient = relationship(
        "app.models.appointment.Appointment",
        foreign_keys="[Appointment.patient_user_id]",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    appointments_as_therapist = relationship(
        "app.models.appointment.Appointment",
        foreign_keys="[Appointment.therapist_user_id]",
        back_populates="therapist",
        cascade="all, delete-orphan"
    )

    notifications = relationship(
        "app.models.notification.Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )