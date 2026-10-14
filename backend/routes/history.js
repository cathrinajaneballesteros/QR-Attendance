const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { logActivity } = require('../services/activityLogger');

function staff(req, res, next) {
  if (!['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Teacher or admin account required' });
  }
  next();
}

/**
 * GET /api/history
 * Returns historical activity records tailored to Admin or Teacher
 */
router.get('/', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    // If teacher, strictly enforce teacher role updates only
    const targetRole = req.user.role === 'teacher' ? 'teacher' : (req.query.role || req.user.role || 'admin');
    const actionType = String(req.query.action_type || '').trim();
    const search = String(req.query.search || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const limit = parseInt(req.query.limit, 10) || 200;

    let query = 'SELECT * FROM activity_logs WHERE role = ?';
    const params = [targetRole];

    if (actionType && actionType !== 'ALL') {
      query += ' AND action_type = ?';
      params.push(actionType);
    }

    if (from && to) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(from + ' 00:00:00', to + ' 23:59:59');
    } else if (from) {
      query += ' AND created_at >= ?';
      params.push(from + ' 00:00:00');
    } else if (to) {
      query += ' AND created_at <= ?';
      params.push(to + ' 23:59:59');
    }

    if (search) {
      query += ' AND (action_title LIKE ? OR details LIKE ? OR target_name LIKE ? OR user_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY created_at DESC, id DESC LIMIT ?';
    params.push(limit);

    const logs = (await db.prepare(query).all(...params)) || [];

    // Calculate role-specific stats
    const allRoleLogs = (await db.prepare('SELECT action_type FROM activity_logs WHERE role = ?').all(targetRole)) || [];
    
    let stats = {};
    if (targetRole === 'admin') {
      stats = {
        total_events: allRoleLogs.length,
        teacher_mgmt: allRoleLogs.filter(l => l.action_type === 'teacher_management').length,
        sf2_reviews: allRoleLogs.filter(l => l.action_type === 'sf2_update').length,
        settings_updates: allRoleLogs.filter(l => l.action_type === 'settings_update').length
      };
    } else {
      stats = {
        total_events: allRoleLogs.length,
        attendance_records: allRoleLogs.filter(l => ['attendance_record', 'manual_attendance'].includes(l.action_type)).length,
        sms_alerts: allRoleLogs.filter(l => l.action_type === 'sms_alert').length,
        sf2_updates: allRoleLogs.filter(l => l.action_type === 'sf2_update').length
      };
    }

    res.json({
      role: targetRole,
      count: logs.length,
      stats,
      logs
    });
  } catch (err) {
    console.error('History API error:', err.message);
    res.status(500).json({ error: 'Failed to load historical activity logs' });
  }
});

/**
 * GET /api/history/export
 * Exports historical logs as CSV
 */
router.get('/export', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    const targetRole = req.user.role === 'teacher' ? 'teacher' : (req.query.role || req.user.role || 'admin');

    const logs = (await db.prepare(
      'SELECT id, role, user_name, action_type, action_title, details, target_name, created_at FROM activity_logs WHERE role = ? ORDER BY created_at DESC'
    ).all(targetRole)) || [];

    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [
      ['ID', 'Scope Role', 'User', 'Category', 'Action Title', 'Target / Subject', 'Details', 'Date & Time'],
      ...logs.map(l => [
        l.id,
        l.role,
        l.user_name,
        l.action_type,
        l.action_title,
        l.target_name || 'N/A',
        l.details,
        l.created_at
      ])
    ].map(row => row.map(q).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${targetRole}_historical_data_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Export history error:', err.message);
    res.status(500).send('Error generating history export');
  }
});

/**
 * POST /api/history/log
 * Allow logging custom events
 */
router.post('/log', auth, staff, async (req, res) => {
  try {
    const db = req.app.get('db');
    const role = req.user.role;
    const { action_type, action_title, details, target_name } = req.body;

    await logActivity(db, {
      role,
      userName: req.user.username,
      actionType: action_type,
      actionTitle: action_title,
      details,
      targetName: target_name
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
