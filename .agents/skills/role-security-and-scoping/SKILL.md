---
name: role-security-and-scoping
description: >-
  Use this skill when implementing or modifying authentication, role-based authorization,
  teacher section multi-tenancy, or student account management.
---

# Role Security & Scoping Skill

This skill enforces access control boundaries, password security, and tenant isolation across the three system roles: **Admin**, **Teacher**, and **Student**.

## When to Use This Skill
- When creating or modifying backend route endpoints in `backend/routes/*.js`.
- When modifying `backend/middleware/auth.js`.
- When working on teacher section assignments or student credential management.
- When handling login and JWT token validation.

---

## The 3-Tier Security Hierarchy

```text
               ┌──────────────────────────────┐
               │         Administrator        │
               │  - Global settings & themes  │
               │  - Teacher account manager   │
               │  - Global audit log viewer   │
               └──────────────┬───────────────┘
                              │
               ┌──────────────┴───────────────┐
               │      Classroom Teacher       │
               │  - Scoped to teacher_id      │
               │  - Scans QR for section      │
               │  - Generates SF2 reports     │
               └──────────────┬───────────────┘
                              │
               ┌──────────────┴───────────────┐
               │       Learner (Student)      │
               │  - Scoped to student_id      │
               │  - Self check-in only        │
               │  - View own calendar         │
               └──────────────────────────────┘
```

---

## Non-Negotiable Scoping Rules

### 1. Teacher Section Scoping
A user with `role = 'teacher'` MUST ONLY access data for students assigned to their account:
- In `backend/routes/students.js`:
  ```javascript
  if (req.user.role === 'teacher') {
    query += ' WHERE teacher_id = ?';
    params.push(req.user.id);
  }
  ```
- In `backend/routes/attendance.js`:
  - Scanned QR code must verify `WHERE (qr_code = ? OR full_name = ?) AND teacher_id = ?`.
  - If the student belongs to another teacher, return HTTP 403: `"This learner belongs to another class adviser's roster."`
- In `backend/routes/sf2.js`:
  - Attendance summary and report must filter `WHERE s.teacher_id = ?`.

### 2. Learner Sandboxing
A user with `role = 'student'` MUST ONLY access their own records:
- In `backend/routes/student-account.js`:
  - Authenticated queries must verify `WHERE id = req.user.student_id` or `WHERE student_id = req.user.student_id`.
  - Learners cannot modify rosters, check-in other students, or access any other student's attendance history.

### 3. Password Hashing & Account Verification
- Passwords must be hashed using `bcrypt.hashSync(password, 10)` before insertion into `users`.
- Student account creation must verify that the created credentials authenticate properly against the database immediately following the insert/update to prevent orphaned accounts.

---

## Middleware Reference
- `auth`: Validates the Bearer JWT token in the `Authorization` header and attaches decoded payload to `req.user`.
- `staff`: Validates that `['admin', 'teacher'].includes(req.user.role)`.
- If unauthenticated, return `HTTP 401 { error: 'Authentication required' }`.
- If unauthorized, return `HTTP 403 { error: 'Forbidden' }`.
