const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const JWT_SECRET = process.env.JWT_SECRET || 'sta-rosa-qr-secret-key-grade6-2026';

router.post('/login', async function(req, res) {
    try {
        const db = req.app.get('db');
        const loginIdentifier = (req.body.username || req.body.email || '').trim();
        const password = req.body.password || '';
        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const user = await db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))').get(loginIdentifier, loginIdentifier);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Segregated portal role enforcement
        const expectedRole = (req.body.expectedRole || '').trim().toLowerCase();
        if (expectedRole) {
            if (expectedRole === 'teacher' && user.role !== 'teacher') {
                return res.status(403).json({ 
                    error: 'Access restricted: This portal is exclusively for Faculty and Class Advisers. Please use the ' + (user.role === 'student' ? 'Learner Portal.' : 'Admin Console.')
                });
            }
            if (expectedRole === 'student' && user.role !== 'student') {
                return res.status(403).json({ 
                    error: 'Access restricted: This portal is exclusively for enrolled Learners. Please use the ' + (user.role === 'teacher' ? 'Faculty Portal.' : 'Admin Console.')
                });
            }
            if (expectedRole === 'admin' && user.role !== 'admin') {
                return res.status(403).json({ 
                    error: 'Access restricted: This console is strictly reserved for School Administrators.'
                });
            }
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
        let username = (req.body.username || req.body.email || '').trim();
        const password = req.body.password || '';
        const role = req.body.role || 'teacher';
        if (!fullName || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // DepEd domain requirement for teachers: must be an official @deped.gov.ph account
        if (role === 'teacher') {
            const depedEmailRegex = /^[a-zA-Z0-9._%+-]+@deped\.gov\.ph$/i;
            if (!depedEmailRegex.test(username)) {
                return res.status(400).json({ 
                    error: 'Teachers must be registered with an official DepEd email address (e.g. name@deped.gov.ph).' 
                });
            }
            username = username.toLowerCase();
        }

        const existing = await db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))').get(username, username);
        if (existing) {
            return res.status(400).json({ error: 'An account with this username or DepEd email already exists' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        const emailVal = role === 'teacher' ? username : ((req.body.email || '').trim().toLowerCase() || null);
        const result = await db.prepare('INSERT INTO users (full_name, username, email, password, role) VALUES (?, ?, ?, ?, ?)').run(fullName, username, emailVal, hashedPassword, role);

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
        const role = req.query.role;
        const includeStudents = req.query.include_students === 'true';

        let query = `
            SELECT u.id, u.full_name, u.username, u.role, u.created_at,
                   (CASE WHEN u.face_descriptor IS NOT NULL AND u.face_descriptor != '' THEN 1 ELSE 0 END) AS has_face_profile,
                   (SELECT COUNT(*) FROM students s WHERE s.teacher_id = u.id) AS student_count
            FROM users u
        `;
        const params = [];

        if (role) {
            query += ' WHERE u.role = ?';
            params.push(role);
        } else if (!includeStudents) {
            query += " WHERE u.role != 'student'";
        }

        query += ' ORDER BY u.id';

        const users = await db.prepare(query).all(...params);
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get currently authenticated user profile
router.get('/me', auth, async function(req, res) {
    try {
        const db = req.app.get('db');
        const user = await db.prepare('SELECT id, full_name, username, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User account not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Administrator's own login credentials (username, full_name, email, password)
router.put('/admin-credentials', auth, async function(req, res) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access restricted: Only administrators can update admin credentials.' });
        }

        const db = req.app.get('db');
        const adminId = req.user.id;

        const currentAdmin = await db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
        if (!currentAdmin) {
            return res.status(404).json({ error: 'Administrator account not found.' });
        }

        const { current_password, username, full_name, email, new_password, confirm_password } = req.body;

        if (!current_password) {
            return res.status(400).json({ error: 'Current password is required to verify your authorization.' });
        }

        const isCurrentValid = bcrypt.compareSync(current_password, currentAdmin.password);
        if (!isCurrentValid) {
            return res.status(401).json({ error: 'Incorrect current password. Credential update denied.' });
        }

        const newUsername = (username !== undefined ? username : currentAdmin.username || '').trim();
        const newFullName = (full_name !== undefined ? full_name : currentAdmin.full_name || '').trim();
        const newEmail = email !== undefined ? (email ? email.trim().toLowerCase() : null) : (currentAdmin.email || null);

        if (!newUsername) {
            return res.status(400).json({ error: 'Username cannot be blank.' });
        }
        if (!newFullName) {
            return res.status(400).json({ error: 'Full name / display name cannot be blank.' });
        }

        // Uniqueness check for username / email against other accounts
        const conflict = await db.prepare(
            'SELECT id, username, email FROM users WHERE (LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))) AND id != ?'
        ).get(newUsername, newUsername, adminId);

        if (conflict) {
            return res.status(400).json({ error: 'Another account is already using this username or email address.' });
        }

        let updatedHashedPassword = currentAdmin.password;
        let passwordChanged = false;

        if (new_password) {
            if (new_password.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
            }
            if (confirm_password !== undefined && new_password !== confirm_password) {
                return res.status(400).json({ error: 'New password and confirmation password do not match.' });
            }
            updatedHashedPassword = bcrypt.hashSync(new_password, 10);
            passwordChanged = true;
        }

        await db.prepare(
            'UPDATE users SET username = ?, full_name = ?, email = ?, password = ? WHERE id = ?'
        ).run(newUsername, newFullName, newEmail, updatedHashedPassword, adminId);

        const updatedAdmin = await db.prepare(
            'SELECT id, full_name, username, email, role, created_at FROM users WHERE id = ?'
        ).get(adminId);

        const newToken = jwt.sign(
            { id: updatedAdmin.id, username: updatedAdmin.username, role: updatedAdmin.role, full_name: updatedAdmin.full_name, student_id: null },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: 'admin',
                userName: updatedAdmin.username,
                actionType: 'security_update',
                actionTitle: 'Admin Log In Credentials Updated',
                details: `Admin account credentials updated for @${updatedAdmin.username}${passwordChanged ? ' (password changed)' : ''}.`,
                targetName: updatedAdmin.full_name
            });
        } catch (logErr) {}

        res.json({
            message: 'Admin login credentials updated successfully.',
            token: newToken,
            user: {
                id: updatedAdmin.id,
                username: updatedAdmin.username,
                full_name: updatedAdmin.full_name,
                email: updatedAdmin.email,
                role: updatedAdmin.role
            },
            passwordChanged
        });
    } catch (error) {
        console.error('Update admin credentials error:', error.message);
        res.status(500).json({ error: 'Server error while updating admin credentials.' });
    }
});

router.delete('/users/:id', auth, async function(req, res) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete users' });
        }
        const db = req.app.get('db');
        const userId = req.params.id;
        const user = await db.prepare('SELECT full_name, username, role FROM users WHERE id = ?').get(userId);
        if (user && (user.role === 'admin' || user.username === 'admin' || String(userId) === String(req.user.id))) {
            return res.status(400).json({ error: 'Administrator accounts cannot be deleted.' });
        }
        if (user && user.role === 'student') {
            return res.status(400).json({ error: 'Student accounts cannot be deleted here. Please manage student accounts in the Student Accounts page.' });
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

// Biometric distance helper for 128-float face vectors
function computeEuclideanDistance(descA, descB) {
    if (!descA || !descB || descA.length !== descB.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < descA.length; i++) {
        const diff = descA[i] - descB[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// Biometric Teacher Facial Recognition Login (Strictly for Teachers)
router.post('/teacher-face-login', async function(req, res) {
    try {
        const db = req.app.get('db');
        const { faceDescriptor, identifier } = req.body;

        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length < 68) {
            return res.status(400).json({ error: 'Valid facial descriptor vector is required.' });
        }

        // Query only users with role = 'teacher' who have registered face descriptors
        let query = "SELECT id, full_name, username, email, role, face_descriptor FROM users WHERE role = 'teacher' AND face_descriptor IS NOT NULL AND face_descriptor != ''";
        const params = [];

        if (identifier && identifier.trim()) {
            query += " AND (LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)))";
            params.push(identifier.trim(), identifier.trim());
        }

        const teachers = await db.prepare(query).all(...params);

        if (!teachers || teachers.length === 0) {
            if (identifier) {
                return res.status(404).json({ 
                    error: 'No teacher account with registered facial biometric data found for this identifier. Please sign in with password first.' 
                });
            }
            return res.status(404).json({ 
                error: 'No teachers currently have facial recognition enabled. Please register facial data or sign in with password.' 
            });
        }

        let bestTeacher = null;
        let bestDistance = Infinity;

        for (const teacher of teachers) {
            try {
                const storedDesc = JSON.parse(teacher.face_descriptor);
                const dist = computeEuclideanDistance(faceDescriptor, storedDesc);
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestTeacher = teacher;
                }
            } catch (err) {
                console.warn('Error parsing face descriptor for teacher', teacher.id, err);
            }
        }

        const MATCH_THRESHOLD = 0.52; // Standard face-api confidence threshold
        if (!bestTeacher || bestDistance > MATCH_THRESHOLD) {
            return res.status(401).json({ 
                error: 'Facial recognition failed: Face does not match any authorized faculty record.',
                confidence: bestDistance !== Infinity ? (Math.max(0, (1 - bestDistance) * 100)).toFixed(1) + '%' : null
            });
        }

        // Issue JWT token for teacher
        const token = jwt.sign(
            { id: bestTeacher.id, username: bestTeacher.username, role: 'teacher', full_name: bestTeacher.full_name, student_id: null },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: 'teacher',
                userName: bestTeacher.username,
                actionType: 'biometric_login',
                actionTitle: `Teacher Face Recognition Login: ${bestTeacher.full_name}`,
                details: `Successful biometric facial login with match distance ${bestDistance.toFixed(3)}.`,
                targetName: bestTeacher.full_name
            });
        } catch (logErr) {}

        return res.json({
            message: 'Facial recognition verified successfully.',
            token,
            user: {
                id: bestTeacher.id,
                username: bestTeacher.username,
                role: 'teacher',
                full_name: bestTeacher.full_name,
                student_id: null
            },
            distance: bestDistance
        });

    } catch (error) {
        console.error('Teacher face login error:', error.message);
        res.status(500).json({ error: 'Server error during facial recognition login' });
    }
});

// Check whether a teacher has face recognition enabled
router.post('/check-teacher-face', async function(req, res) {
    try {
        const db = req.app.get('db');
        const identifier = (req.body.identifier || req.body.username || req.body.email || '').trim();
        if (!identifier) {
            const countRow = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'teacher' AND face_descriptor IS NOT NULL AND face_descriptor != ''").get();
            return res.json({ totalEnrolled: countRow ? countRow.total : 0 });
        }

        const teacher = await db.prepare("SELECT id, full_name, username, role, (CASE WHEN face_descriptor IS NOT NULL AND face_descriptor != '' THEN 1 ELSE 0 END) AS has_face FROM users WHERE (LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))) AND role = 'teacher'").get(identifier, identifier);

        if (!teacher) {
            return res.json({ found: false, hasFace: false });
        }

        res.json({
            found: true,
            hasFace: Boolean(teacher.has_face),
            teacherName: teacher.full_name,
            username: teacher.username
        });
    } catch (error) {
        console.error('Check teacher face error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Register / Update Teacher Facial Biometric Data
// Accessible by Admin (for any teacher) or by the Teacher themselves (for their own account)
router.post('/teacher-face-register', auth, async function(req, res) {
    try {
        const db = req.app.get('db');
        const { teacher_id, username, face_descriptor, clear } = req.body;

        let targetId = teacher_id;
        if (!targetId && username) {
            const u = await db.prepare("SELECT id, role FROM users WHERE LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))").get(username, username);
            if (u) {
                targetId = u.id;
            }
        }

        if (!targetId && req.user.role === 'teacher') {
            targetId = req.user.id;
        }

        if (!targetId) {
            return res.status(400).json({ error: 'Teacher account ID or username is required.' });
        }

        // Security check: Only Admins can register face for any teacher.
        // Teachers can only register their own face.
        if (req.user.role !== 'admin' && (req.user.role !== 'teacher' || req.user.id !== targetId)) {
            return res.status(403).json({ error: 'Forbidden: You cannot modify biometric data for this account.' });
        }

        // Verify target account is indeed a teacher
        const targetUser = await db.prepare("SELECT id, username, full_name, role FROM users WHERE id = ?").get(targetId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (targetUser.role !== 'teacher') {
            return res.status(400).json({ error: 'Facial recognition enrollment is exclusively allowed for Teacher accounts.' });
        }

        if (clear) {
            await db.prepare("UPDATE users SET face_descriptor = NULL WHERE id = ?").run(targetId);
            return res.json({ message: `Facial data removed for teacher ${targetUser.full_name}.` });
        }

        if (!face_descriptor || !Array.isArray(face_descriptor) || face_descriptor.length < 68) {
            return res.status(400).json({ error: 'Invalid facial biometric descriptor.' });
        }

        const serialized = JSON.stringify(face_descriptor);
        await db.prepare("UPDATE users SET face_descriptor = ? WHERE id = ?").run(serialized, targetId);

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: req.user.role,
                userName: req.user.username,
                actionType: 'teacher_management',
                actionTitle: `Enrolled Biometric Face for Teacher: ${targetUser.full_name}`,
                details: `Registered facial recognition embedding vector for @${targetUser.username}.`,
                targetName: targetUser.full_name
            });
        } catch (logErr) {}

        res.json({ message: `Facial recognition profile registered successfully for ${targetUser.full_name}.` });
    } catch (error) {
        console.error('Teacher face register error:', error.message);
        res.status(500).json({ error: 'Server error during facial enrollment' });
    }
});

// Self-enroll face using teacher credentials (password authentication)
router.post('/teacher-face-self-enroll', async function(req, res) {
    try {
        const db = req.app.get('db');
        const loginIdentifier = (req.body.username || req.body.email || '').trim();
        const password = req.body.password || '';
        const faceDescriptor = req.body.faceDescriptor;

        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'DepEd email / username and password are required.' });
        }
        if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length < 68) {
            return res.status(400).json({ error: 'Valid biometric facial descriptor is required.' });
        }

        const user = await db.prepare('SELECT * FROM users WHERE (LOWER(username) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)))').get(loginIdentifier, loginIdentifier);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }
        if (user.role !== 'teacher') {
            return res.status(403).json({ error: 'Biometric face enrollment is exclusively available for Teacher accounts.' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password. Face not enrolled.' });
        }

        const serialized = JSON.stringify(faceDescriptor);
        await db.prepare('UPDATE users SET face_descriptor = ? WHERE id = ?').run(serialized, user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name, student_id: null },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        try {
            const { logActivity } = require('../services/activityLogger');
            await logActivity(db, {
                role: 'teacher',
                userName: user.username,
                actionType: 'biometric_enrollment',
                actionTitle: `Self-Enrolled Biometric Face: ${user.full_name}`,
                details: `Teacher linked facial biometric profile to account @${user.username}.`,
                targetName: user.full_name
            });
        } catch (logErr) {}

        res.json({
            message: `Facial recognition profile enrolled successfully for ${user.full_name}!`,
            token,
            user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, student_id: null }
        });
    } catch (error) {
        console.error('Teacher face self-enroll error:', error.message);
        res.status(500).json({ error: 'Server error during biometric self-enrollment' });
    }
});

module.exports = router;

