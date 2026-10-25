const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { notify } = require('../services/notifications');

// Euclidean distance between two 128-float face descriptor vectors
function computeFaceDistance(descA, descB) {
  if (!descA || !descB || descA.length !== descB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < descA.length; i++) {
    const d = descA[i] - descB[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

const FACE_MATCH_THRESHOLD = 0.52;

function staff(req, res, next) {
  if (!['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Teacher or admin account required' });
  }
  next();
}

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((o, p) => (o[p.type] = p.value, o), {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    display: new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  };
}

function distance(a, b, c, d) {
  const r = 6371000;
  const rad = x => x * Math.PI / 180;
  const x = rad(c - a);
  const y = rad(d - b);
  return 2 * r * Math.asin(Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2));
}

async function getSettingsMap(db) {
  const rows = await db.prepare('SELECT setting_key, setting_value FROM app_settings').all();
  return Object.fromEntries(
    (rows || []).map(x => [x.setting_key, x.setting_value])
  );
}

async function checkPolicy(db, body, qr = false) {
  const settings = await getSettingsMap(db);
  const now = localParts();

  if (qr && settings.qr_enabled === '0') {
    return 'QR attendance is currently disabled by administrator/teacher policy';
  }

  const qrDate = value => value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? new Date(value + ':00+08:00').getTime()
    : new Date(value).getTime();

  if (qr && settings.qr_start && qrDate(settings.qr_start) > Date.now()) {
    return 'QR attendance window has not started yet (valid from ' + settings.qr_start + ')';
  }

  if (qr && settings.qr_end && qrDate(settings.qr_end) < Date.now()) {
    return 'QR attendance period has expired (ended at ' + settings.qr_end + ')';
  }

  // GPS check: only enforced if mode is 'onsite' and gps_enabled is '1'.
  // If mode is 'flipped' (flipped classroom setup), GPS verification is bypassed!
  const isFlipped = settings.attendance_mode === 'flipped';
  if (!isFlipped && settings.gps_enabled === '1') {
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    const schoolLat = Number(settings.school_latitude);
    const schoolLon = Number(settings.school_longitude);

    if (body.latitude === undefined || body.longitude === undefined || !settings.school_latitude || !settings.school_longitude || ![lat, lon, schoolLat, schoolLon].every(Number.isFinite)) {
      return 'GPS verification is enabled (Onsite mode) but your location is unavailable. Please allow location permissions or set school coordinates in settings.';
    }

    const dist = distance(lat, lon, schoolLat, schoolLon);
    const maxRadius = Number(settings.geofence_radius_m) || 100;
    if (dist > maxRadius) {
      return `Outside school grounds (${Math.round(dist)}m away, allowed: ${maxRadius}m). Attendance must be recorded onsite.`;
    }
  }

  return null;
}

async function record(db, student, who, location, faceVerified = 0) {
  const settings = await getSettingsMap(db);

  // Requirement 11: Only officially enrolled students can do attendance
  const isEnrolled = student.is_enrolled !== 0 && student.is_enrolled !== '0' && student.enrollment_status !== 'not_enrolled' && student.enrollment_status !== 'dropped';
  if (!isEnrolled) {
    return {
      blocked: true,
      error: `Attendance Rejected: ${student.full_name} is NOT officially enrolled in this class roster. Only officially enrolled students can record attendance.`,
      student: student.full_name
    };
  }

  const now = localParts();
  const existing = await db.prepare('SELECT * FROM attendance WHERE student_id = ? AND date = ?').get(student.id, now.date);

  if (existing) {
    return {
      duplicate: true,
      student: student.full_name,
      time_in: existing.time_in,
      status: existing.status,
      display_status: existing.status === 'present' ? 'On Time' : (existing.status === 'late' ? 'Late' : 'Absent'),
      room: existing.room || settings.room_name || 'Room 101',
      face_verified: existing.face_verified || 0
    };
  }

  const status = (settings.late_after && now.time > settings.late_after) ? 'late' : 'present';
  const room = settings.room_name || 'Room 101 - Grade 6 Great Geniuses';

  await db.prepare(
    'INSERT INTO attendance (student_id, date, time_in, status, recorded_by, latitude, longitude, room, face_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    student.id,
    now.date,
    now.display,
    status,
    who,
    location.latitude || null,
    location.longitude || null,
    room,
    faceVerified
  );

  if (status === 'late') {
    try {
      await notify(db, student, 'late', `Attendance notice: ${student.full_name} arrived late at ${now.display} on ${now.date} (${room}).`);
    } catch (ne) {
      console.warn('Late notification notice:', ne.message);
    }
  }

  try {
    const { logActivity } = require('../services/activityLogger');
    const role = who === 'admin' ? 'admin' : 'teacher';
    const faceNote = faceVerified ? ' [Face Verified ✓]' : (student.face_descriptor ? ' [Face Not Verified]' : ' [No Face Profile]');
    await logActivity(db, {
      role: role,
      userName: who,
      actionType: 'attendance_record',
      actionTitle: `Attendance Recorded: ${status.toUpperCase()}${faceNote}`,
      details: `${student.full_name} checked in ${status} at ${now.display} on ${now.date} (${room}).`,
      targetName: student.full_name
    });
  } catch (logErr) {}

  return {
    student: student.full_name,
    time_in: now.display,
    date: now.date,
    status,
    display_status: status === 'present' ? 'On Time' : 'Late',
    room,
    face_verified: faceVerified
  };
}

// QR Scan route
router.post('/scan', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    const policy = await checkPolicy(db, req.body, true);
    if (policy) return res.status(403).json({ error: policy });

    const code = (req.body.qr_code || '').trim();
    let student = null;
    if (req.user.role === 'teacher') {
      student = await db.prepare('SELECT * FROM students WHERE (qr_code = ? OR full_name = ?) AND teacher_id = ?').get(code, code, req.user.id);
      if (!student) {
        const other = await db.prepare('SELECT * FROM students WHERE qr_code = ? OR full_name = ?').get(code, code);
        if (other) {
          return res.status(403).json({ error: 'This learner belongs to another class adviser\'s roster.' });
        }
        return res.status(404).json({ error: 'Learner not found in your class roster.' });
      }
    } else {
      student = await db.prepare('SELECT * FROM students WHERE qr_code = ? OR full_name = ?').get(code, code);
      if (!student) return res.status(404).json({ error: 'Learner not found in class database.' });
    }

    // ── Biometric Anti-Proxy Face Verification ──────────────────────────────
    const settings = await getSettingsMap(db);
    const verificationMode = req.body.verification_mode || (settings.scanner_verification_mode === 'qr' ? 'qr' : 'both');
    const faceVerificationPolicy = settings.student_face_verification || '1';
    const incomingDescriptor = req.body.faceDescriptor;
    let faceVerified = 0;
    let faceNotEnrolled = false;

    if (verificationMode !== 'qr' && faceVerificationPolicy !== '0') {
      if (student.face_descriptor) {
        // Student has an enrolled face profile — MUST match
        if (!incomingDescriptor || !Array.isArray(incomingDescriptor) || incomingDescriptor.length < 68) {
          // If mode is 'both' or policy is strict, reject if face descriptor is missing
          if (verificationMode === 'both' || faceVerificationPolicy === 'strict') {
            return res.status(403).json({
              error: `Biometric verification required: ${student.full_name} has facial recognition enabled. The scanner must verify the student's face before recording attendance.`,
              face_required: true
            });
          }
          // Standard mode: allow but mark as unverified
          faceVerified = 0;
        } else {
          try {
            const storedDesc = JSON.parse(student.face_descriptor);
            const distance = computeFaceDistance(incomingDescriptor, storedDesc);

            if (distance > FACE_MATCH_THRESHOLD) {
              // FACE MISMATCH — anti-proxy block
              try {
                const { logActivity } = require('../services/activityLogger');
                await logActivity(db, {
                  role: req.user.role,
                  userName: req.user.username,
                  actionType: 'security_alert',
                  actionTitle: `⚠️ Proxy Attendance Blocked: ${student.full_name}`,
                  details: `Face mismatch detected. Distance: ${distance.toFixed(3)} (threshold: ${FACE_MATCH_THRESHOLD}). Proxy attempt rejected.`,
                  targetName: student.full_name
                });
              } catch (logErr) {}

              return res.status(403).json({
                error: `Biometric Security Alert: The face in view does not match the registered profile for ${student.full_name}. Proxy attendance is not allowed.`,
                face_mismatch: true,
                student: student.full_name,
                confidence: (Math.max(0, 1 - distance) * 100).toFixed(1) + '%'
              });
            }

            faceVerified = 1;
          } catch (parseErr) {
            console.warn('Error parsing student face descriptor:', parseErr.message);
            faceVerified = 0;
          }
        }
      } else {
        // Student does not have an enrolled face — allow but note no profile
        faceNotEnrolled = true;
        faceVerified = 0;
      }
    }
    // ── End Face Verification ────────────────────────────────────────────────

    const result = await record(db, student, req.user.username, req.body, faceVerified);
    if (result.blocked) {
      return res.status(403).json({ error: result.error, blocked: true, student: result.student });
    }

    res.json(Object.assign({
      message: result.duplicate ? 'Already recorded today' : 'Attendance recorded',
      duplicate: !!result.duplicate,
      face_not_enrolled: faceNotEnrolled
    }, result));
  } catch (err) {
    console.error('Scan attendance error:', err.message);
    res.status(500).json({ error: 'Server error processing attendance scan' });
  }
});

// Face Biometric Roster (for fast client-side recognition in Face-Only mode)
router.get('/face-roster', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    if (db.isPostgres) {
      await db.exec('ALTER TABLE students ADD COLUMN IF NOT EXISTS face_descriptor TEXT');
    }
    let sql = "SELECT id, full_name, lrn, sex, face_descriptor FROM students WHERE is_enrolled = 1 AND enrollment_status = 'officially_enrolled' AND face_descriptor IS NOT NULL AND face_descriptor != ''";
    const params = [];
    if (req.user.role === 'teacher') {
      sql += ' AND teacher_id = ?';
      params.push(req.user.id);
    }
    sql += ' ORDER BY full_name ASC';
    const students = await db.prepare(sql).all(...params);
    res.json(students || []);
  } catch (err) {
    console.error('Get face roster error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve face biometric roster' });
  }
});

// Face-Only Attendance Check-in Route
router.post('/face-scan', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    if (db.isPostgres) {
      await db.exec('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS face_verified INTEGER DEFAULT 0');
    }
    const policy = await checkPolicy(db, req.body, true);
    if (policy) return res.status(403).json({ error: policy });

    const incomingDescriptor = req.body.faceDescriptor;
    if (!incomingDescriptor || !Array.isArray(incomingDescriptor) || incomingDescriptor.length < 68) {
      return res.status(400).json({ error: 'Valid facial descriptor vector is required for biometric check-in.' });
    }

    let student = null;
    let matchDistance = Infinity;

    // Case 1: Student ID is provided by client-side matcher
    if (req.body.student_id) {
      if (req.user.role === 'teacher') {
        student = await db.prepare(
          "SELECT * FROM students WHERE id = ? AND teacher_id = ? AND is_enrolled = 1 AND enrollment_status = 'officially_enrolled'"
        ).get(req.body.student_id, req.user.id);
      } else {
        student = await db.prepare(
          "SELECT * FROM students WHERE id = ? AND is_enrolled = 1 AND enrollment_status = 'officially_enrolled'"
        ).get(req.body.student_id);
      }

      if (!student) {
        return res.status(404).json({ error: 'Enrolled student record not found in class roster.' });
      }

      if (!student.face_descriptor) {
        return res.status(400).json({ error: 'Student does not have an enrolled face biometric profile.' });
      }

      try {
        const storedDesc = JSON.parse(student.face_descriptor);
        matchDistance = computeFaceDistance(incomingDescriptor, storedDesc);
      } catch (e) {
        return res.status(500).json({ error: 'Corrupt stored biometric profile for student.' });
      }

      if (matchDistance > FACE_MATCH_THRESHOLD) {
        return res.status(403).json({
          error: `Biometric verification failed: Face does not match registered profile for ${student.full_name}.`,
          face_mismatch: true,
          student: student.full_name,
          confidence: (Math.max(0, 1 - matchDistance) * 100).toFixed(1) + '%'
        });
      }
    } else {
      // Case 2: Direct server-side 1:N biometric search
      let rosterSql = "SELECT * FROM students WHERE is_enrolled = 1 AND enrollment_status = 'officially_enrolled' AND face_descriptor IS NOT NULL AND face_descriptor != ''";
      const rosterParams = [];
      if (req.user.role === 'teacher') {
        rosterSql += ' AND teacher_id = ?';
        rosterParams.push(req.user.id);
      }
      const candidates = await db.prepare(rosterSql).all(...rosterParams);

      let bestStudent = null;
      let bestDist = Infinity;

      for (const cand of (candidates || [])) {
        try {
          const storedDesc = JSON.parse(cand.face_descriptor);
          const dist = computeFaceDistance(incomingDescriptor, storedDesc);
          if (dist < bestDist) {
            bestDist = dist;
            bestStudent = cand;
          }
        } catch (e) {}
      }

      if (!bestStudent || bestDist > FACE_MATCH_THRESHOLD) {
        return res.status(404).json({
          error: 'Face not recognized. Please face the camera clearly or scan QR badge.',
          confidence: bestDist !== Infinity ? (Math.max(0, 1 - bestDist) * 100).toFixed(1) + '%' : null
        });
      }

      student = bestStudent;
      matchDistance = bestDist;
    }

    // Record attendance with face_verified = 1
    const result = await record(db, student, req.user.username, req.body, 1);
    if (result.blocked) {
      return res.status(403).json({ error: result.error, blocked: true, student: result.student });
    }

    res.json(Object.assign({
      message: result.duplicate ? 'Already recorded today' : 'Attendance recorded via Face Recognition',
      duplicate: !!result.duplicate,
      face_verified: 1,
      match_confidence: (Math.max(0, 1 - matchDistance) * 100).toFixed(1) + '%'
    }, result));
  } catch (err) {
    console.error('Face scan attendance error:', err.message);
    res.status(500).json({ error: 'Server error processing face recognition attendance' });
  }
});

// Self-checkin (Student portal)
router.post('/self', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student' || !req.user.student_id) {
      return res.status(403).json({ error: 'Student account required' });
    }
    const db = req.app.get('db');
    const policy = await checkPolicy(db, req.body);
    if (policy) return res.status(403).json({ error: policy });

    const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(req.user.student_id);
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const result = await record(db, student, req.user.username, req.body);
    if (result.blocked) {
      return res.status(403).json({ error: result.error, blocked: true });
    }

    res.json(Object.assign({
      message: result.duplicate ? 'Already recorded today' : 'Attendance recorded',
      duplicate: !!result.duplicate
    }, result));
  } catch (err) {
    console.error('Self attendance error:', err.message);
    res.status(500).json({ error: 'Server error processing self check-in' });
  }
});

// Today's attendance stream
router.get('/today', auth, staff, async (req, res) => {
  try {
    const t = localParts().date;
    let todaySql = 'SELECT a.*, s.full_name, s.sex, s.lrn, s.enrollment_status, s.is_enrolled FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = ?';
    const todayParams = [t];

    if (req.user.role === 'teacher') {
      todaySql += ' AND s.teacher_id = ?';
      todayParams.push(req.user.id);
    }
    todaySql += ' ORDER BY a.id DESC';

    const rows = await req.app.get('db').prepare(todaySql).all(...todayParams);
    res.json(rows || []);
  } catch (err) {
    console.error('Today attendance error:', err.message);
    res.status(500).json({ error: 'Could not load today attendance' });
  }
});

// Specific date
router.get('/date/:date', auth, staff, async (req, res) => {
  try {
    let dateSql = 'SELECT a.*, s.full_name, s.sex, s.lrn, s.enrollment_status, s.is_enrolled FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = ?';
    const dateParams = [req.params.date];
    if (req.user.role === 'teacher') {
      dateSql += ' AND s.teacher_id = ?';
      dateParams.push(req.user.id);
    }
    dateSql += ' ORDER BY a.time_in';
    const rows = await req.app.get('db').prepare(dateSql).all(...dateParams);
    res.json(rows || []);
  } catch (err) {
    console.error('Date attendance error:', err.message);
    res.status(500).json({ error: 'Could not load date attendance' });
  }
});

// Today's summary
router.get('/summary', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    const t = localParts().date;
    
    let totalSql = 'SELECT COUNT(*) count FROM students WHERE is_enrolled = 1';
    let presentSql = 'SELECT COUNT(*) count FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = ?';
    let lateSql = "SELECT COUNT(*) count FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = ? AND a.status = 'late'";
    const sumParams = [];
    const presParams = [t];
    const lateParams = [t];

    if (req.user.role === 'teacher') {
      totalSql += ' AND teacher_id = ?';
      sumParams.push(req.user.id);
      presentSql += ' AND s.teacher_id = ?';
      presParams.push(req.user.id);
      lateSql += ' AND s.teacher_id = ?';
      lateParams.push(req.user.id);
    }

    const totalRow = await db.prepare(totalSql).get(...sumParams);
    const presentRow = await db.prepare(presentSql).get(...presParams);
    const lateRow = await db.prepare(lateSql).get(...lateParams);
    
    const total = totalRow ? Number(totalRow.count) : 0;
    const present = presentRow ? Number(presentRow.count) : 0;
    const late = lateRow ? Number(lateRow.count) : 0;
    const settings = await getSettingsMap(db);

    res.json({
      total_students: total,
      present_today: present,
      late_today: late,
      absent_today: Math.max(0, total - present),
      attendance_rate: total ? Math.round(present / total * 100) : 0,
      room: settings.room_name || 'Room 101',
      attendance_mode: settings.attendance_mode || 'onsite',
      theme: settings.attendance_theme || 'rose'
    });
  } catch (err) {
    console.error('Summary attendance error:', err.message);
    res.status(500).json({ error: 'Could not load summary' });
  }
});

// Requirement 9: Historical data endpoint
router.get('/history', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    const today = localParts().date;
    const from = String(req.query.from || '');
    const to = String(req.query.to || today);
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : null;
    const source = String(req.query.source || '');

    let query = `
      SELECT a.*, s.full_name, s.sex, s.lrn, s.enrollment_status
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE 1=1
    `;
    const params = [];

    // Role differentiation: Teacher side only sees updates on teacher side; Admin side only sees admin side
    if (req.user.role === 'teacher' || source === 'teacher') {
      query += " AND (a.recorded_by != 'admin' OR a.recorded_by IS NULL OR a.recorded_by = 'teacher')";
      if (req.user.role === 'teacher') {
        query += " AND s.teacher_id = ?";
        params.push(req.user.id);
      }
    } else if (req.user.role === 'admin' && (source === 'admin' || source === 'admin_only')) {
      query += " AND (a.recorded_by = 'admin')";
    }

    if (from && to) {
      query += ' AND a.date BETWEEN ? AND ?';
      params.push(from, to);
    } else if (to) {
      query += ' AND a.date <= ?';
      params.push(to);
    }

    if (studentId) {
      query += ' AND a.student_id = ?';
      params.push(studentId);
    }

    query += ' ORDER BY a.date DESC, a.time_in ASC';

    const records = await db.prepare(query).all(...params);

    // Group dates summary
    let datesSummaryQuery = `
      SELECT date, 
             COUNT(*) as total_recorded,
             SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
             SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as on_time_count
      FROM attendance
      WHERE 1=1
    `;
    const summaryParams = [];

    if (req.user.role === 'teacher' || source === 'teacher') {
      datesSummaryQuery += " AND (recorded_by != 'admin' OR recorded_by IS NULL OR recorded_by = 'teacher')";
      if (req.user.role === 'teacher') {
        datesSummaryQuery += " AND student_id IN (SELECT id FROM students WHERE teacher_id = ?)";
        summaryParams.push(req.user.id);
      }
    } else if (req.user.role === 'admin' && (source === 'admin' || source === 'admin_only')) {
      datesSummaryQuery += " AND (recorded_by = 'admin')";
    }

    if (from && to) {
      datesSummaryQuery += ' AND date BETWEEN ? AND ?';
      summaryParams.push(from, to);
    }
    datesSummaryQuery += ' GROUP BY date ORDER BY date DESC LIMIT 30';

    const datesSummary = await db.prepare(datesSummaryQuery).all(...summaryParams);
    
    let totalEnrolledSql = 'SELECT COUNT(*) count FROM students WHERE is_enrolled = 1';
    const totalEnrolledParams = [];
    if (req.user.role === 'teacher') {
      totalEnrolledSql += ' AND teacher_id = ?';
      totalEnrolledParams.push(req.user.id);
    }
    const totalRow = await db.prepare(totalEnrolledSql).get(...totalEnrolledParams);
    const totalEnrolled = totalRow ? Number(totalRow.count) : 0;



    res.json({
      total_enrolled: totalEnrolled,
      records: records || [],
      dates_summary: (datesSummary || []).map(d => {
        const recorded = Number(d.total_recorded) || 0;
        return {
          date: d.date,
          present: recorded,
          late: Number(d.late_count) || 0,
          absent: Math.max(0, totalEnrolled - recorded),
          rate: totalEnrolled ? Math.round((recorded / totalEnrolled) * 100) : 0
        };
      })
    });
  } catch (error) {
    console.error('History API error:', error.message);
    res.status(500).json({ error: 'Could not load attendance history: ' + error.message });
  }
});

// Single student historical attendance
router.get('/history/student/:id', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (req.user.role === 'teacher' && student.teacher_id && student.teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied: This student belongs to another teacher's section." });
    }

    const records = (await db.prepare(
      'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC'
    ).all(req.params.id)) || [];

    let distinctSql = 'SELECT COUNT(DISTINCT date) count FROM attendance';
    const distinctParams = [];
    if (req.user.role === 'teacher') {
      distinctSql = 'SELECT COUNT(DISTINCT a.date) count FROM attendance a JOIN students s ON a.student_id = s.id WHERE s.teacher_id = ?';
      distinctParams.push(req.user.id);
    }
    const distinctDaysRow = await db.prepare(distinctSql).get(...distinctParams);
    const totalDays = (distinctDaysRow && Number(distinctDaysRow.count)) ? Number(distinctDaysRow.count) : 1;
    const presentCount = records.length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const absentCount = Math.max(0, totalDays - presentCount);

    res.json({
      student,
      total_days: totalDays,
      present_count: presentCount,
      late_count: lateCount,
      absent_count: absentCount,
      rate: Math.round((presentCount / totalDays) * 100),
      records
    });
  } catch (error) {
    console.error('Student history error:', error.message);
    res.status(500).json({ error: 'Could not load student attendance history' });
  }
});

// Export CSV
router.get('/export', auth, staff, async (req, res) => {
  try {
    const from = String(req.query.from || localParts().date);
    const to = String(req.query.to || from);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return res.status(400).json({ error: 'Use valid from and to dates (YYYY-MM-DD)' });
    }

    let exportQuery = 'SELECT s.lrn, s.full_name, s.sex, s.enrollment_status, a.date, a.time_in, a.status, a.room, a.recorded_by, a.latitude, a.longitude FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.date BETWEEN ? AND ?';
    const exportParams = [from, to];

    if (req.user.role === 'teacher') {
      exportQuery += " AND (a.recorded_by != 'admin' OR a.recorded_by IS NULL OR a.recorded_by = 'teacher') AND s.teacher_id = ?";
      exportParams.push(req.user.id);
    } else if (req.user.role === 'admin' && req.query.source === 'admin') {
      exportQuery += " AND (a.recorded_by = 'admin')";
    }
    exportQuery += ' ORDER BY a.date, s.full_name';

    const rows = (await req.app.get('db').prepare(exportQuery).all(...exportParams)) || [];


    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [
      ['LRN', 'Student Name', 'Sex', 'Enrollment Status', 'Date', 'Time In', 'Status', 'Room', 'Recorded By', 'Latitude', 'Longitude'],
      ...rows.map(r => [r.lrn, r.full_name, r.sex, r.enrollment_status, r.date, r.time_in, r.status, r.room, r.recorded_by, r.latitude, r.longitude])
    ].map(row => row.map(q).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${from}_${to}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Export CSV error:', err.message);
    res.status(500).send('Error generating CSV export');
  }
});

module.exports = router;
