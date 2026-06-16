from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, doctors, appointments, medical_records

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Clinic Appointment Management System",
    description="Secured with JWT authentication, enabling doctor scheduling, patient booking, medical records, and automated reminders.",
    version="1.0.0"
)

# CORS middleware config (to allow frontend dev servers or API clients to access backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(medical_records.router)

# Mount static files directory
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Serve Frontend SPA
@app.get("/")
def read_root():
    return FileResponse("app/static/index.html")
