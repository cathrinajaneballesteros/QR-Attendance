const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sta-rosa-qr-secret-key-grade6-2026';

const HARDCODED_TEXTBEE_API_KEY = 'txb_qQDnUgyok84rrtJJ1kG8qkZMwWGt0wNT';
const HARDCODED_TEXTBEE_DEVICE_ID = '6ad7fcb9ab534081692d485f';

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
    sms_enabled: '0',
    sms_notify_present: '1',
    sms_provider: 'textbee',
    textbee_api_key: HARDCODED_TEXTBEE_API_KEY,
    textbee_device_id: HARDCODED_TEXTBEE_DEVICE_ID,
    philsms_api_token: '',
    philsms_sender_id: 'PhilSMS',
    android_gateway_url: '',
    android_gateway_key: '',
    semaphore_api_key: '',
    sms_sender_name: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    student_face_verification: '1',
    scanner_verification_mode: 'both'
};

async function getSettings(db) {
    const rows = await db.prepare(
        'SELECT setting_key, setting_value FROM app_settings'
    ).all();

    const stored = {};
    (rows || []).forEach(function (row) {
        stored[row.setting_key] = row.setting_value;
    });

    const merged = Object.assign({}, defaults, stored);

    // Hard-coded TextBee credentials invariant: ensure never empty
    if (!merged.textbee_api_key || !String(merged.textbee_api_key).trim()) {
        merged.textbee_api_key = HARDCODED_TEXTBEE_API_KEY;
    }
    if (!merged.textbee_device_id || !String(merged.textbee_device_id).trim()) {
        merged.textbee_device_id = HARDCODED_TEXTBEE_DEVICE_ID;
    }

    return merged;
}

function optionalAuth(req, res, next) {
    try {
        let authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
        let token = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (authHeader) {
            token = authHeader;
        } else if (req.query && req.query.token) {
            token = req.query.token;
        }
        if (token && token !== 'null' && token !== 'undefined') {
            const secret = process.env.JWT_SECRET || JWT_SECRET;
            jwt.verify(token, secret, function(err, decoded) {
                if (!err && decoded) {
                    req.user = decoded;
                }
                next();
            });
            return;
        }
    } catch (e) {}
    next();
}

router.get('/', optionalAuth, async function (req, res) {
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

        // Admin-only setting keys: teachers are restricted from modifying SMS gateway configuration
        const adminOnlyKeys = [
            'sms_provider',
            'sms_enabled',
            'sms_notify_present',
            'textbee_api_key',
            'textbee_device_id',
            'philsms_api_token',
            'philsms_sender_id',
            'android_gateway_url',
            'android_gateway_key',
            'semaphore_api_key',
            'sms_sender_name',
            'twilio_account_sid',
            'twilio_auth_token',
            'twilio_phone_number'
        ];

        const payload = Object.assign({}, req.body);
        if (req.user.role !== 'admin') {
            for (const key of adminOnlyKeys) {
                delete payload[key];
            }
        } else {
            // Keep hard-coded TextBee defaults if admin provides blank values
            if (payload.textbee_api_key !== undefined && !String(payload.textbee_api_key).trim()) {
                payload.textbee_api_key = HARDCODED_TEXTBEE_API_KEY;
            }
            if (payload.textbee_device_id !== undefined && !String(payload.textbee_device_id).trim()) {
                payload.textbee_device_id = HARDCODED_TEXTBEE_DEVICE_ID;
            }
        }

        for (const key of Object.keys(defaults)) {
            if (payload[key] !== undefined) {
                await db.prepare(
                    'INSERT INTO app_settings (setting_key, setting_value) ' +
                    'VALUES (?, ?) ' +
                    'ON CONFLICT(setting_key) DO UPDATE SET ' +
                    'setting_value = excluded.setting_value'
                ).run(key, String(payload[key]));
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