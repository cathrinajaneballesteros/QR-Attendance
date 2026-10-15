# Role-Based Access Control (RBAC) Permission Matrix

| Resource / Endpoint | `admin` | `teacher` | `student` | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/attendance/scan` | ✅ (all) | ✅ (own section only) | ❌ | ❌ |
| `POST /api/student-account/check-in` | ❌ | ❌ | ✅ (self only) | ❌ |
| `GET /api/students` | ✅ (all / filter) | ✅ (own section only) | ❌ | ❌ |
| `POST /api/students` | ✅ | ✅ (assigned to self) | ❌ | ❌ |
| `PUT /api/students/:id/status` | ✅ | ✅ (own section only) | ❌ | ❌ |
| `GET /api/sf2/report` | ✅ (all) | ✅ (own section only) | ❌ | ❌ |
| `GET /api/sf2/download` | ✅ (all) | ✅ (own section only) | ❌ | ❌ |
| `GET /api/settings` | ✅ | ✅ (read-only) | ❌ | ❌ |
| `POST /api/settings` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/sms/logs` | ✅ (all) | ✅ (own section only) | ❌ | ❌ |
| `GET /api/student-account/calendar` | ❌ | ❌ | ✅ (self only) | ❌ |
| `GET /api/activity-logs` | ✅ | ❌ | ❌ | ❌ |

---

### Audit Logging Protocol
Whenever sensitive actions occur (e.g. attendance marking, roster status changes, settings updates), log them using `backend/services/activityLogger.js`:
```javascript
const { logActivity } = require('../services/activityLogger');

await logActivity(db, {
  role: req.user.role,
  userName: req.user.username,
  actionType: 'attendance_record',
  actionTitle: `Attendance Recorded: ${status.toUpperCase()}`,
  details: `${student.full_name} checked in ${status} at ${time}.`,
  targetName: student.full_name
});
```
