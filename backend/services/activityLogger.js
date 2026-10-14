/**
 * Centralized activity logger for recording historical actions
 * Separated between Admin actions and Teacher actions
 */

async function logActivity(db, { role, userName, actionType, actionTitle, details, targetName }) {
  if (!db) return;
  try {
    const assignedRole = role === 'admin' ? 'admin' : 'teacher';
    const assignedUser = userName || (assignedRole === 'admin' ? 'admin' : 'teacher');
    const title = String(actionTitle || 'System Event').trim();
    const detailsStr = String(details || '').trim();
    const target = targetName ? String(targetName).trim() : null;
    const type = String(actionType || 'general').trim();

    if (db.isPostgres) {
      await db.prepare(
        'INSERT INTO activity_logs (role, user_name, action_type, action_title, details, target_name) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(assignedRole, assignedUser, type, title, detailsStr, target);
    } else {
      await db.prepare(
        'INSERT INTO activity_logs (role, user_name, action_type, action_title, details, target_name) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(assignedRole, assignedUser, type, title, detailsStr, target);
    }
  } catch (err) {
    console.warn('Notice logging activity event:', err.message);
  }
}

module.exports = {
  logActivity
};
