const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const JWT_SECRET = process.env.JWT_SECRET || 'sta-rosa-qr-secret-key-grade6-2026';

router.post('/login', async function(req, res) {
    try {
        const db = req.app.get('db');
        const username = (req.body.username || req.body.email || '').trim();
        const password = req.body.password || '';
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name, student_id: user.student_id || null },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token: token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, student_id: user.student_id || null } });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Server error during login' });
    }
});

router.post('/register', auth, async function(req, res) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can register users' });
        }
        const db = req.app.get('db');
        const fullName = (req.body.full_name || '').trim();
        const username = (req.body.username || req.body.email || '').trim();
        const password = req.body.password || '';
        const role = req.body.role || 'teacher';
        if (!fullName || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await db.prepare('INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, ?)').run(fullName, username, hashedPassword, role);

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: 'admin',
                userName: req.user.username,
                actionType: 'teacher_management',
                actionTitle: `Registered ${role === 'admin' ? 'Admin' : 'Faculty'} Account: ${fullName}`,
                details: `Added new user @${username} with role "${role}".`,
                targetName: fullName
            });
        } catch (logErr) {}

        res.json({ message: 'User registered successfully', id: result.lastInsertRowid });
    } catch (error) {
        console.error('Register error:', error.message);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

router.get('/users', auth, async function(req, res) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can view users' });
        }
        const db = req.app.get('db');
        const users = await db.prepare(`
            SELECT u.id, u.full_name, u.username, u.role, u.created_at,
                   (SELECT COUNT(*) FROM students s WHERE s.teacher_id = u.id) AS student_count
            FROM users u
            ORDER BY u.id
        `).all();
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/users/:id', auth, async function(req, res) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete users' });
        }
        const db = req.app.get('db');
        const userId = req.params.id;
        const user = await db.prepare('SELECT full_name, username FROM users WHERE id = ?').get(userId);
        if (user && user.username === 'admin') {
            return res.status(400).json({ error: 'Cannot delete default admin' });
        }
        await db.prepare('DELETE FROM students WHERE teacher_id = ?').run(userId);
        await db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: 'admin',
                userName: req.user.username,
                actionType: 'teacher_management',
                actionTitle: `Removed Faculty Account: @${user?.username || userId}`,
                details: `Deleted user profile for ${user?.full_name || 'Teacher'}.`,
                targetName: user?.full_name || user?.username || 'User'
            });
        } catch (logErr) {}

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

