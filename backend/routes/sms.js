const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { send } = require('../services/notifications');

function staff(req, res, next) {
    if (!['admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Teacher or admin account required' });
    }
    next();
}

router.post('/send', auth, staff, async (req, res) => {
    try {
        const db = req.app.get('db');
        const id = req.body.student_id;
        const message = String(req.body.message || '').trim();

        const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(id);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const phone = student.student_phone || student.guardian_contact || '';
        if (!phone) return res.status(400).json({ error: 'No student or guardian mobile number is recorded' });

        const result = await send(phone, message);
        const status = result.status === 'queued' ? 'sent' : result.status;

        await db.prepare('INSERT INTO sms_logs (student_id, guardian_contact, message, status) VALUES (?, ?, ?, ?)').run(id, phone, message, status);
        if (status !== 'sent') return res.status(502).json({ error: 'SMS provider did not accept the message', status });

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: req.user?.role || 'teacher',
                userName: req.user?.username || 'teacher',
                actionType: 'sms_alert',
                actionTitle: 'Dispatched Guardian SMS Notification',
                details: `Sent SMS update to ${phone}: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`,
                targetName: student.full_name
            });
        } catch (logErr) {}

        res.json({ message: 'SMS accepted by provider', contact: phone });
    } catch (e) {

        console.error('SMS error:', e.message);
        res.status(500).json({ error: 'SMS could not be sent' });
    }
});

router.get('/logs', auth, staff, async (req, res) => {
    try {
        let sql = 'SELECT l.*, s.full_name FROM sms_logs l JOIN students s ON s.id = l.student_id';
        const params = [];
        if (req.user.role === 'teacher') {
            sql += ' WHERE s.teacher_id = ?';
            params.push(req.user.id);
        }
        sql += ' ORDER BY l.created_at DESC';

        const rows = (await req.app.get('db').prepare(sql).all(...params)) || [];
        res.json(rows);
    } catch (e) {
        console.error('SMS logs error:', e.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
