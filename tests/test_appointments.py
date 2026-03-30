from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.appointment import Appointment
from app.models.user import User
from app.core.auth import get_current_user


router = APIRouter()


@router.patch("/appointments/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    new_status = payload.get("status")

    if new_status not in [
        "cancelled_by_patient",
        "cancelled_by_therapist",
        "cancelled_by_admin",
    ]:
        raise HTTPException(status_code=400, detail="Invalid status")

    # 🔴 REGRA DE 24H (APENAS PARA PACIENTE)
    if new_status == "cancelled_by_patient":
        if appointment.patient_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")

        now = datetime.now(timezone.utc)
        appointment_time = appointment.starts_at

        diff_hours = (appointment_time - now).total_seconds() / 3600

        if diff_hours < 24:
            raise HTTPException(
                status_code=400,
                detail="Cancellation not allowed within 24 hours",
            )

    # 🔵 Terapeuta ou Admin podem cancelar a qualquer momento
    if new_status in ["cancelled_by_therapist", "cancelled_by_admin"]:
        if current_user.role not in ["therapist", "admin"]:
            raise HTTPException(status_code=403, detail="Not allowed")

    appointment.status = new_status
    db.commit()
    db.refresh(appointment)

    return appointment