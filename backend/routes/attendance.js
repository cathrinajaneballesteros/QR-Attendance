const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { notify } = require('../services/notifications');

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

async function record(db, student, who, location) {
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
      room: existing.room || settings.room_name || 'Room 101'
    };
  }

  const status = (settings.late_after && now.time > settings.late_after) ? 'late' : 'present';
  const room = settings.room_name || 'Room 101 - Grade 6 Great Geniuses';

  await db.prepare(
    'INSERT INTO attendance (student_id, date, time_in, status, recorded_by, latitude, longitude, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    student.id,
    now.date,
    now.display,
    status,
    who,
    location.latitude || null,
    location.longitude || null,
    room
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
    await logActivity(db, {
      role: role,
      userName: who,
      actionType: 'attendance_record',
      actionTitle: `Attendance Recorded: ${status.toUpperCase()}`,
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
    room
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

    const result = await record(db, student, req.user.username, req.body);
    if (result.blocked) {
      return res.status(403).json({ error: result.error, blocked: true, student: result.student });
    }

    res.json(Object.assign({
      message: result.duplicate ? 'Already recorded today' : 'Attendance recorded',
      duplicate: !!result.duplicate
    }, result));
  } catch (err) {
    console.error('Scan attendance error:', err.message);
    res.status(500).json({ error: 'Server error processing attendance scan' });
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
    const rows = await req.app.get('db').prepare(
      'SELECT a.*, s.full_name, s.sex, s.lrn, s.enrollment_status, s.is_enrolled FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = ? ORDER BY a.time_in'
    ).all(req.params.date);
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

    const records = (await db.prepare(
      'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC'
    ).all(req.params.id)) || [];

    const distinctDaysRow = await db.prepare('SELECT COUNT(DISTINCT date) count FROM attendance').get();
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
