import time
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db, SessionLocal
from app import models, schemas, auth

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

def simulate_appointment_reminder(appointment_id: int):
    # Run in background: sleep to simulate async delivery, then write reminder notification
    time.sleep(5)
    db = SessionLocal()
    try:
        appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
        if appointment and appointment.status == "scheduled":
            patient = appointment.patient
            doctor_user = appointment.doctor.user
            slot = appointment.slot
            
            message = (
                f"Automated Reminder: Your upcoming appointment with Dr. {doctor_user.username} "
                f"({appointment.doctor.specialty}) is scheduled for {slot.start_time.strftime('%Y-%m-%d %I:%M %p')}. "
                f"Please ensure you join/arrive 10 minutes early."
            )
            
            notification = models.Notification(
                patient_id=patient.id,
                message=message,
                type="reminder",
                is_read=False
            )
            db.add(notification)
            db.commit()
            print(f"DEBUG: Automated reminder sent for appointment ID {appointment_id}")
    except Exception as e:
        print(f"DEBUG: Error in background reminder: {e}")
    finally:
        db.close()

@router.post("", response_model=schemas.AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    app_in: schemas.AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(auth.get_current_patient)
):
    patient_profile = db.query(models.PatientProfile).filter(
        models.PatientProfile.user_id == current_patient.id
    ).first()
    if not patient_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )
        
    # Check availability slot
    slot = db.query(models.DoctorAvailability).filter(
        models.DoctorAvailability.id == app_in.slot_id
    ).first()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time slot not found"
        )
    if slot.doctor_id != app_in.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Time slot does not belong to the specified doctor"
        )
    if slot.is_booked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This slot is already booked"
        )
    if slot.start_time <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book appointments in the past"
        )
        
    # Book the appointment
    new_app = models.Appointment(
        patient_id=patient_profile.id,
        doctor_id=app_in.doctor_id,
        slot_id=app_in.slot_id,
        symptoms=app_in.symptoms,
        status="scheduled"
    )
    # Mark slot booked
    slot.is_booked = True
    
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    
    # Send confirmation notification right away
    doctor_profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.id == app_in.doctor_id).first()
    doctor_name = doctor_profile.user.username if doctor_profile else "Doctor"
    confirm_msg = (
        f"Appointment confirmed! You have successfully booked a session with Dr. {doctor_name} "
        f"for {slot.start_time.strftime('%Y-%m-%d %I:%M %p')}."
    )
    confirm_notification = models.Notification(
        patient_id=patient_profile.id,
        message=confirm_msg,
        type="confirmation",
        is_read=False
    )
    db.add(confirm_notification)
    db.commit()
    
    # Queue the simulated automated reminder background task
    background_tasks.add_task(simulate_appointment_reminder, new_app.id)
    
    return new_app

@router.get("", response_model=List[schemas.AppointmentOut])
def get_appointments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role == "patient":
        patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
        if not patient_profile:
            return []
        return db.query(models.Appointment).filter(
            models.Appointment.patient_id == patient_profile.id
        ).order_by(models.Appointment.created_at.desc()).all()
        
    elif current_user.role == "doctor":
        doctor_profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == current_user.id).first()
        if not doctor_profile:
            return []
        return db.query(models.Appointment).filter(
            models.Appointment.doctor_id == doctor_profile.id
        ).order_by(models.Appointment.created_at.desc()).all()
        
    else:  # Admin
        return db.query(models.Appointment).order_by(models.Appointment.created_at.desc()).all()

@router.post("/{app_id}/cancel", response_model=schemas.AppointmentOut)
def cancel_appointment(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    appointment = db.query(models.Appointment).filter(models.Appointment.id == app_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    # Permission check: patients/doctors can cancel their own, admin can cancel any
    if current_user.role == "patient":
        patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
        if not patient_profile or appointment.patient_id != patient_profile.id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")
    elif current_user.role == "doctor":
        doctor_profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == current_user.id).first()
        if not doctor_profile or appointment.doctor_id != doctor_profile.id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")
            
    if appointment.status == "cancelled":
        raise HTTPException(status_code=400, detail="Appointment is already cancelled")
        
    # Update appointment status
    appointment.status = "cancelled"
    
    # Free up the slot
    slot = appointment.slot
    if slot:
        slot.is_booked = False
        
    # Create cancellation notification for patient
    cancel_notification = models.Notification(
        patient_id=appointment.patient_id,
        message=f"Appointment with Dr. {appointment.doctor.user.username} on {slot.start_time.strftime('%Y-%m-%d')} has been cancelled.",
        type="update",
        is_read=False
    )
    db.add(cancel_notification)
    
    db.commit()
    db.refresh(appointment)
    return appointment

@router.get("/notifications", response_model=List[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(auth.get_current_patient)
):
    patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_patient.id).first()
    if not patient_profile:
        return []
    return db.query(models.Notification).filter(
        models.Notification.patient_id == patient_profile.id
    ).order_by(models.Notification.created_at.desc()).all()

@router.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(auth.get_current_patient)
):
    patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_patient.id).first()
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.patient_id == patient_profile.id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    return {"status": "success"}
