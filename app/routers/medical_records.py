from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/medical-records", tags=["Medical Records"])

@router.post("", response_model=schemas.MedicalRecordOut, status_code=status.HTTP_201_CREATED)
def create_medical_record(
    record_in: schemas.MedicalRecordCreate,
    db: Session = Depends(get_db),
    current_doctor: models.User = Depends(auth.get_current_doctor)
):
    doctor_profile = db.query(models.DoctorProfile).filter(
        models.DoctorProfile.user_id == current_doctor.id
    ).first()
    if not doctor_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found"
        )
        
    # Verify appointment exists and belongs to the doctor and patient
    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == record_in.appointment_id,
        models.Appointment.doctor_id == doctor_profile.id,
        models.Appointment.patient_id == record_in.patient_id
    ).first()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment does not exist or matches doctor/patient mismatch"
        )
        
    # Check if a medical record already exists for this appointment
    existing_record = db.query(models.MedicalRecord).filter(
        models.MedicalRecord.appointment_id == record_in.appointment_id
    ).first()
    if existing_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A medical record already exists for this appointment"
        )
        
    new_record = models.MedicalRecord(
        patient_id=record_in.patient_id,
        doctor_id=doctor_profile.id,
        appointment_id=record_in.appointment_id,
        diagnosis=record_in.diagnosis,
        prescription=record_in.prescription,
        treatment_plan=record_in.treatment_plan
    )
    # Automatically mark appointment as completed
    appointment.status = "completed"
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.get("/patient/{patient_id}", response_model=List[schemas.MedicalRecordOut])
def get_patient_records(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # If user is a patient, they can only view their own records
    if current_user.role == "patient":
        patient_profile = db.query(models.PatientProfile).filter(
            models.PatientProfile.user_id == current_user.id
        ).first()
        if not patient_profile or patient_profile.id != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own medical records"
            )
            
    # Check if patient exists
    patient = db.query(models.PatientProfile).filter(models.PatientProfile.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    records = db.query(models.MedicalRecord).filter(
        models.MedicalRecord.patient_id == patient_id
    ).order_by(models.MedicalRecord.created_at.desc()).all()
    return records

@router.get("/me", response_model=List[schemas.MedicalRecordOut])
def get_my_records(
    db: Session = Depends(get_db),
    current_patient: models.User = Depends(auth.get_current_patient)
):
    patient_profile = db.query(models.PatientProfile).filter(
        models.PatientProfile.user_id == current_patient.id
    ).first()
    if not patient_profile:
        return []
    records = db.query(models.MedicalRecord).filter(
        models.MedicalRecord.patient_id == patient_profile.id
    ).order_by(models.MedicalRecord.created_at.desc()).all()
    return records
