---
name: qr-attendance-core
description: >-
  Use this skill to maintain the core identity, architectural integrity, and functional scope
  of the Sta. Rosa Elementary School QR Code Attendance System. Use whenever reviewing, planning,
  or implementing features to ensure anti-bloat principles, attendance-first workflows, and
  adherence to system invariants.
---

# QR Attendance Core Identity & Scope Skill

This skill anchors all development to the core purpose and non-negotiable boundaries of the **Sta. Rosa Elementary School QR Code Attendance System**.

## When to Use This Skill
- When planning any new feature, page, API endpoint, or refactoring.
- When reviewing user requests to detect and prevent scope creep.
- When verifying whether a change complies with system invariants.
- Before committing any changes that touch attendance records, rosters, or database models.

---

## The Core Concept
The system is an elementary school daily attendance management system designed for:
1. Fast, offline-capable QR code scanning and learner self-service check-in.
2. Official DepEd School Form 2 (SF2) monthly report generation and Excel export.
3. Configurable classroom attendance policy (Onsite GPS geofencing vs Flipped Classroom flexibility, late cutoffs, QR active windows).
4. Parent communication (SMS alerts and consecutive absence warnings).
5. Teacher section autonomy (advisers only manage their assigned students).

---

## 🚫 Anti-Scope-Creep Guardrails (Explicit Out-of-Scope Modules)
The agent must **REJECT or REFOCUS** any attempt to transform this web app into:
- **A Learning Management System (LMS):** No assignments, quizzes, homework submissions, study notes, or syllabus management.
- **A Grading System:** No DepEd SF9 (Report Card), SF10 (Form 137), GPA calculators, or quarterly grading sheets.
- **A Financial / Fee Management Portal:** No tuition payments, PTA fees, school merchandise, or payment gateway integrations.
- **A Social Network:** No student messaging boards, general forums, newsfeeds, or profile photoshoots.
- **A Generic School ERP:** Do not add inventory management, library book tracking, or bus fleet tracking.

If the user asks for these, reply:
> *"This application is specialized strictly for daily attendance tracking, classroom policy enforcement, and DepEd SF2 monthly reporting. To preserve high performance and reliability, we keep the core focused on attendance."*

---

## 5 Non-Negotiable Invariants

1. **Zero-Config Offline First:**
   The backend must run completely offline using SQLite (`attendance.db`) when `DATABASE_URL` is omitted. Never introduce mandatory cloud services or API dependencies for basic local operation.

2. **Strict Enrollment Gating:**
   Only learners with `is_enrolled = 1` and `enrollment_status = 'officially_enrolled'` can record attendance. Students marked `not_enrolled` or `dropped` are blocked from check-in.

3. **Single-Day Idempotency:**
   Each student can have at most ONE attendance record per calendar date (`YYYY-MM-DD`). A second scan must safely return `{ duplicate: true }` with their recorded `time_in` without modifying or overwriting the original entry.

4. **DepEd SF2 Format Compliance:**
   Attendance reports and calculations must strictly match official DepEd School Form 2 standards:
   - Present: Blank cell
   - Whole Day Absent: `X`
   - AM Half-Day Absent: Thin upper diagonal line
   - PM Half-Day Absent: Thin lower diagonal line
   - Consecutive 5 Absences: Flagged as SARDO (Student at Risk of Dropping Out)

5. **Teacher Section Scoping:**
   Teachers (`role = 'teacher'`) must only see and modify students assigned to their `teacher_id`. Cross-teacher data leaks are security violations.

---

## Verification & Health Check Procedure

To verify that the application still adheres to all core invariants, execute the integrity verification script:

```bash
node .agents/skills/qr-attendance-core/scripts/check-core-integrity.js
```

The script automatically tests:
- Database driver readiness (SQLite and PostgreSQL compatibility)
- Required schema tables and default settings
- Enrollment gating logic
- Idempotency guardrails
- DepEd SF2 report calculation formulas
- Teacher isolation constraints

---

## References & Documentation
- [Core Invariants Deep Dive](./references/core-invariants.md)
- [Workflow Architecture & Personas](./references/workflow-matrix.md)
