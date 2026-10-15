# Workflow Architecture & Role Persona Matrix

This matrix defines the three user roles and their permitted workflows in the application.

---

## 1. System Administrator (`admin`)
- **Primary Goal:** System governance, infrastructure control, teacher onboarding, and global policy.
- **Allowed Pages / Capabilities:**
  - `AdminDashboard.jsx`: High-level metrics, system status, active session overview.
  - `ManageTeachers.jsx`: Create, edit, and deactivate teacher accounts; assign class sections.
  - `ManageStudentAccounts.jsx`: Reset passwords, link student accounts to learner roster IDs.
  - `Settings.jsx`: Configure classroom policy (attendance mode, GPS coordinates, geofence radius, QR time windows, SMS provider, theme switcher).
  - Activity Logs: Audit history of logins, roster changes, and setting modifications.
- **Restrictions:**
  - Does not scan student QR codes on a daily basis (reserved for classroom teachers).

---

## 2. Classroom Teacher / Adviser (`teacher`)
- **Primary Goal:** Daily classroom attendance management, learner welfare, and official DepEd compliance.
- **Allowed Pages / Capabilities:**
  - `TeacherDashboard.jsx`: Daily section summary, quick action cards.
  - `AttendanceScanner.jsx`: Real-time QR camera scanner and barcode input.
  - `Students.jsx`: Section roster management, enrollment verification toggle, QR code generation/printing.
  - `AttendanceHistory.jsx`: Historical logs for their section with CSV export and date filters.
  - `SF2Report.jsx`: Official DepEd School Form 2 monthly calculation, preview, and Excel download.
  - `SF2Progress.jsx`: Multi-month completion tracker for school year submissions.
  - `SMSLogs.jsx`: Review sent absence alerts and delivery statuses.
- **Restrictions:**
  - Strictly limited to students assigned to `teacher_id = req.user.id`.
  - Cannot alter global system settings or other teachers' accounts.

---

## 3. Learner / Student (`student`)
- **Primary Goal:** Self-service check-in transparency and attendance accountability.
- **Allowed Pages / Capabilities:**
  - `StudentPortal.jsx`:
    - Check-in scanner / token entry.
    - Personal monthly attendance calendar (visualizing Present, Late, and Absent days).
    - Summary badges (total present, late count, absence count).
    - Digital ID card with QR code.
- **Restrictions:**
  - Read-only access to their own attendance records (`student_id = req.user.student_id`).
  - No access to other learners' attendance data, teacher rosters, or admin controls.
