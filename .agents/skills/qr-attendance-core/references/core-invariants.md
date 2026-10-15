# Core Invariants Deep Dive

This document details the architectural and domain invariants that must remain unbroken in the **QR Attendance System**.

---

### Invariant 1: Offline-First Zero-Config
- **Implementation:** `qr-attendance-system/backend/database/db.js`
- **Behavior:**
  - If `process.env.DATABASE_URL` is empty, the database automatically starts via `sql.js` (WebAssembly SQLite) using the local file `attendance.db`.
  - No internet connection, docker container, or external cloud service is required.
  - The local database file is persisted to disk on write actions (`saveSqliteDB(db)`).
- **Rule for modifications:**
  - Any new route or query must function identically on both SQLite and PostgreSQL.
  - Never add top-level synchronous network calls during server startup that crash without internet.

---

### Invariant 2: Enrollment Verification Gating
- **Implementation:** `backend/routes/attendance.js` in `record()`
- **Condition:**
  ```javascript
  const isEnrolled = student.is_enrolled !== 0 && 
                     student.is_enrolled !== '0' && 
                     student.enrollment_status !== 'not_enrolled' && 
                     student.enrollment_status !== 'dropped';
  ```
- **Behavior:**
  - If `!isEnrolled`, attendance check-in is rejected with HTTP 403:
    `"Attendance Rejected: <Student Name> is NOT officially enrolled in this class roster."`
- **Rule for modifications:**
  - Every attendance recording path (QR scan, manual check-in, student self-check-in) MUST evaluate this condition before creating an `attendance` table row.

---

### Invariant 3: Single-Day Idempotency
- **Implementation:** `backend/routes/attendance.js`
- **Condition:**
  - A query checks `SELECT * FROM attendance WHERE student_id = ? AND date = ?`.
- **Behavior:**
  - If a row exists for the student on `YYYY-MM-DD`, no new row is inserted.
  - The API returns `{ duplicate: true, student: ..., time_in: ..., status: ... }`.
  - The frontend displays an informative amber notification ("Already recorded today at HH:MM").
- **Rule for modifications:**
  - Never allow multiple "time_in" check-ins per day for the same student unless an explicit "time_out" departure tracking mode is formally architected.

---

### Invariant 4: DepEd SF2 Standard Compliance
- **Implementation:** `backend/services/sf2Excel.js`
- **Official DepEd Symbols:**
  - **Present:** Blank / Empty cell
  - **Full-Day Absent:** Capital letter `X`
  - **AM Half-Day Absent (Late / Cutting Morning):** Thin upper diagonal border stroke
  - **PM Half-Day Absent (Cutting Afternoon):** Thin lower diagonal border stroke
- **Mathematical Invariants:**
  - Total Daily Attendance = Present Count + Late Count
  - Average Daily Attendance = Total Daily Attendance ÷ Number of Class Days
  - Attendance Rate % = (Average Daily Attendance ÷ Registered Learners) * 100
  - 5 Consecutive Absences = SARDO dropout risk flag

---

### Invariant 5: Multi-Adviser Scoping
- **Implementation:** `backend/routes/students.js`, `backend/routes/attendance.js`, `backend/routes/sf2.js`
- **Behavior:**
  - When `req.user.role === 'teacher'`, all queries filter by `teacher_id = req.user.id`.
  - Scanned QR codes are validated to ensure the student belongs to the authenticated teacher.
- **Rule for modifications:**
  - Any new endpoint returning student lists, statistics, or reports must implement role-based scoping.
