const API_URL = ""; // Relative URL, since it's served on the same host

// Global State
let token = localStorage.getItem("token") || null;
let currentUser = null;
let selectedDoctorId = null;
let selectedSlotId = null;
let notifPollInterval = null;

// On Page Load
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Initialize Application
async function initApp() {
    if (token) {
        const success = await fetchCurrentUser();
        if (success) {
            showDashboard();
        } else {
            logout();
        }
    } else {
        showAuth();
    }
}

// Fetch Current User Info
async function fetchCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            return false;
        }
        
        if (!response.ok) {
            throw new Error("Failed to fetch user");
        }
        
        currentUser = await response.json();
        return true;
    } catch (err) {
        console.error("Auth init error:", err);
        return false;
    }
}

// Show Login/Register view
function showAuth() {
    document.getElementById("auth-view").style.display = "flex";
    document.getElementById("dashboard-view").style.display = "none";
    document.getElementById("nav-actions").style.display = "none";
    clearInterval(notifPollInterval);
}

// Show Dashboard based on Role
function showDashboard() {
    document.getElementById("auth-view").style.display = "none";
    document.getElementById("dashboard-view").style.display = "block";
    document.getElementById("nav-actions").style.display = "flex";
    
    // Set Header details
    document.getElementById("user-display-name").textContent = currentUser.username;
    const roleBadge = document.getElementById("user-role-badge");
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `role-tag ${currentUser.role}`;
    
    // Hide side bar for doctors/admins (or keep it if needed, but it's mainly for patient reminders)
    const sidebar = document.getElementById("sidebar-panel");
    const notifBell = document.getElementById("notif-bell");
    
    if (currentUser.role === "patient") {
        sidebar.style.display = "block";
        notifBell.style.display = "flex";
        
        document.getElementById("patient-dashboard").style.display = "block";
        document.getElementById("doctor-dashboard").style.display = "none";
        
        document.getElementById("patient-welcome-title").textContent = `Welcome back, ${currentUser.username}!`;
        
        // Load Patient Dashboard Data
        loadPatientData();
        
        // Start Polling Notifications (simulating automated reminders)
        fetchNotifications();
        notifPollInterval = setInterval(fetchNotifications, 4000);
    } else if (currentUser.role === "doctor") {
        sidebar.style.display = "none";
        notifBell.style.display = "none";
        
        // Adjust grid layout because sidebar is hidden
        document.querySelector(".dashboard-grid").style.gridTemplateColumns = "1fr";
        
        document.getElementById("patient-dashboard").style.display = "none";
        document.getElementById("doctor-dashboard").style.display = "block";
        
        document.getElementById("doctor-welcome-title").textContent = `Welcome back, Dr. ${currentUser.username}!`;
        
        // Load Doctor Dashboard Data
        loadDoctorData();
    }
}

// --- AUTHENTICATION ---
function switchAuthTab(tab) {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    
    if (tab === "login") {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
        tabLogin.classList.remove("active");
        tabRegister.classList.add("active");
        toggleRegFields();
    }
}

function toggleRegFields() {
    const role = document.getElementById("reg-role").value;
    const patientFields = document.getElementById("patient-fields");
    const doctorFields = document.getElementById("doctor-fields");
    
    if (role === "patient") {
        patientFields.style.display = "block";
        doctorFields.style.display = "none";
    } else {
        patientFields.style.display = "none";
        doctorFields.style.display = "block";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);
    
    try {
        const response = await fetch(`${API_URL}/api/auth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Authentication failed");
        }
        
        const data = await response.json();
        token = data.access_token;
        localStorage.setItem("token", token);
        
        showToast("Logged in successfully", "success");
        initApp();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const role = document.getElementById("reg-role").value;
    
    let payload = { username, email, password, role };
    
    if (role === "patient") {
        payload.date_of_birth = document.getElementById("reg-dob").value || null;
        payload.gender = document.getElementById("reg-gender").value || null;
        payload.phone = document.getElementById("reg-phone").value || null;
        payload.address = document.getElementById("reg-address").value || null;
    } else {
        payload.specialty = document.getElementById("reg-specialty").value || null;
        payload.phone = document.getElementById("reg-doc-phone").value || null;
        payload.bio = document.getElementById("reg-doc-bio").value || null;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Registration failed");
        }
        
        showToast("Registration successful! Please login.", "success");
        switchAuthTab("login");
        document.getElementById("login-username").value = username;
        document.getElementById("login-password").value = password;
    } catch (err) {
        showToast(err.message, "error");
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem("token");
    showAuth();
    showToast("Logged out", "success");
}

// --- PATIENT PORTAL LOGIC ---
async function loadPatientData() {
    fetchDoctors();
    fetchPatientAppointments();
    fetchPatientRecords();
}

async function fetchDoctors() {
    try {
        const response = await fetch(`${API_URL}/api/doctors`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not fetch doctors");
        
        const doctors = await response.json();
        const container = document.getElementById("booking-doctor-list");
        container.innerHTML = "";
        
        if (doctors.length === 0) {
            container.innerHTML = `<p class="text-muted">No doctors currently registered.</p>`;
            return;
        }
        
        doctors.forEach(doc => {
            const card = document.createElement("div");
            card.className = "doctor-card glass-panel";
            card.innerHTML = `
                <i class="fa-solid fa-user-doctor" style="font-size: 1.5rem; margin-bottom: 10px; color: var(--accent-patient);"></i>
                <h4>Dr. ${doc.user.username}</h4>
                <p style="font-weight: 600; color: white;">${doc.specialty}</p>
                <p style="font-size: 0.75rem; margin-top: 6px;">${doc.bio || "No biography details."}</p>
            `;
            card.onclick = () => selectDoctor(doc.id, card);
            container.appendChild(card);
        });
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function selectDoctor(doctorId, element) {
    selectedDoctorId = doctorId;
    selectedSlotId = null;
    
    // Highlight selected card
    document.querySelectorAll(".doctor-card").forEach(c => c.classList.remove("selected"));
    element.classList.add("selected");
    
    // Hide inputs until slot is chosen
    document.getElementById("booking-symptoms-container").style.display = "none";
    document.getElementById("booking-submit-container").style.display = "none";
    
    // Fetch slots
    try {
        const response = await fetch(`${API_URL}/api/doctors/${doctorId}/availability`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not fetch availability slots");
        
        const slots = await response.json();
        const slotsContainer = document.getElementById("booking-slots-container");
        const slotsList = document.getElementById("booking-slots-list");
        slotsList.innerHTML = "";
        slotsContainer.style.display = "block";
        
        if (slots.length === 0) {
            slotsList.innerHTML = `<p class="text-muted" style="grid-column: 1/-1;">No available time slots. Please ask the doctor to add hours.</p>`;
            return;
        }
        
        slots.forEach(slot => {
            const start = new Date(slot.start_time);
            const formattedTime = start.toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            
            const btn = document.createElement("div");
            btn.className = "slot-btn";
            btn.textContent = formattedTime;
            btn.onclick = () => selectSlot(slot.id, btn);
            slotsList.appendChild(btn);
        });
    } catch (err) {
        showToast(err.message, "error");
    }
}

function selectSlot(slotId, element) {
    selectedSlotId = slotId;
    
    document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
    element.classList.add("selected");
    
    document.getElementById("booking-symptoms-container").style.display = "block";
    document.getElementById("booking-submit-container").style.display = "block";
}

async function submitBooking() {
    const symptoms = document.getElementById("booking-symptoms").value.trim();
    if (!symptoms) {
        showToast("Please describe your symptoms", "error");
        return;
    }
    
    const payload = {
        doctor_id: selectedDoctorId,
        slot_id: selectedSlotId,
        symptoms: symptoms
    };
    
    try {
        const response = await fetch(`${API_URL}/api/appointments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Booking failed");
        }
        
        showToast("Appointment Booked! Confirmation notification created.", "success");
        
        // Reset Booking Panel
        document.getElementById("booking-symptoms").value = "";
        document.getElementById("booking-slots-container").style.display = "none";
        document.getElementById("booking-symptoms-container").style.display = "none";
        document.getElementById("booking-submit-container").style.display = "none";
        document.querySelectorAll(".doctor-card").forEach(c => c.classList.remove("selected"));
        selectedDoctorId = null;
        selectedSlotId = null;
        
        // Refresh Dashboard tables
        loadPatientData();
        fetchNotifications();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function fetchPatientAppointments() {
    try {
        const response = await fetch(`${API_URL}/api/appointments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not fetch appointments");
        
        const appointments = await response.json();
        const tbody = document.getElementById("patient-app-list");
        tbody.innerHTML = "";
        
        if (appointments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;" class="text-muted">No appointments booked yet.</td></tr>`;
            return;
        }
        
        appointments.forEach(app => {
            const dateStr = new Date(app.slot.start_time).toLocaleString();
            let actionBtn = "";
            if (app.status === "scheduled") {
                actionBtn = `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${app.id})"><i class="fa-solid fa-ban"></i> Cancel</button>`;
            }
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600;">Dr. ${app.doctor.user.username}</td>
                <td>${app.doctor.specialty}</td>
                <td>${dateStr}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${app.symptoms}</td>
                <td><span class="status-badge ${app.status}">${app.status}</span></td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function cancelAppointment(appId) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
        const response = await fetch(`${API_URL}/api/appointments/${appId}/cancel`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not cancel appointment");
        
        showToast("Appointment Cancelled", "success");
        initApp();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function fetchPatientRecords() {
    try {
        const response = await fetch(`${API_URL}/api/medical-records/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not fetch medical records");
        
        const records = await response.json();
        const tbody = document.getElementById("patient-records-list");
        tbody.innerHTML = "";
        
        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">No medical records found.</td></tr>`;
            return;
        }
        
        records.forEach(rec => {
            const dateStr = new Date(rec.created_at).toLocaleDateString();
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td style="font-weight:600;">Consultation Record</td>
                <td><span style="color: #60a5fa; font-weight:600;">${rec.diagnosis}</span></td>
                <td>${rec.prescription}</td>
                <td>${rec.treatment_plan || "N/A"}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, "error");
    }
}

// --- NOTIFICATION & REMINDER PANEL LOGIC ---
async function fetchNotifications() {
    try {
        const response = await fetch(`${API_URL}/api/appointments/notifications`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) return;
        
        const notifs = await response.json();
        const listContainer = document.getElementById("notif-list");
        listContainer.innerHTML = "";
        
        const unreadNotifs = notifs.filter(n => !n.is_read);
        const countBadge = document.getElementById("notif-count");
        
        if (unreadNotifs.length > 0) {
            countBadge.textContent = unreadNotifs.length;
            countBadge.style.display = "flex";
        } else {
            countBadge.style.display = "none";
        }
        
        if (notifs.length === 0) {
            listContainer.innerHTML = `<p class="text-muted" style="padding: 12px; font-size: 0.85rem;">No alerts or reminders.</p>`;
            return;
        }
        
        notifs.forEach(n => {
            const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const item = document.createElement("div");
            item.className = `notif-item ${n.is_read ? '' : 'unread'} ${n.type}`;
            item.innerHTML = `
                <div style="padding-right: 20px;">${n.message}</div>
                <div class="notif-time">${timeStr}</div>
                ${!n.is_read ? `<div class="notif-btn-read" onclick="markRead(${n.id})" title="Mark as read"><i class="fa-solid fa-circle-check"></i></div>` : ""}
            `;
            listContainer.appendChild(item);
        });
    } catch (err) {
        console.error("Notifications poll error:", err);
    }
}

async function markRead(notifId) {
    try {
        const response = await fetch(`${API_URL}/api/appointments/notifications/${notifId}/read`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            fetchNotifications();
        }
    } catch (err) {
        console.error("Mark read error:", err);
    }
}

// --- DOCTOR PORTAL LOGIC ---
async function loadDoctorData() {
    fetchDoctorSlots();
    fetchDoctorAppointments();
}

async function fetchDoctorSlots() {
    try {
        const response = await fetch(`${API_URL}/api/doctors/availability/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not fetch availability slots");
        
        const slots = await response.json();
        const container = document.getElementById("doctor-slots-list");
        container.innerHTML = "";
        
        if (slots.length === 0) {
            container.innerHTML = `<p class="text-muted" style="padding: 10px;">No slots configured. Set hours above.</p>`;
            return;
        }
        
        slots.forEach(slot => {
            const start = new Date(slot.start_time).toLocaleString();
            const end = new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const item = document.createElement("div");
            item.className = "availability-item";
            item.innerHTML = `
                <div>
                    <i class="fa-regular fa-clock" style="margin-right: 8px; color: var(--accent-doctor);"></i>
                    <span>${start} - ${end}</span>
                </div>
                <span class="availability-status ${slot.is_booked ? 'booked' : 'available'}">
                    ${slot.is_booked ? 'Booked' : 'Available'}
                </span>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function handleCreateSlot(e) {
    e.preventDefault();
    const startTime = document.getElementById("slot-start").value;
    const endTime = document.getElementById("slot-end").value;
    
    const payload = {
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
    };
    
    try {
        const response = await fetch(`${API_URL}/api/doctors/availability`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to add slot");
        }
        
        showToast("Availability slot added successfully", "success");
        document.getElementById("slot-start").value = "";
        document.getElementById("slot-end").value = "";
        fetchDoctorSlots();
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function fetchDoctorAppointments() {
    try {
        const response = await fetch(`${API_URL}/api/appointments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not fetch doctor schedule");
        
        const appointments = await response.json();
        const tbody = document.getElementById("doctor-app-list");
        tbody.innerHTML = "";
        
        const historyTbody = document.getElementById("doctor-records-list");
        historyTbody.innerHTML = "";
        
        let activeCount = 0;
        let historyCount = 0;
        
        appointments.forEach(app => {
            const dateStr = new Date(app.slot.start_time).toLocaleString();
            
            if (app.status === "scheduled") {
                activeCount++;
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="font-weight:600;">${app.patient.user.username}</td>
                    <td>${dateStr}</td>
                    <td style="max-width: 250px;">${app.symptoms}</td>
                    <td><span class="status-badge scheduled">Scheduled</span></td>
                    <td>
                        <button class="btn btn-doctor btn-sm" onclick="openRecordModal(${app.id}, ${app.patient.id}, '${app.patient.user.username}')">
                            <i class="fa-solid fa-notes-medical"></i> Add Prescription
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            } else if (app.status === "completed") {
                historyCount++;
                // Fetch medical record details if completed
                const tr = document.createElement("tr");
                const notes = app.notes || "None";
                
                tr.innerHTML = `
                    <td>${dateStr}</td>
                    <td style="font-weight:600;">${app.patient.user.username}</td>
                    <td><span style="color: var(--success); font-weight:600;">Completed</span></td>
                    <td>Prescription / Diagnosis recorded</td>
                    <td>Medical Record Created</td>
                `;
                // To fetch diagnosis/prescription, we could make an api query or load from relationship if exposed
                // For simplicity, let's load patient record details by requesting this patient's records
                fetchAndRenderDoctorRecordRow(app.patient.id, tr, dateStr, app.patient.user.username);
                historyTbody.appendChild(tr);
            }
        });
        
        if (activeCount === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">No scheduled consultations.</td></tr>`;
        }
        if (historyCount === 0) {
            historyTbody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="text-muted">No completed patient histories found.</td></tr>`;
        }
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function fetchAndRenderDoctorRecordRow(patientId, trElement, dateStr, patientName) {
    try {
        const response = await fetch(`${API_URL}/api/medical-records/patient/${patientId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) return;
        const records = await response.json();
        
        if (records.length > 0) {
            const rec = records[0]; // Get latest record
            trElement.innerHTML = `
                <td>${new Date(rec.created_at).toLocaleDateString()}</td>
                <td style="font-weight:600;">${patientName}</td>
                <td><span style="color: #22d3ee; font-weight:600;">${rec.diagnosis}</span></td>
                <td>${rec.prescription}</td>
                <td>${rec.treatment_plan || "N/A"}</td>
            `;
        }
    } catch (err) {
        console.error("Error fetching record preview:", err);
    }
}

// --- MEDICAL RECORD MODAL LOGIC ---
function openRecordModal(appId, patientId, username) {
    document.getElementById("record-app-id").value = appId;
    document.getElementById("record-patient-id").value = patientId;
    document.getElementById("record-patient-name").value = username;
    
    document.getElementById("record-diagnosis").value = "";
    document.getElementById("record-prescription").value = "";
    document.getElementById("record-treatment").value = "";
    
    document.getElementById("record-modal").style.display = "flex";
}

function closeRecordModal() {
    document.getElementById("record-modal").style.display = "none";
}

async function handleSubmitRecord(e) {
    e.preventDefault();
    
    const appId = parseInt(document.getElementById("record-app-id").value);
    const patientId = parseInt(document.getElementById("record-patient-id").value);
    const diagnosis = document.getElementById("record-diagnosis").value.trim();
    const prescription = document.getElementById("record-prescription").value.trim();
    const treatmentPlan = document.getElementById("record-treatment").value.trim();
    
    const payload = {
        appointment_id: appId,
        patient_id: patientId,
        diagnosis: diagnosis,
        prescription: prescription,
        treatment_plan: treatmentPlan || null
    };
    
    try {
        const response = await fetch(`${API_URL}/api/medical-records`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || "Failed to create medical record");
        }
        
        showToast("Prescription recorded & appointment completed!", "success");
        closeRecordModal();
        loadDoctorData();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// --- UTILITIES ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="this.parentElement.remove()"></i>
    `;
    container.appendChild(toast);
    
    // Auto-remove toast after 4s
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function toggleNotifPanel() {
    // Scroll notifications into view in sidebar on mobile or simply show sidebar
    const sidebar = document.getElementById("sidebar-panel");
    sidebar.scrollIntoView({ behavior: 'smooth' });
    
    // Highlight sidebar briefly
    sidebar.style.borderColor = "var(--accent-patient)";
    setTimeout(() => {
        sidebar.style.borderColor = "var(--border-color)";
    }, 1500);
}
