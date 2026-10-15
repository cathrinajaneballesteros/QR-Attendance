---
name: attendance-policy-guard
description: >-
  Use this skill when modifying QR code scanning, manual attendance entry, student self-service
  check-in, classroom geofencing, flipped classroom switching, or attendance schedule policies.
---

# Attendance Policy Guard Skill

This skill enforces classroom attendance policy compliance, location verification, and enrollment security.

## When to Use This Skill
- When editing attendance scanning routes in `backend/routes/attendance.js`.
- When updating policy settings in `backend/routes/settings.js`.
- When working on the QR scanner UI in `frontend/src/pages/AttendanceScanner.jsx`.
- When working on learner check-in logic in `frontend/src/pages/StudentPortal.jsx`.

---

## 7-Step Check-In Validation Pipeline
Every attendance recording attempt must pass through this strict pipeline in order:

```text
Incoming Scan Request (student_id / qr_code, lat, lon)
                     │
                     ▼
       1. Is QR Attendance Enabled?
       (settings.qr_enabled !== '0')
                     │ YES
                     ▼
       2. Is Current Time within QR Window?
       (qr_start <= Now <= qr_end, if set)
                     │ YES
                     ▼
       3. Is Classroom Mode Onsite or Flipped?
       ├─ If 'flipped' ➔ Bypass GPS check
       └─ If 'onsite' and gps_enabled === '1' ➔ Enforce Haversine distance <= radius_m
                     │ PASS
                     ▼
       4. Is Learner Officially Enrolled?
       (is_enrolled === 1 && enrollment_status === 'officially_enrolled')
                     │ YES
                     ▼
       5. Has Learner Already Checked In Today?
       (Check attendance table for student_id on today's date)
       ├─ If YES ➔ Return { duplicate: true, original_record }
       └─ If NO  ➔ Proceed to Step 6
                     │
                     ▼
       6. Determine Status: 'present' or 'late'
       (If local time > settings.late_after ➔ 'late', else 'present')
                     │
                     ▼
       7. Record Attendance & Trigger SMS/Activity Logs
       (Insert row, log to activity_logs, notify parent via SMS if late)
```

---

## Geofencing Logic (Onsite vs Flipped Classroom)
The school policy supports two educational modes:

1. **Onsite Mode (`attendance_mode = 'onsite'`):**
   - Designed for standard in-person physical school days.
   - If `gps_enabled = '1'`, students/teachers must submit device latitude and longitude.
   - Uses the Haversine great-circle distance formula against `school_latitude` and `school_longitude`.
   - If distance exceeds `geofence_radius_m` (default 100 meters), check-in is rejected with:
     `"Outside school grounds (Xm away, allowed: Ym). Attendance must be recorded onsite."`

2. **Flipped Classroom Mode (`attendance_mode = 'flipped'`):**
   - Designed for remote learning days, modular distance learning, typhoons, or blended schedules.
   - GPS distance checking is **strictly bypassed**. Learners can check in from their homes or remote study stations.

---

## Time Windows & Lateness Policy
- `school_start`: Official school start time (default `'08:00'`).
- `late_after`: Threshold time for lateness (default `'08:00'`).
  - Arrival $\le$ `late_after`: Marked `'present'`.
  - Arrival $>$ `late_after`: Marked `'late'`.
- `attendance_deadline`: Cutoff time after which unrecorded students are marked absent by the automated evening notifier (default `'16:00'`).
- `qr_start` / `qr_end`: Optional ISO timestamps restricting the active camera scanning window.

---

## Critical Rules to Preserve
- Never disable enrollment verification check. If an unenrolled learner scans, immediately return HTTP 403.
- Never overwrite an existing attendance row for the current date. Always preserve the original `time_in`.
- Always store timestamps in Philippine Standard Time (`Asia/Manila` timezone, UTC+8).
