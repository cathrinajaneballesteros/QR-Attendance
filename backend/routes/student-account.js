const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

router.post('/create', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Teacher or admin account required'
      });
    }

    const db = req.app.get('db');
    const studentId = Number(req.body.student_id);
    const username = String(req.body.username || req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!studentId || !username || !password) {
      return res.status(400).json({
        error: 'Select a student and enter a username and password'
      });
    }

    if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–40 characters and use only letters, numbers, dots, underscores, or hyphens'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    const student = await db.prepare(
      'SELECT id, full_name FROM students WHERE id = ?'
    ).get(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const existingAccount = await db.prepare(
      "SELECT id FROM users WHERE student_id = ? AND role = 'student'"
    ).get(studentId);

    const usernameOwner = await db.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).get(username);

    if (
      usernameOwner &&
      (!existingAccount || Number(usernameOwner.id) !== Number(existingAccount.id))
    ) {
      return res.status(409).json({
        error: 'That username is already in use'
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    if (existingAccount) {
      await db.prepare(
        'UPDATE users SET full_name = ?, username = ?, email = ?, password = ? WHERE id = ?'
      ).run(
        student.full_name,
        username,
        username,
        passwordHash,
        existingAccount.id
      );
    } else {
      await db.prepare(
        "INSERT INTO users (full_name, username, email, password, role, student_id) " +
        "VALUES (?, ?, ?, ?, 'student', ?)"
      ).run(
        student.full_name,
        username,
        username,
        passwordHash,
        studentId
      );
    }

    // Confirm that the username and password were saved.
    const savedAccount = await db.prepare(
      "SELECT username, password FROM users WHERE student_id = ? AND role = 'student'"
    ).get(studentId);

    if (
      !savedAccount ||
      savedAccount.username !== username ||
      !bcrypt.compareSync(password, savedAccount.password)
    ) {
      console.error('Student account verification failed for student ID:', studentId);
      return res.status(500).json({
        error: 'The account could not be verified in the database.'
      });
    }

    return res.json({
      message: 'Student account created and verified'
    });
  } catch (error) {
    console.error('Create student account error:', error.message);
    return res.status(500).json({
      error: 'Could not create the student account: ' + error.message
    });
  }
});

function toTitleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatLastnameFirstname(fullName) {
  if (!fullName) return 'Student';
  let clean = fullName.trim();
  let lastName = '';
  let firstName = '';

  if (clean.includes(',')) {
    // DepEd format: 'LASTNAME, FIRSTNAME MIDDLENAME'
    const parts = clean.split(',');
    lastName = parts[0].trim();
    const firstParts = parts[1].trim().split(/\s+/);
    firstName = firstParts[0] || '';
    if (firstParts[1] && !['JR', 'SR', 'II', 'III', 'IV'].includes(firstParts[1].toUpperCase()) && firstParts.length > 2) {
      firstName += firstParts[1];
    }
  } else {
    const parts = clean.split(/\s+/);
    if (parts.length === 1) {
      lastName = parts[0];
      firstName = '';
    } else {
      lastName = parts[parts.length - 1];
      firstName = parts[0];
    }
  }

  const cleanLast = lastName.replace(/[^A-Za-z0-9]/g, '');
  const cleanFirst = firstName.replace(/[^A-Za-z0-9]/g, '');
  const result = toTitleCase(cleanLast) + toTitleCase(cleanFirst);
  return result || 'Student' + Math.floor(Math.random() * 1000);
}

async function getUniqueUsername(db, baseUsername, studentId = null) {
  let username = baseUsername;
  let counter = 1;
  while (true) {
    const existing = await db.prepare('SELECT id, student_id FROM users WHERE username = ?').get(username);
    if (!existing || (studentId && Number(existing.student_id) === Number(studentId))) {
      return username;
    }
    counter++;
    username = `${baseUsername}${counter}`;
  }
}

// 1. Teachers summary with registered vs. unregistered student accounts
router.get('/teachers-summary', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Teacher or admin account required' });
    }

    const db = req.app.get('db');

    const teachersQuery = `
      SELECT 
        t.id as teacher_id, 
        t.full_name as teacher_name, 
        t.username as teacher_username,
        COUNT(s.id) as total_students,
        COUNT(u.id) as registered_count,
        (COUNT(s.id) - COUNT(u.id)) as unregistered_count
      FROM users t
      LEFT JOIN students s ON s.teacher_id = t.id
      LEFT JOIN users u ON u.student_id = s.id AND u.role = 'student'
      WHERE t.role = 'teacher'
      GROUP BY t.id, t.full_name, t.username
      ORDER BY unregistered_count DESC, t.full_name ASC
    `;

    const teachers = (await db.prepare(teachersQuery).all()) || [];

    // Check for students without any assigned teacher
    const unassignedRow = await db.prepare(`
      SELECT 
        COUNT(s.id) as total_students,
        COUNT(u.id) as registered_count,
        (COUNT(s.id) - COUNT(u.id)) as unregistered_count
      FROM students s
      LEFT JOIN users u ON u.student_id = s.id AND u.role = 'student'
      WHERE s.teacher_id IS NULL
    `).get();

    const totalStudentsRow = await db.prepare('SELECT COUNT(*) as c FROM students').get();
    const registeredTotalRow = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get();

    const totalStudents = totalStudentsRow ? Number(totalStudentsRow.c) : 0;
    const totalRegistered = registeredTotalRow ? Number(registeredTotalRow.c) : 0;
    const totalUnregistered = Math.max(0, totalStudents - totalRegistered);

    res.json({
      teachers: teachers.map(t => ({
        ...t,
        total_students: Number(t.total_students) || 0,
        registered_count: Number(t.registered_count) || 0,
        unregistered_count: Math.max(0, Number(t.unregistered_count) || 0),
        has_unregistered: (Number(t.unregistered_count) || 0) > 0
      })),
      unassigned: {
        total_students: unassignedRow ? Number(unassignedRow.total_students) || 0 : 0,
        registered_count: unassignedRow ? Number(unassignedRow.registered_count) || 0 : 0,
        unregistered_count: unassignedRow ? Math.max(0, Number(unassignedRow.unregistered_count) || 0) : 0
      },
      totals: {
        total_students: totalStudents,
        total_registered: totalRegistered,
        total_unregistered: totalUnregistered
      }
    });
  } catch (error) {
    console.error('Teachers summary error:', error.message);
    res.status(500).json({ error: 'Could not load teachers summary: ' + error.message });
  }
});

// 2. Unregistered students list (with suggested LastnameFirstname & Password)
router.get('/unregistered', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Teacher or admin account required' });
    }

    const db = req.app.get('db');
    let sql = `
      SELECT 
        s.id, s.lrn, s.full_name, s.sex, s.enrollment_status, s.teacher_id,
        t.full_name as teacher_name
      FROM students s
      LEFT JOIN users t ON t.id = s.teacher_id
      WHERE s.id NOT IN (SELECT student_id FROM users WHERE role = 'student' AND student_id IS NOT NULL)
    `;
    const params = [];

    const teacherFilter = req.query.teacher_id;
    if (teacherFilter && teacherFilter !== 'all') {
      sql += ' AND s.teacher_id = ?';
      params.push(teacherFilter);
    }

    sql += ' ORDER BY s.full_name ASC';

    const rows = (await db.prepare(sql).all(...params)) || [];

    const enriched = rows.map(s => ({
      ...s,
      default_username: formatLastnameFirstname(s.full_name),
      default_password: 'Password'
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Unregistered students error:', error.message);
    res.status(500).json({ error: 'Could not load unregistered students: ' + error.message });
  }
});

// 3. Registered students list
router.get('/registered', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Teacher or admin account required' });
    }

    const db = req.app.get('db');
    let sql = `
      SELECT 
        s.id as student_id, s.lrn, s.full_name, s.sex, s.enrollment_status, s.teacher_id,
        u.id as user_id, u.username, u.created_at,
        t.full_name as teacher_name
      FROM students s
      JOIN users u ON u.student_id = s.id AND u.role = 'student'
      LEFT JOIN users t ON t.id = s.teacher_id
    `;
    const params = [];

    const teacherFilter = req.query.teacher_id;
    if (teacherFilter && teacherFilter !== 'all') {
      sql += ' WHERE s.teacher_id = ?';
      params.push(teacherFilter);
    }

    sql += ' ORDER BY s.full_name ASC';

    const rows = (await db.prepare(sql).all(...params)) || [];
    res.json(rows);
  } catch (error) {
    console.error('Registered students error:', error.message);
    res.status(500).json({ error: 'Could not load registered students: ' + error.message });
  }
});

// 4. Create default account for single student (LastnameFirstname / Password)
router.post('/create-default', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Teacher or admin account required' });
    }

    const db = req.app.get('db');
    const studentId = Number(req.body.student_id);
    if (!studentId) return res.status(400).json({ error: 'Student ID is required' });

    const student = await db.prepare('SELECT id, full_name FROM students WHERE id = ?').get(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const baseUsername = req.body.username ? String(req.body.username).trim() : formatLastnameFirstname(student.full_name);
    const password = req.body.password ? String(req.body.password).trim() : 'Password';

    const finalUsername = await getUniqueUsername(db, baseUsername, studentId);
    const passwordHash = bcrypt.hashSync(password, 10);

    const existingAccount = await db.prepare(
      "SELECT id FROM users WHERE student_id = ? AND role = 'student'"
    ).get(studentId);

    if (existingAccount) {
      await db.prepare(
        'UPDATE users SET full_name = ?, username = ?, email = ?, password = ? WHERE id = ?'
      ).run(student.full_name, finalUsername, finalUsername, passwordHash, existingAccount.id);
    } else {
      await db.prepare(
        "INSERT INTO users (full_name, username, email, password, role, student_id) VALUES (?, ?, ?, ?, 'student', ?)"
      ).run(student.full_name, finalUsername, finalUsername, passwordHash, studentId);
    }

    try {
      const { logActivity } = require('../services/activityLogger');
      await logActivity(db, {
        role: req.user.role,
        userName: req.user.username,
        actionType: 'student_account_create',
        actionTitle: 'Student Account Created',
        details: `Created default account for ${student.full_name} with username ${finalUsername}.`,
        targetName: student.full_name
      });
    } catch (e) {}

    res.json({
      message: 'Student account created successfully',
      student_id: studentId,
      full_name: student.full_name,
      username: finalUsername,
      password: password
    });
  } catch (error) {
    console.error('Create default student account error:', error.message);
    res.status(500).json({ error: 'Could not create default student account: ' + error.message });
  }
});

// 5. Bulk create student accounts (for teacher's unregistered students or all)
router.post('/bulk-create', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Teacher or admin account required' });
    }

    const db = req.app.get('db');
    let sql = `
      SELECT id, full_name, teacher_id
      FROM students
      WHERE id NOT IN (SELECT student_id FROM users WHERE role = 'student' AND student_id IS NOT NULL)
    `;
    const params = [];

    if (req.body.teacher_id && req.body.teacher_id !== 'all') {
      sql += ' AND teacher_id = ?';
      params.push(req.body.teacher_id);
    }

    if (Array.isArray(req.body.student_ids) && req.body.student_ids.length > 0) {
      const placeholders = req.body.student_ids.map(() => '?').join(',');
      sql += ` AND id IN (${placeholders})`;
      params.push(...req.body.student_ids);
    }

    const students = (await db.prepare(sql).all(...params)) || [];
    if (students.length === 0) {
      return res.json({ message: 'All selected students already have registered accounts.', created: [] });
    }

    const defaultPassword = 'Password';
    const passwordHash = bcrypt.hashSync(defaultPassword, 10);
    const created = [];

    for (const student of students) {
      const baseUsername = formatLastnameFirstname(student.full_name);
      const uniqueUsername = await getUniqueUsername(db, baseUsername, student.id);

      await db.prepare(
        "INSERT INTO users (full_name, username, email, password, role, student_id) VALUES (?, ?, ?, ?, 'student', ?)"
      ).run(student.full_name, uniqueUsername, uniqueUsername, passwordHash, student.id);

      created.push({
        student_id: student.id,
        full_name: student.full_name,
        username: uniqueUsername,
        password: defaultPassword
      });
    }

    try {
      const { logActivity } = require('../services/activityLogger');
      await logActivity(db, {
        role: req.user.role,
        userName: req.user.username,
        actionType: 'bulk_student_account_create',
        actionTitle: 'Bulk Student Accounts Created',
        details: `Created ${created.length} student accounts with default credentials (LastnameFirstname / Password).`,
        targetName: `${created.length} Students`
      });
    } catch (e) {}

    res.json({
      message: `Successfully created ${created.length} student accounts!`,
      count: created.length,
      created
    });
  } catch (error) {
    console.error('Bulk create student accounts error:', error.message);
    res.status(500).json({ error: 'Could not create bulk student accounts: ' + error.message });
  }
});

// 6. Reset password to default 'Password'
router.post('/reset-default-password', auth, async (req, res) => {
  try {
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Teacher or admin account required' });
    }

    const db = req.app.get('db');
    const studentId = Number(req.body.student_id);
    if (!studentId) return res.status(400).json({ error: 'Student ID is required' });

    const user = await db.prepare("SELECT id, username, full_name FROM users WHERE student_id = ? AND role = 'student'").get(studentId);
    if (!user) return res.status(404).json({ error: 'Student account not found' });

    const passwordHash = bcrypt.hashSync('Password', 10);
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, user.id);

    try {
      const { logActivity } = require('../services/activityLogger');
      await logActivity(db, {
        role: req.user.role,
        userName: req.user.username,
        actionType: 'student_password_reset',
        actionTitle: 'Student Password Reset to Default',
        details: `Reset password for ${user.full_name} (${user.username}) to 'Password'.`,
        targetName: user.full_name
      });
    } catch (e) {}

    res.json({
      message: `Password for ${user.full_name} has been reset to default ('Password').`,
      username: user.username,
      password: 'Password'
    });
  } catch (error) {
    console.error('Reset default password error:', error.message);
    res.status(500).json({ error: 'Could not reset password: ' + error.message });
  }
});

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

async function getSettingsMap(db) {
  const defaults = {
    late_after: '08:00',
    attendance_deadline: '16:00',
    school_start: '08:00',
    room_name: 'Room 101 - Grade 6 Great Geniuses',
    absence_threshold: '5',
    gps_enabled: '0',
    attendance_mode: 'onsite'
  };
  const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
  const stored = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));
  return Object.assign({}, defaults, stored);
}

router.get('/me', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student' || !req.user.student_id) {
      return res.status(403).json({ error: 'Student account required' });
    }

    const db = req.app.get('db');

    const student = await db.prepare(
      'SELECT id, lrn, full_name, sex, qr_code, student_phone, guardian_name, guardian_contact, is_enrolled, enrollment_status ' +
      'FROM students WHERE id = ?'
    ).get(req.user.student_id);

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const settings = await getSettingsMap(db);
    const now = localParts();

    // Check today's attendance record
    const todayRecord = await db.prepare(
      'SELECT * FROM attendance WHERE student_id = ? AND date = ?'
    ).get(req.user.student_id, now.date);

    // Check if recorded in student_absence_days
    const todayAbsence = await db.prepare(
      'SELECT 1 FROM student_absence_days WHERE student_id = ? AND date = ?'
    ).get(req.user.student_id, now.date);

    // Fetch existing attendance logs
    const rawRecords = (await db.prepare(
      'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC, time_in DESC LIMIT 100'
    ).all(req.user.student_id)) || [];

    // Distinct dates from all school attendance records
    const distinctSchoolDates = (await db.prepare(
      'SELECT DISTINCT date FROM attendance ORDER BY date DESC'
    ).all() || []).map(r => r.date);

    // Absences recorded in table
    const absenceRows = (await db.prepare(
      'SELECT date FROM student_absence_days WHERE student_id = ? ORDER BY date DESC'
    ).all(req.user.student_id)) || [];

    const attendedDatesSet = new Set(rawRecords.map(r => r.date));
    const absentDatesSet = new Set(absenceRows.map(r => r.date));

    // Any past school day where attendance took place but this student was missing:
    for (const sDate of distinctSchoolDates) {
      if (!attendedDatesSet.has(sDate) && sDate !== now.date) {
        absentDatesSet.add(sDate);
      }
    }

    // Determine Today's Status: ontime, late, absent, or pending
    let todayStatus = 'pending';
    let todayTitle = 'Attendance Check-In Pending';
    let todayMessage = `You have not recorded attendance for today (${now.date}) yet. Check in before ${settings.late_after} to be marked On Time!`;
    let todayBadge = 'Pending';
    let todayType = 'info'; // 'success' | 'warning' | 'danger' | 'info'

    if (todayRecord) {
      if (todayRecord.status === 'late') {
        todayStatus = 'late';
        todayTitle = 'You are Late Today';
        todayMessage = `You arrived and checked in late today at ${todayRecord.time_in}. On-time cutoff was ${settings.late_after}.`;
        todayBadge = 'Late';
        todayType = 'warning';
      } else if (todayRecord.status === 'present') {
        todayStatus = 'ontime';
        todayTitle = 'You are On Time Today! 🎉';
        todayMessage = `Awesome job! Your attendance was recorded on time today at ${todayRecord.time_in}.`;
        todayBadge = 'On Time';
        todayType = 'success';
      } else if (todayRecord.status === 'am_absent' || todayRecord.status === 'morning_absent') {
        todayStatus = 'am_absent';
        todayTitle = 'Half-Day Morning Absent';
        todayMessage = `You were marked half-day morning absent today.`;
        todayBadge = 'AM Absent';
        todayType = 'warning';
      } else if (todayRecord.status === 'pm_absent' || todayRecord.status === 'afternoon_absent') {
        todayStatus = 'pm_absent';
        todayTitle = 'Half-Day Afternoon Absent';
        todayMessage = `You were marked half-day afternoon absent today.`;
        todayBadge = 'PM Absent';
        todayType = 'warning';
      } else if (todayRecord.status === 'absent') {
        todayStatus = 'absent';
        todayTitle = 'You are Marked Absent Today';
        todayMessage = `You are marked Absent for today (${now.date}).`;
        todayBadge = 'Absent';
        todayType = 'danger';
      } else {
        todayStatus = 'ontime';
        todayTitle = 'Attendance Recorded';
        todayMessage = `Your attendance was recorded today at ${todayRecord.time_in}.`;
        todayBadge = 'On Time';
        todayType = 'success';
      }
    } else {
      // No attendance recorded today
      const isPastDeadline = settings.attendance_deadline && now.time > settings.attendance_deadline;
      if (todayAbsence || isPastDeadline) {
        todayStatus = 'absent';
        todayTitle = 'You are Marked Absent Today';
        todayMessage = `Alert: No attendance check-in was registered before the daily cutoff deadline (${settings.attendance_deadline}). You are marked Absent for today (${now.date}).`;
        todayBadge = 'Absent';
        todayType = 'danger';
        absentDatesSet.add(now.date);
      } else {
        todayStatus = 'pending';
        todayTitle = 'Attendance Check-In Pending';
        todayMessage = `You have not recorded attendance for today (${now.date}) yet. Check in before ${settings.late_after} to be marked On Time! (Cutoff: ${settings.attendance_deadline}).`;
        todayBadge = 'Pending';
        todayType = 'info';
      }
    }

    // Attendance Counts
    const onTimeCount = rawRecords.filter(r => r.status === 'present').length;
    const lateCount = rawRecords.filter(r => r.status === 'late').length;
    const absentCount = absentDatesSet.size;
    const totalPresent = onTimeCount + lateCount;
    const totalEvaluatedDays = Math.max(distinctSchoolDates.length, totalPresent + absentCount, 1);
    const attendanceRate = Math.round((totalPresent / totalEvaluatedDays) * 100);
    const threshold = Number(settings.absence_threshold) || 5;
    const atRisk = absentCount >= threshold;

    // Combine history rows with absent dates
    const formattedRecords = rawRecords.map(r => ({
      date: r.date,
      time_in: r.time_in,
      status: r.status === 'present' ? 'ontime' : r.status,
      display_status: r.status === 'present' ? 'On Time' : (r.status === 'late' ? 'Late' : (r.status === 'am_absent' ? 'AM Absent' : (r.status === 'pm_absent' ? 'PM Absent' : 'Absent'))),
      room: r.room || settings.room_name,
      recorded_by: r.recorded_by || 'system'
    }));

    for (const aDate of absentDatesSet) {
      if (!attendedDatesSet.has(aDate)) {
        formattedRecords.push({
          date: aDate,
          time_in: '—',
          status: 'absent',
          display_status: 'Absent',
          room: settings.room_name,
          recorded_by: 'system'
        });
      }
    }

    formattedRecords.sort((a, b) => b.date.localeCompare(a.date));

    // Fetch recent SMS notices sent for this student
    const recentNotices = (await db.prepare(
      'SELECT id, message, status, created_at FROM sms_logs WHERE student_id = ? ORDER BY id DESC LIMIT 5'
    ).all(req.user.student_id)) || [];

    const userRow = await db.prepare("SELECT id, password FROM users WHERE id = ?").get(req.user.id);
    const isDefaultPassword = userRow ? bcrypt.compareSync('Password', userRow.password) : false;

    return res.json({
      student,
      is_default_password: isDefaultPassword,
      today: {
        date: now.date,
        time: now.time,
        display_time: now.display,
        status: todayStatus,
        title: todayTitle,
        message: todayMessage,
        badge: todayBadge,
        type: todayType,
        record: todayRecord || null,
        late_after: settings.late_after,
        attendance_deadline: settings.attendance_deadline,
        room: todayRecord?.room || settings.room_name
      },
      stats: {
        total_school_days: totalEvaluatedDays,
        on_time_count: onTimeCount,
        late_count: lateCount,
        absent_count: absentCount,
        present_count: totalPresent,
        attendance_rate: attendanceRate,
        absence_threshold: threshold,
        at_risk: atRisk
      },
      settings,
      records: formattedRecords,
      notices: recentNotices
    });
  } catch (error) {
    console.error('Load student account error:', error.message);
    return res.status(500).json({ error: 'Could not load the student account: ' + error.message });
  }
});

router.post('/change-password', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student' || !req.user.id) {
      return res.status(403).json({ error: 'Student account required' });
    }

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Complete all password fields' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const db = req.app.get('db');

    const user = await db.prepare(
      "SELECT id, password FROM users WHERE id = ? AND role = 'student'"
    ).get(req.user.id);

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    await db.prepare(
      'UPDATE users SET password = ? WHERE id = ?'
    ).run(passwordHash, user.id);

    const savedUser = await db.prepare(
      'SELECT password FROM users WHERE id = ?'
    ).get(user.id);

    if (!savedUser || !bcrypt.compareSync(newPassword, savedUser.password)) {
      return res.status(500).json({
        error: 'Could not verify the changed password'
      });
    }

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change student password error:', error.message);
    return res.status(500).json({ error: 'Could not change the password' });
  }
});

module.exports = router;