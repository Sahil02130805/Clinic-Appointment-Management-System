========================================================================
                 CLINIC APPOINTMENT MANAGEMENT SYSTEM
========================================================================

A secure FastAPI application paired with a premium glassmorphic dark-mode
single-page frontend. Designed for small clinics to manage patient
registration, doctor schedules, appointment bookings, notifications,
and patient medical history.

------------------------------------------------------------------------
1. FEATURES
------------------------------------------------------------------------
* Patient Portal: Register, view available doctors and time slots,
  book appointments, and check diagnostic/medical history records.
* Doctor Portal: Add/manage availability time slots, view scheduled
  patient consultations, and create medical records/prescriptions.
* JWT Security: Secure authentication and role-based access control.
* Automated Reminders: Simulated automated SMS/Email reminders triggered
  in the background using FastAPI's BackgroundTasks.
* Notification Center: View confirmation details and automated alerts.

------------------------------------------------------------------------
2. SYSTEM REQUIREMENTS & INSTALLATION
------------------------------------------------------------------------
Follow these steps to set up the project on your machine:

Step 1: Open a terminal inside the project root directory.

Step 2: Activate the virtual environment
        * On Windows (PowerShell):
          .\venv\Scripts\activate
        * On macOS / Linux:
          source venv/bin/activate

Step 3: Install dependencies:
        pip install -r requirements.txt

Step 4: Launch the server:
        python -m uvicorn app.main:app --reload

Step 5: Access the application:
        * Web Interface: http://127.0.0.1:8000/
        * API Docs: http://127.0.0.1:8000/docs

------------------------------------------------------------------------
3. TYPICAL TESTING FLOW & USER SCENARIOS
------------------------------------------------------------------------

SCENARIO A: DOCTOR REGISTRATION & AVAILABILITY
1. Open http://127.0.0.1:8000/
2. Go to the "Register" tab, select role "Doctor", and fill in details
   (e.g., Username: "dr_smith", Specialty: "Cardiology", Bio: "Cardiologist").
3. Log in as "dr_smith".
4. In the Doctor Dashboard under "Add Availability Slots", enter a future
   date range (e.g., Start: 2026-06-25 10:00 AM, End: 2026-06-25 11:00 AM).
5. Click "Add Time Slot" and verify it appears. Logout.

SCENARIO B: PATIENT BOOKING & AUTOMATED REMINDERS
1. Go to the "Register" tab, select role "Patient", and fill in details
   (e.g., Username: "jane_doe").
2. Log in as "jane_doe".
3. In the Patient Dashboard:
   * Select the doctor card for "Dr. dr_smith".
   * Click on the newly available time badge.
   * Write symptoms (e.g., "Mild chest pain").
   * Click "Complete Booking".
4. Check the "Alert & Reminders" sidebar on the right:
   * You will see the booking confirmation immediately.
   * After 5 seconds, you will receive an "Automated Reminder" notification
     delivered by the background scheduler!

SCENARIO C: MEDICAL RECORD & VISITS COMPLETION
1. Log out as the patient and log back in as doctor "dr_smith".
2. Under "Scheduled Patient Consultations", locate patient "jane_doe".
3. Click "Add Prescription".
4. Fill out the diagnosis ("Angina Pectoris") and prescription. Save.
5. The visit status is automatically set to "completed", and the record is
   saved under "Historical Patient Prescriptions".

------------------------------------------------------------------------
4. PROJECT STRUCTURE
------------------------------------------------------------------------
app/
├── database.py       - Database connection setup (SQLite / SQLAlchemy)
├── models.py         - SQLAlchemy Tables (Users, Profiles, Slots, Records)
├── schemas.py        - Pydantic models for validation and serialization
├── auth.py           - Password hashing (bcrypt) and JWT logic
├── main.py           - FastAPI app instance & routes mounting
├── routers/
│   ├── auth.py       - Auth endpoints
│   ├── doctors.py    - Doctors & slot availability routes
│   ├── appointments.py - Bookings and notifications
│   └── medical_records.py - Diagnostic/Prescription routes
└── static/
    ├── index.html    - UI single-page application (SPA)
    ├── styles.css    - Premium dark glassmorphism stylesheet
    └── app.js        - Dynamic AJAX endpoints logic
requirements.txt      - List of project packages
========================================================================
