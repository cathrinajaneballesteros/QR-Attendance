const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { send, formatPhilippineNumber, formatE164, formatPhilSMS } = require('../services/notifications');

function staff(req, res, next) {
    if (!['admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Teacher or admin account required' });
    }
    next();
}

/**
 * Check current SMS gateway configuration status
 */
router.get('/status', auth, staff, async (req, res) => {
    try {
        const db = req.app.get('db');
        const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
        const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));

        const provider = settings.sms_provider || process.env.SMS_PROVIDER || 'philsms';
        
        let hasKey = false;
        let maskedInfo = null;

        if (provider === 'philsms') {
            const token = settings.philsms_api_token || process.env.PHILSMS_API_TOKEN || '';
            hasKey = !!token;
            maskedInfo = hasKey ? `${token.substring(0, 5)}••••••••${token.slice(-4)}` : null;
        } else if (provider === 'android') {
            const url = settings.android_gateway_url || process.env.ANDROID_GATEWAY_URL || '';
            hasKey = !!url;
            maskedInfo = hasKey ? `Phone IP: ${url}` : null;
        } else if (provider === 'twilio') {
            const sid = settings.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || '';
            const token = settings.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || '';
            const from = settings.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || '';
            hasKey = !!sid && !!token && !!from;
            maskedInfo = hasKey ? `SID: ${sid.substring(0, 6)}••••${sid.slice(-4)} | From: ${from}` : null;
        } else if (provider === 'semaphore') {
            const apiKey = settings.semaphore_api_key || process.env.SEMAPHORE_API_KEY || '';
            hasKey = !!apiKey && apiKey !== 'your_semaphore_api_key_here';
            maskedInfo = hasKey ? `${apiKey.substring(0, 4)}••••••••${apiKey.slice(-4)}` : null;
        }

        res.json({
            sms_enabled: settings.sms_enabled === '1',
            provider: provider,
            has_api_key: hasKey,
            masked_key: maskedInfo,
            philsms_sender_id: settings.philsms_sender_id || process.env.PHILSMS_SENDER_ID || 'PhilSMS',
            android_gateway_url: settings.android_gateway_url || process.env.ANDROID_GATEWAY_URL || '',
            sender_name: settings.sms_sender_name || process.env.SEMAPHORE_SENDER_NAME || '',
            twilio_phone_number: settings.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || ''
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Dispatch manual SMS to a specific student's guardian
 */
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

        const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
        const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));

        const provider = settings.sms_provider || process.env.SMS_PROVIDER || 'philsms';
        const philsmsApiToken = settings.philsms_api_token || process.env.PHILSMS_API_TOKEN;
        const philsmsSenderId = settings.philsms_sender_id || process.env.PHILSMS_SENDER_ID;
        const androidGatewayUrl = settings.android_gateway_url || process.env.ANDROID_GATEWAY_URL;
        const androidGatewayKey = settings.android_gateway_key || process.env.ANDROID_GATEWAY_KEY;
        const apiKey = settings.semaphore_api_key || process.env.SEMAPHORE_API_KEY;
        const senderName = settings.sms_sender_name || process.env.SEMAPHORE_SENDER_NAME;
        const twilioAccountSid = settings.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = settings.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = settings.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

        const result = await send(phone, message, {
            provider,
            philsmsApiToken,
            philsmsSenderId,
            androidGatewayUrl,
            androidGatewayKey,
            apiKey,
            senderName,
            twilioAccountSid,
            twilioAuthToken,
            twilioPhoneNumber
        });

        const logStatus = result.status === 'queued' ? 'sent' : (result.status === 'mock_sent' ? 'mock_sent' : 'failed');
        const targetNumber = result.contact || formatPhilippineNumber(phone) || phone;

        await db.prepare('INSERT INTO sms_logs (student_id, guardian_contact, message, status) VALUES (?, ?, ?, ?)').run(id, targetNumber, message, logStatus);

        if (logStatus === 'failed') {
            return res.status(502).json({
                error: result.error || 'SMS gateway rejected the message',
                status: 'failed',
                contact: targetNumber
            });
        }

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: req.user?.role || 'teacher',
                userName: req.user?.username || 'teacher',
                actionType: 'sms_alert',
                actionTitle: 'Dispatched Guardian SMS Notification',
                details: `Sent SMS update to ${targetNumber} via ${provider.toUpperCase()}: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`,
                targetName: student.full_name
            });
        } catch (logErr) {}

        const isMock = logStatus === 'mock_sent';
        res.json({
            message: isMock ? 'Simulated SMS recorded (Mock Mode - not sent to network)' : `SMS accepted and queued via ${provider === 'philsms' ? 'PhilSMS' : (provider === 'android' ? 'Android Phone' : provider.toUpperCase())}`,
            contact: targetNumber,
            isMock: isMock,
            provider: provider
        });
    } catch (e) {
        console.error('SMS send error:', e.message);
        res.status(500).json({ error: 'SMS could not be sent: ' + e.message });
    }
});

/**
 * Send a Live Test SMS to any mobile number (from Settings or SMS Logs)
 */
router.post('/test', auth, staff, async (req, res) => {
    try {
        const db = req.app.get('db');
        const phone = String(req.body.phone || '').trim();
        const message = String(req.body.message || 'Test SMS from Sta. Rosa ES QR Attendance System! Gateway is working correctly.').trim();

        if (!phone) return res.status(400).json({ error: 'Please enter a mobile phone number to test' });

        const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
        const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));

        const provider = req.body.provider || settings.sms_provider || process.env.SMS_PROVIDER || 'philsms';
        const philsmsApiToken = req.body.philsmsApiToken !== undefined ? req.body.philsmsApiToken : (settings.philsms_api_token || process.env.PHILSMS_API_TOKEN);
        const philsmsSenderId = req.body.philsmsSenderId !== undefined ? req.body.philsmsSenderId : (settings.philsms_sender_id || process.env.PHILSMS_SENDER_ID);
        const androidGatewayUrl = req.body.androidGatewayUrl !== undefined ? req.body.androidGatewayUrl : (settings.android_gateway_url || process.env.ANDROID_GATEWAY_URL);
        const androidGatewayKey = req.body.androidGatewayKey !== undefined ? req.body.androidGatewayKey : (settings.android_gateway_key || process.env.ANDROID_GATEWAY_KEY);
        const apiKey = req.body.apiKey !== undefined ? req.body.apiKey : (settings.semaphore_api_key || process.env.SEMAPHORE_API_KEY);
        const senderName = req.body.senderName !== undefined ? req.body.senderName : (settings.sms_sender_name || process.env.SEMAPHORE_SENDER_NAME);
        const twilioAccountSid = req.body.twilioAccountSid !== undefined ? req.body.twilioAccountSid : (settings.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID);
        const twilioAuthToken = req.body.twilioAuthToken !== undefined ? req.body.twilioAuthToken : (settings.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN);
        const twilioPhoneNumber = req.body.twilioPhoneNumber !== undefined ? req.body.twilioPhoneNumber : (settings.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER);

        const result = await send(phone, message, {
            provider,
            philsmsApiToken,
            philsmsSenderId,
            androidGatewayUrl,
            androidGatewayKey,
            apiKey,
            senderName,
            twilioAccountSid,
            twilioAuthToken,
            twilioPhoneNumber
        });

        if (result.status === 'failed' || result.status === 'not_configured' || result.status === 'invalid_number') {
            return res.status(400).json({
                error: result.error || 'Failed to dispatch test SMS',
                status: result.status,
                contact: result.contact || phone
            });
        }

        res.json({
            success: true,
            status: result.status,
            message: result.message || 'Test SMS sent successfully!',
            contact: result.contact || phone,
            isMock: result.status === 'mock_sent',
            data: result.data || null,
            provider: provider
        });
    } catch (e) {
        console.error('Test SMS error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

/**
 * Fetch SMS history logs
 */
router.get('/logs', auth, staff, async (req, res) => {
    try {
        let sql = 'SELECT l.*, s.full_name FROM sms_logs l JOIN students s ON s.id = l.student_id';
        const params = [];
        if (req.user.role === 'teacher') {
            sql += ' WHERE s.teacher_id = ?';
            params.push(req.user.id);
        }
        sql += ' ORDER BY l.created_at DESC LIMIT 200';

        const rows = (await req.app.get('db').prepare(sql).all(...params)) || [];
        res.json(rows);
    } catch (e) {
        console.error('SMS logs error:', e.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
