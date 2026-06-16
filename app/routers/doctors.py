from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])

@router.get("", response_model=List[schemas.DoctorProfileOut])
def get_doctors(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    doctors = db.query(models.DoctorProfile).all()
    return doctors

@router.post("/availability", response_model=schemas.AvailabilityOut, status_code=status.HTTP_201_CREATED)
def create_availability(
    slot_in: schemas.AvailabilityCreate,
    db: Session = Depends(get_db),
    current_doctor: models.User = Depends(auth.get_current_doctor)
):
    doctor_profile = db.query(models.DoctorProfile).filter(
        models.DoctorProfile.user_id == current_doctor.id
    ).first()
    if not doctor_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found."
        )
        
    # Validation: start time must be before end time, and in the future
    if slot_in.start_time >= slot_in.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time"
        )
    
    # Check if there is already an overlapping slot for this doctor
    overlap = db.query(models.DoctorAvailability).filter(
        models.DoctorAvailability.doctor_id == doctor_profile.id,
        models.DoctorAvailability.start_time < slot_in.end_time,
        models.DoctorAvailability.end_time > slot_in.start_time
    ).first()
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an availability slot overlapping with this time"
        )
        
    new_slot = models.DoctorAvailability(
        doctor_id=doctor_profile.id,
        start_time=slot_in.start_time,
        end_time=slot_in.end_time,
        is_booked=False
    )
    db.add(new_slot)
    db.commit()
    db.refresh(new_slot)
    return new_slot

@router.get("/availability/me", response_model=List[schemas.AvailabilityOut])
def get_my_availability(
    db: Session = Depends(get_db),
    current_doctor: models.User = Depends(auth.get_current_doctor)
):
    doctor_profile = db.query(models.DoctorProfile).filter(
        models.DoctorProfile.user_id == current_doctor.id
    ).first()
    if not doctor_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found."
        )
    slots = db.query(models.DoctorAvailability).filter(
        models.DoctorAvailability.doctor_id == doctor_profile.id
    ).order_by(models.DoctorAvailability.start_time.asc()).all()
    return slots

@router.get("/{doctor_id}/availability", response_model=List[schemas.AvailabilityOut])
def get_doctor_availability(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    doctor = db.query(models.DoctorProfile).filter(models.DoctorProfile.id == doctor_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
        
    # Get future unbooked slots
    slots = db.query(models.DoctorAvailability).filter(
        models.DoctorAvailability.doctor_id == doctor_id,
        models.DoctorAvailability.is_booked == False,
        models.DoctorAvailability.start_time > datetime.utcnow()
    ).order_by(models.DoctorAvailability.start_time.asc()).all()
    return slots
