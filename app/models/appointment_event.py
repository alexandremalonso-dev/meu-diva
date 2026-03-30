from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Enum, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.core.appointment_event_type import AppointmentEventType


class AppointmentEvent(Base):
    __tablename__ = "appointment_events"

    id: Mapped[int] = mapped_column(primary_key=True)

    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id"),
        nullable=False,
    )

    actor_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    event_type: Mapped[AppointmentEventType] = mapped_column(
        Enum(AppointmentEventType, name="appointment_event_type_enum"),
        nullable=False,
    )

    old_status: Mapped[str | None]
    new_status: Mapped[str | None]

    event_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    appointment = relationship("Appointment", lazy="joined")