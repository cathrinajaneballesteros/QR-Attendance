const https = require('https');
const ENDPOINT = 'https://api.semaphore.co/api/v4/messages';

function send(number, message) {
  const key = process.env.SEMAPHORE_API_KEY;
  if (process.env.SMS_PROVIDER === 'mock') {
    console.log(`[Mock SMS] Sent to ${number}: ${message}`);
    return Promise.resolve({ status: 'queued' });
  }
  if (process.env.SMS_PROVIDER && process.env.SMS_PROVIDER !== 'semaphore') return Promise.resolve({ status: 'not_configured' });
  if (!key || key === 'your_semaphore_api_key_here') return Promise.resolve({ status: 'not_configured' });
  const body = new URLSearchParams({ apikey: key, number: String(number), message: String(message) }).toString();
  return new Promise(resolve => {
    const req = https.request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode >= 200 && res.statusCode < 300 && Array.isArray(json) && json.length ? 'queued' : 'failed' });
      });
    });
    req.on('error', () => resolve({ status: 'failed' }));
    req.write(body);
    req.end();
  });
}

async function notify(db, student, kind, message, force = false) {
  const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
  const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));
  if (!force && settings.sms_enabled !== '1') return;

  const phone = student.student_phone || student.guardian_contact;
  if (!phone) {
    await db.prepare('INSERT INTO sms_logs (student_id, guardian_contact, message, status) VALUES (?, ?, ?, ?)').run(student.id, '', message, 'no_contact');
    return;
  }

  const result = await send(phone, message);
  await db.prepare('INSERT INTO sms_logs (student_id, guardian_contact, message, status) VALUES (?, ?, ?, ?)').run(student.id, phone, message, result.status === 'queued' ? 'sent' : result.status);
}

async function runAbsenceNotices(db) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
  const date = parts.year + '-' + parts.month + '-' + parts.day;
  const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
  const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));

  if (settings.sms_enabled !== '1' || !settings.attendance_deadline || (parts.hour + ':' + parts.minute) < settings.attendance_deadline) return;

  const key = 'absence:' + date;
  const existingEvent = await db.prepare('SELECT event_key FROM notification_events WHERE event_key = ?').get(key);
  if (existingEvent) return;

  await db.prepare('INSERT INTO notification_events (event_key) VALUES (?)').run(key);

  const absent = (await db.prepare('SELECT s.* FROM students s WHERE NOT EXISTS (SELECT 1 FROM attendance a WHERE a.student_id = s.id AND a.date = ?)').all(date)) || [];
  const threshold = Number(settings.absence_threshold) || 5;

  for (const s of absent) {
    await db.prepare('INSERT OR IGNORE INTO student_absence_days (student_id, date) VALUES (?, ?)').run(s.id, date);
    const countRow = await db.prepare('SELECT COUNT(*) count FROM student_absence_days WHERE student_id = ?').get(s.id);
    const count = countRow ? Number(countRow.count) : 0;
    const risk = count >= threshold;
    const message = risk ? 'Attendance alert: ' + s.full_name + ' has reached ' + count + ' absences and the configured drop-risk threshold. Please contact the school.' : 'Attendance reminder: ' + s.full_name + ' was marked absent on ' + date + '. Please contact the school if this is incorrect.';
    await notify(db, s, risk ? 'drop_risk' : 'absent', message);
  }
}

function startDailyNotifier(db) {
  setInterval(() => runAbsenceNotices(db).catch(e => console.error('Absence notifications failed:', e.message)), 60000);
}

module.exports = { send, notify, runAbsenceNotices, startDailyNotifier };
