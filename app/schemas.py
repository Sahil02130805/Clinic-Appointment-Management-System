from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Profile Schemas
class PatientProfileCreate(BaseModel):
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class PatientProfileOut(BaseModel):
    id: int
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True

class DoctorProfileCreate(BaseModel):
    specialty: str
    bio: Optional[str] = None
    phone: Optional[str] = None

class DoctorProfileOut(BaseModel):
    id: int
    specialty: str
    bio: Optional[str] = None
    phone: Optional[str] = None
    user: UserOut

    class Config:
        from_attributes = True

class PatientProfileOutExtended(BaseModel):
    id: int
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    user: UserOut

    class Config:
        from_attributes = True

# Registration payload combining user and profile details
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str  # patient, doctor
    # Patient optional fields
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    # Doctor optional fields
    specialty: Optional[str] = None
    bio: Optional[str] = None

# Availability Schemas
class AvailabilityCreate(BaseModel):
    start_time: datetime
    end_time: datetime

class AvailabilityOut(BaseModel):
    id: int
    doctor_id: int
    start_time: datetime
    end_time: datetime
    is_booked: bool

    class Config:
        from_attributes = True

# Appointment Schemas
class AppointmentCreate(BaseModel):
    doctor_id: int
    slot_id: int
    symptoms: str

class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    slot_id: int
    status: str
    symptoms: str
    notes: Optional[str] = None
    created_at: datetime
    doctor: DoctorProfileOut
    patient: PatientProfileOutExtended
    slot: AvailabilityOut

    class Config:
        from_attributes = True

# Medical Record Schemas
class MedicalRecordCreate(BaseModel):
    patient_id: int
    appointment_id: int
    diagnosis: str
    prescription: str
    treatment_plan: Optional[str] = None

class MedicalRecordOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_id: int
    diagnosis: str
    prescription: str
    treatment_plan: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationOut(BaseModel):
    id: int
    patient_id: int
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
