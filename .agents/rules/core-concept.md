# Core Concept Enforcement Rule

### Rule Scope
This rule applies to all code generation, refactoring, and feature requests across this repository.

### Mandatory Directives
1. **Attendance-First Focus:** Never allow features outside attendance tracking, DepEd SF2 reporting, and classroom accountability (no grading systems, LMS courses, tuition fees, or chat feeds).
2. **Never Break Offline SQLite:** All database queries must run on local SQLite (`attendance.db`) out-of-the-box when `DATABASE_URL` is omitted.
3. **Use Portable Parameter Placeholders:** Use `?` in all SQL statements. Never write Postgres-only syntax `$1` in shared routes.
4. **Enforce Enrollment Gating:** An attendance row may only be created if `is_enrolled === 1` and `enrollment_status === 'officially_enrolled'`.
5. **Preserve DepEd SF2 Formulas:** Present is represented as blank, full-day absent is 'X', half-day absences are thin diagonal strokes. Maintain gender-segregated ordering (males first, females second, alphabetical by surname).
6. **Enforce Teacher Section Isolation:** Any query executed for `req.user.role === 'teacher'` must be scoped by `teacher_id = req.user.id`.
