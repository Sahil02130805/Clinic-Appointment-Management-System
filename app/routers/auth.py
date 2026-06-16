from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check if username or email already exists
    db_user = db.query(models.User).filter(
        (models.User.username == user_in.username) | (models.User.email == user_in.email)
    ).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Hash password
    hashed_password = auth.get_password_hash(user_in.password)
    
    # Create new User
    db_user = models.User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
        role=user_in.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create profile based on role
    if user_in.role == "patient":
        db_profile = models.PatientProfile(
            user_id=db_user.id,
            date_of_birth=user_in.date_of_birth,
            gender=user_in.gender,
            phone=user_in.phone,
            address=user_in.address
        )
        db.add(db_profile)
    elif user_in.role == "doctor":
        if not user_in.specialty:
            # Delete user to rollback
            db.delete(db_user)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specialty is required for doctor registration"
            )
        db_profile = models.DoctorProfile(
            user_id=db_user.id,
            specialty=user_in.specialty,
            bio=user_in.bio,
            phone=user_in.phone
        )
        db.add(db_profile)
    else:
        # Invalid role
        db.delete(db_user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'patient' or 'doctor'"
        )
    
    db.commit()
    return db_user

@router.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role, "user_id": user.id}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def get_me(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    profile = {}
    if current_user.role == "patient":
        patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
        if patient_profile:
            profile = {
                "id": patient_profile.id,
                "date_of_birth": patient_profile.date_of_birth,
                "gender": patient_profile.gender,
                "phone": patient_profile.phone,
                "address": patient_profile.address
            }
    elif current_user.role == "doctor":
        doctor_profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == current_user.id).first()
        if doctor_profile:
            profile = {
                "id": doctor_profile.id,
                "specialty": doctor_profile.specialty,
                "bio": doctor_profile.bio,
                "phone": doctor_profile.phone
            }
            
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "profile": profile
    }
