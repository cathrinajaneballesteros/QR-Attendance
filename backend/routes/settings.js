const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const defaults = {
    gps_enabled: '0',
    attendance_mode: 'onsite',
    room_name: 'Room 101 - Grade 6 Great Geniuses',
    qr_code_type: 'fixed',
    attendance_theme: 'rose',
    block_unenrolled: '1',
    school_latitude: '',
    school_longitude: '',
    geofence_radius_m: '100',
    qr_enabled: '1',
    qr_start: '',
    qr_end: '',
    school_start: '08:00',
    attendance_deadline: '16:00',
    absence_threshold: '5',
    late_after: '08:00',
    sms_enabled: '0'
};

async function getSettings(db) {
    const rows = await db.prepare(
        'SELECT setting_key, setting_value FROM app_settings'
    ).all();

    const stored = {};
    (rows || []).forEach(function (row) {
        stored[row.setting_key] = row.setting_value;
    });

    return Object.assign({}, defaults, stored);
}

router.get('/', auth, async function (req, res) {
    try {
        const settings = await getSettings(req.app.get('db'));
        res.json(settings);
    } catch (err) {
        console.error('Get settings error:', err.message);
        res.status(500).json({ error: 'Failed to retrieve settings' });
    }
});

router.put('/', auth, async function (req, res) {
    try {
        if (!['admin', 'teacher'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Teacher or admin account required' });
        }

        const db = req.app.get('db');

        for (const key of Object.keys(defaults)) {
            if (req.body[key] !== undefined) {
                await db.prepare(
                    'INSERT INTO app_settings (setting_key, setting_value) ' +
                    'VALUES (?, ?) ' +
                    'ON CONFLICT(setting_key) DO UPDATE SET ' +
                    'setting_value = excluded.setting_value'
                ).run(key, String(req.body[key]));
            }
        }

        const updated = await getSettings(db);

        try {
            const { logActivity } = require('../services/activityLogger');
            const role = req.user?.role || 'admin';
            await logActivity(db, {
                role: role,
                userName: req.user?.username || (role === 'admin' ? 'admin' : 'teacher'),
                actionType: 'settings_update',
                actionTitle: 'System Settings Updated',
                details: 'Modified system configuration, attendance rules, or room settings.',
                targetName: 'App Settings'
            });
        } catch (logErr) {}

        res.json(updated);
    } catch (err) {
        console.error('Update settings error:', err.message);
        res.status(500).json({ error: 'Failed to update settings' });
    }

});

module.exports = router;