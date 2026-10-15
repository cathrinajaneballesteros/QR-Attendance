# Sta. Rosa Elementary School - QR Attendance System
## Project Charter & Core Concept Invariants (AGENTS.md)

This file defines the immutable core purpose, architectural principles, and operational rules for the **QR Code Attendance System** (Grade 6 Great Geniuses & Multi-Section).

Any AI agent, developer, or automated contributor operating on this codebase MUST strictly adhere to these core concepts. Do NOT deviate from this charter.

---

### 1. Core Purpose & Mission
The sole purpose of this web application is to provide:
1. **Rapid, reliable daily student attendance tracking** via QR code scanning and student PIN/token self check-in.
2. **Official DepEd School Form 2 (SF2) monthly reporting**, calculations, and Excel exports meeting Philippine Department of Education specifications.
3. **Classroom policy enforcement**, including Onsite GPS geofencing vs Flipped Classroom flexibility, late cutoffs, and enrollment gating.
4. **Student accountability and parent communication** via automated absence tracking, 5-day consecutive absence alerts (SARDO), and SMS notifications.
5. **Multi-adviser section isolation** (teachers only access their assigned section) with centralized administrative oversight.

---

### 2. Strict Boundary Restrictions (Anti-Scope-Creep Guardrails)
To keep this web app fast, focused, and maintainable, the following are **STRICTLY FORBIDDEN**:
- ❌ **NO Learning Management System (LMS)** features (assignments, quizzes, modules, file submissions).
- ❌ **NO Grading System** (DepEd SF9/SF10, quarterly grade computation, report card publishing).
- ❌ **NO Payment/Tuition/Fee Processing** (the school is a public elementary school).
- ❌ **NO Social Feeds, Chat Rooms, or Discussion Boards**.
- ❌ **NO Third-Party Heavy Analytics / Tracking Trackers**.

*If a user prompt seems to ask for any of the above, clarify and guide them back to attendance and DepEd SF2 reporting.*

---

### 3. Non-Negotiable Technical Invariants

| Invariant | Rule |
| :--- | :--- |
| **Offline-First Zero-Config** | The system MUST function locally out-of-the-box using SQLite (`attendance.db`) with zero internet connection or environment variables needed. Never make cloud Supabase connection mandatory for local development. |
| **Dual-Database Parity** | Every database operation and schema migration must run identically on both SQLite (`sql.js`) and Supabase PostgreSQL (`pg.Pool`). Queries must use `?` placeholders translated by `db.js`. |
| **Enrollment Gating** | ONLY learners with `is_enrolled = 1` and `enrollment_status = 'officially_enrolled'` may record attendance. Unenrolled, dropped, or transferred learners are strictly blocked. |
| **Single-Day Idempotency** | Exactly ONE attendance record per student per calendar date (`YYYY-MM-DD`). A second scan must report "Already recorded today" with existing `time_in` without altering the original record. |
| **DepEd SF2 Standard** | Attendance marking on SF2 must follow DepEd rules: Blank for Present, `X` for Full-Day Absent, thin diagonal strokes for AM/PM Half-Day Absences. Roster must list Males first, then Females, alphabetical by surname. |
| **Teacher Section Scoping** | All queries executed for users with role `teacher` MUST be scoped by `teacher_id = req.user.id`. Teachers must never access another adviser's students or records. |

---

### 4. Specialized Workspace Skills
Antigravity skills have been developed in `.agents/skills/` to provide executable procedures for every core domain:

1. **`qr-attendance-core`**: Master skill for core architectural integrity and anti-scope-creep enforcement.
2. **`deped-sf2-engine`**: Official DepEd School Form 2 formulas, cell formatting, Excel generation, and SARDO tracking.
3. **`attendance-policy-guard`**: Geofencing (Onsite vs Flipped), time windows, enrollment gating, and check-in idempotency.
4. **`dual-database-guard`**: Dual SQLite & PostgreSQL compatibility, parameterization, and schema migration rules.
5. **`role-security-and-scoping`**: RBAC permissions, teacher isolation, learner sandboxing, and token security.

Whenever operating on any of these areas, consult the corresponding skill's `SKILL.md` file first!
