const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const { parseLearnersFromExcel } = require('../services/excelLearnerParser');
const { logActivity } = require('../services/activityLogger');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB max
});

function staff(req, res, next) {
    if (!['admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({
            error: 'Teacher or admin account required'
        });
    }
    next();
}

async function ensureStudentColumns(db) {
    if (db.isPostgres) return; // PostgreSQL schema handled via migrations
    try {
        const columns = (await db.prepare('PRAGMA table_info(students)').all() || [])
            .map(function (column) {
                return column.name;
            });

        if (!columns.includes('student_phone')) {
            await db.exec('ALTER TABLE students ADD COLUMN student_phone TEXT');
        }
        if (!columns.includes('email')) {
            await db.exec('ALTER TABLE students ADD COLUMN email TEXT');
        }
        if (!columns.includes('is_enrolled')) {
            await db.exec('ALTER TABLE students ADD COLUMN is_enrolled INTEGER DEFAULT 1');
        }
        if (!columns.includes('enrollment_status')) {
            await db.exec("ALTER TABLE students ADD COLUMN enrollment_status TEXT DEFAULT 'officially_enrolled'");
        }
        if (!columns.includes('teacher_id')) {
            await db.exec('ALTER TABLE students ADD COLUMN teacher_id INTEGER');
        }
        if (!columns.includes('face_descriptor')) {
            await db.exec('ALTER TABLE students ADD COLUMN face_descriptor TEXT');
        }

        await db.exec("UPDATE students SET is_enrolled = 1 WHERE is_enrolled IS NULL OR is_enrolled = ''");
        await db.exec("UPDATE students SET enrollment_status = 'officially_enrolled' WHERE enrollment_status IS NULL OR enrollment_status = ''");
        await db.exec("UPDATE students SET teacher_id = (SELECT id FROM users WHERE role = 'teacher' ORDER BY id LIMIT 1) WHERE teacher_id IS NULL OR teacher_id = 0");
    } catch (e) {}
}

// Get students: Each teacher sees their OWN students; Admin can view all or filter by teacher_id
router.get('/', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        let query = 'SELECT * FROM students';
        const params = [];

        if (req.user.role === 'teacher') {
            query += ' WHERE teacher_id = ?';
            params.push(req.user.id);
        } else if (req.query.teacher_id) {
            query += ' WHERE teacher_id = ?';
            params.push(req.query.teacher_id);
        }

        query += ' ORDER BY sex, full_name';

        const rows = await db.prepare(query).all(...params);

        const students = (rows || []).map(s => {
            const isBlocked = s.is_enrolled === 0 || s.is_enrolled === '0' || s.enrollment_status === 'not_enrolled' || s.enrollment_status === 'dropped';
            return {
                ...s,
                is_enrolled: isBlocked ? 0 : 1,
                enrollment_status: isBlocked ? (s.enrollment_status || 'not_enrolled') : 'officially_enrolled',
                has_face_profile: s.face_descriptor ? 1 : 0,
                face_descriptor: undefined // strip raw descriptor from list response for performance
            };
        });

        res.json(students);
    } catch (error) {
        console.error('Get students error:', error.message);
        res.status(500).json({ error: 'Could not load students' });
    }
});

router.get('/:id', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        let query = 'SELECT * FROM students WHERE id = ?';
        const params = [req.params.id];

        if (req.user.role === 'teacher') {
            query += ' AND teacher_id = ?';
            params.push(req.user.id);
        }

        const student = await db.prepare(query).get(...params);

        if (!student) {
            return res.status(404).json({ error: 'Student not found in your class roster' });
        }

        const isBlocked = student.is_enrolled === 0 || student.is_enrolled === '0' || student.enrollment_status === 'not_enrolled' || student.enrollment_status === 'dropped';
        res.json({
            ...student,
            is_enrolled: isBlocked ? 0 : 1,
            enrollment_status: isBlocked ? (student.enrollment_status || 'not_enrolled') : 'officially_enrolled'
        });
    } catch (error) {
        console.error('Get student error:', error.message);
        res.status(500).json({ error: 'Could not load student' });
    }
});

// Add single student: automatically binds to teacher_id
router.post('/', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        const fullName = String(req.body.full_name || '').trim();
        const sex = String(req.body.sex || 'M').trim().toUpperCase() === 'F' ? 'F' : 'M';
        const lrn = String(req.body.lrn || '').trim();
        const guardianName = String(req.body.guardian_name || '').trim();
        const guardianContact = String(req.body.guardian_contact || '').trim();
        const studentPhone = String(req.body.student_phone || '').trim();
        const email = String(req.body.email || '').trim();
        const isEnrolled = req.body.is_enrolled !== undefined ? (req.body.is_enrolled ? 1 : 0) : 1;
        const enrollmentStatus = String(req.body.enrollment_status || (isEnrolled ? 'officially_enrolled' : 'not_enrolled')).trim();
        const teacherId = req.user.role === 'teacher' ? req.user.id : (req.body.teacher_id || null);

        if (!fullName) {
            return res.status(400).json({
                error: 'Student full name is required'
            });
        }

        // Prevent duplicate student in the same section
        const existingStudent = await db.prepare(
            'SELECT id FROM students WHERE LOWER(TRIM(full_name)) = LOWER(?) AND (teacher_id = ? OR (? IS NULL AND teacher_id IS NULL))'
        ).get(fullName, teacherId, teacherId);

        if (existingStudent) {
            return res.status(409).json({
                error: `Student "${fullName}" already exists in your roster (Student ID #${existingStudent.id}).`
            });
        }

        const qrCode =
            'QR-' +
            (teacherId ? teacherId + '-' : '') +
            fullName.replace(/[^A-Z]/gi, '').substring(0, 10).toUpperCase() +
            '-' +
            Date.now();

        const result = await db.prepare(
            'INSERT INTO students ' +
            '(full_name, sex, lrn, guardian_name, guardian_contact, student_phone, email, is_enrolled, enrollment_status, qr_code, teacher_id) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            fullName,
            sex,
            lrn,
            guardianName,
            guardianContact,
            studentPhone,
            email,
            isEnrolled,
            enrollmentStatus,
            qrCode,
            teacherId
        );

        res.status(201).json({
            message: 'Student added to your roster',
            id: result.lastInsertRowid,
            qr_code: qrCode
        });
    } catch (error) {
        console.error('Add student error:', error.message);
        res.status(500).json({ error: 'Could not add student' });
    }
});

// Import learners from Excel (.xls / .xlsx - specifically designed for SF2 template on MARCH)
router.post('/import-excel', auth, staff, upload.single('file'), async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        let fileBuffer = null;
        if (req.file && req.file.buffer) {
            fileBuffer = req.file.buffer;
        } else if (req.body.fileData) {
            fileBuffer = Buffer.from(req.body.fileData, 'base64');
        }

        if (!fileBuffer) {
            return res.status(400).json({ error: 'Please upload an Excel file (.xls or .xlsx)' });
        }

        const sheetName = req.body.sheetName || req.body.sheet_name || null;
        const replaceExisting = String(req.body.replaceExisting) === 'true' || req.body.replaceExisting === true;
        const isPreview = String(req.query.preview) === 'true' || req.body.preview === true;

        // Parse using DepEd SF2 March template extractor
        const parsed = parseLearnersFromExcel(fileBuffer, { sheetName });

        if (!parsed.learners || !parsed.learners.length) {
            return res.status(400).json({
                error: `No learners found in sheet "${parsed.sheetName}". Please ensure learners are listed under the NAME column.`
            });
        }

        // If preview only, return extracted learners without saving
        if (isPreview) {
            return res.json({
                preview: true,
                sheetName: parsed.sheetName,
                availableSheets: parsed.availableSheets,
                totalCount: parsed.totalCount,
                maleCount: parsed.maleCount,
                femaleCount: parsed.femaleCount,
                learners: parsed.learners
            });
        }

        const teacherId = req.user.role === 'teacher' ? req.user.id : (req.body.teacher_id || null);

        // If replace existing, only remove this teacher's own students
        if (replaceExisting) {
            if (teacherId) {
                await db.prepare('DELETE FROM students WHERE teacher_id = ?').run(teacherId);
            } else {
                await db.prepare('DELETE FROM students WHERE teacher_id IS NULL').run();
            }
        }

        const insertStmt = db.prepare(
            'INSERT INTO students (full_name, sex, lrn, is_enrolled, enrollment_status, qr_code, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        let insertedCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;
        const insertedList = [];
        const timestamp = Date.now().toString().slice(-4);

        for (let i = 0; i < parsed.learners.length; i++) {
            const item = parsed.learners[i];
            const cleanName = String(item.full_name || '').trim();
            if (!cleanName) continue;

            const sex = item.sex === 'F' ? 'F' : 'M';
            const itemLrn = String(item.lrn || '').trim();

            if (!replaceExisting) {
                // Deduplication check: does a learner with this name already exist for this teacher?
                const existing = await db.prepare(
                    'SELECT id, lrn, qr_code FROM students WHERE LOWER(TRIM(full_name)) = LOWER(?) AND (teacher_id = ? OR (? IS NULL AND teacher_id IS NULL))'
                ).get(cleanName, teacherId, teacherId);

                if (existing) {
                    if (itemLrn && !existing.lrn) {
                        await db.prepare('UPDATE students SET lrn = ? WHERE id = ?').run(itemLrn, existing.id);
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }
                    insertedList.push({
                        id: existing.id,
                        full_name: cleanName,
                        sex,
                        qr_code: existing.qr_code,
                        alreadyExisted: true
                    });
                    continue;
                }
            }

            const qr = 'QR-' + 
                       (teacherId ? teacherId + '-' : '') +
                       cleanName.replace(/[^A-Z]/gi, '').substring(0, 10).toUpperCase() + '-' +
                       sex + (i + 1) + '-' + timestamp + '-' + (i + 1);

            const result = await insertStmt.run(
                cleanName,
                sex,
                itemLrn,
                1,  // Officially enrolled
                'officially_enrolled',
                qr,
                teacherId
            );

            insertedCount++;
            insertedList.push({
                id: result.lastInsertRowid,
                full_name: cleanName,
                sex,
                qr_code: qr
            });
        }

        // Log this action
        try {
            await logActivity(db, {
                role: req.user.role,
                userName: req.user.username,
                actionType: 'student_update',
                actionTitle: `Imported ${insertedCount} Learners from Excel (${parsed.sheetName})`,
                details: `Extracted ${parsed.maleCount} Male and ${parsed.femaleCount} Female learners into class roster from sheet "${parsed.sheetName}".`,
                targetName: `Roster (${parsed.sheetName})`
            });
        } catch (logErr) {}

        res.json({
            success: true,
            message: `Successfully imported ${insertedCount} learners (${parsed.maleCount} Male, ${parsed.femaleCount} Female) from sheet "${parsed.sheetName}"!`,
            count: insertedCount,
            maleCount: parsed.maleCount,
            femaleCount: parsed.femaleCount,
            sheetName: parsed.sheetName,
            students: insertedList
        });
    } catch (error) {
        console.error('Import excel error:', error.message);
        res.status(500).json({ error: 'Failed to import learners from Excel: ' + error.message });
    }
});

// Batch setup roster for teacher
router.post('/batch-setup', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        const list = Array.isArray(req.body.students) ? req.body.students : [];
        const clearExisting = !!req.body.clearExisting;
        const teacherId = req.user.role === 'teacher' ? req.user.id : (req.body.teacher_id || null);

        if (!list.length) {
            return res.status(400).json({ error: 'Please provide at least one student name.' });
        }

        // Only clear THIS teacher's roster, preserving other teachers' students
        if (clearExisting) {
            if (teacherId) {
                await db.prepare('DELETE FROM students WHERE teacher_id = ?').run(teacherId);
            } else {
                await db.prepare('DELETE FROM students WHERE teacher_id IS NULL').run();
            }
        }

        let insertedCount = 0;
        const insertStmt = db.prepare(
            'INSERT INTO students (full_name, sex, lrn, is_enrolled, enrollment_status, qr_code, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        for (let index = 0; index < list.length; index++) {
            const item = list[index];
            const name = String(item.full_name || item.name || '').trim();
            if (!name) continue;

            const sex = String(item.sex || 'M').trim().toUpperCase() === 'F' ? 'F' : 'M';
            const lrn = String(item.lrn || '').trim();
            const isEnrolled = item.is_enrolled !== undefined ? (item.is_enrolled ? 1 : 0) : 1;
            const enrollmentStatus = String(item.enrollment_status || 'officially_enrolled').trim();
            const qr = 'QR-' + (teacherId ? teacherId + '-' : '') + name.replace(/[^A-Z]/gi, '').substring(0, 10).toUpperCase() + '-' + sex + (index + 1) + '-' + Math.floor(1000 + Math.random() * 9000);

            await insertStmt.run(name, sex, lrn, isEnrolled, enrollmentStatus, qr, teacherId);
            insertedCount++;
        }

        res.json({
            message: `Successfully set up class roster with ${insertedCount} students!`,
            count: insertedCount
        });
    } catch (error) {
        console.error('Batch setup error:', error.message);
        res.status(500).json({ error: 'Could not set up student roster: ' + error.message });
    }
});

// Quick toggle enrollment status
router.patch('/:id/enrollment', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        if (req.user.role === 'teacher' && student.teacher_id && student.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to modify another teacher\'s student' });
        }

        const isEnrolled = req.body.is_enrolled !== undefined ? (req.body.is_enrolled ? 1 : 0) : (student.is_enrolled ? 0 : 1);
        const enrollmentStatus = isEnrolled ? 'officially_enrolled' : 'not_enrolled';

        await db.prepare('UPDATE students SET is_enrolled = ?, enrollment_status = ? WHERE id = ?')
            .run(isEnrolled, enrollmentStatus, req.params.id);

        res.json({
            message: `Student enrollment updated to: ${isEnrolled ? 'Officially Enrolled' : 'Not Officially Enrolled'}`,
            is_enrolled: isEnrolled,
            enrollment_status: enrollmentStatus
        });
    } catch (error) {
        console.error('Update enrollment error:', error.message);
        res.status(500).json({ error: 'Could not update enrollment' });
    }
});

router.put('/:id', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        await ensureStudentColumns(db);

        const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        if (req.user.role === 'teacher' && student.teacher_id && student.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to modify another teacher\'s student' });
        }

        const fullName = String(req.body.full_name || '').trim();
        if (!fullName) {
            return res.status(400).json({
                error: 'Student full name is required'
            });
        }

        const isEnrolled = req.body.is_enrolled !== undefined ? (req.body.is_enrolled ? 1 : 0) : 1;
        const enrollmentStatus = String(req.body.enrollment_status || (isEnrolled ? 'officially_enrolled' : 'not_enrolled')).trim();

        await db.prepare(
            'UPDATE students SET ' +
            'full_name = ?, sex = ?, lrn = ?, guardian_name = ?, ' +
            'guardian_contact = ?, student_phone = ?, email = ?, ' +
            'is_enrolled = ?, enrollment_status = ? ' +
            'WHERE id = ?'
        ).run(
            fullName,
            String(req.body.sex || 'M').trim().toUpperCase() === 'F' ? 'F' : 'M',
            String(req.body.lrn || '').trim(),
            String(req.body.guardian_name || '').trim(),
            String(req.body.guardian_contact || '').trim(),
            String(req.body.student_phone || '').trim(),
            String(req.body.email || '').trim(),
            isEnrolled,
            enrollmentStatus,
            req.params.id
        );

        res.json({ message: 'Student updated' });
    } catch (error) {
        console.error('Update student error:', error.message);
        res.status(500).json({ error: 'Could not update student' });
    }
});

router.delete('/:id', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');

        const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        if (req.user.role === 'teacher' && student.teacher_id && student.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to delete another teacher\'s student' });
        }

        await db.prepare('DELETE FROM students WHERE id = ?')
            .run(req.params.id);

        res.json({ message: 'Student deleted' });
    } catch (error) {
        console.error('Delete student error:', error.message);
        res.status(500).json({ error: 'Could not delete student' });
    }
});

// ── Student Face Biometric Enrollment ────────────────────────────────────────

// POST /api/students/:id/face  — Enroll or update a student's facial descriptor
router.post('/:id/face', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        const studentId = req.params.id;

        const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        // Teacher isolation: teachers may only enroll their own students
        if (req.user.role === 'teacher' && student.teacher_id && student.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden: You cannot enroll biometric data for a student in another adviser\'s roster.' });
        }

        const { face_descriptor } = req.body;
        if (!face_descriptor || !Array.isArray(face_descriptor) || face_descriptor.length < 68) {
            return res.status(400).json({ error: 'Invalid facial biometric descriptor. Must be an array of at least 68 float values.' });
        }

        const serialized = JSON.stringify(face_descriptor);
        await db.prepare('UPDATE students SET face_descriptor = ? WHERE id = ?').run(serialized, studentId);

        try {
            await logActivity(db, {
                role: req.user.role,
                userName: req.user.username,
                actionType: 'biometric_enrollment',
                actionTitle: `Student Face Enrolled: ${student.full_name}`,
                details: `Registered facial biometric profile for student ${student.full_name} (LRN: ${student.lrn || 'N/A'}).`,
                targetName: student.full_name
            });
        } catch (logErr) {}

        res.json({ message: `Facial recognition profile enrolled successfully for ${student.full_name}.` });
    } catch (error) {
        console.error('Student face enroll error:', error.message);
        res.status(500).json({ error: 'Server error during student biometric enrollment.' });
    }
});

// DELETE /api/students/:id/face  — Clear a student's facial descriptor
router.delete('/:id/face', auth, staff, async function (req, res) {
    try {
        const db = req.app.get('db');
        const studentId = req.params.id;

        const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        // Teacher isolation: teachers may only clear their own students' biometrics
        if (req.user.role === 'teacher' && student.teacher_id && student.teacher_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden: You cannot modify biometric data for a student in another adviser\'s roster.' });
        }

        await db.prepare('UPDATE students SET face_descriptor = NULL WHERE id = ?').run(studentId);

        try {
            await logActivity(db, {
                role: req.user.role,
                userName: req.user.username,
                actionType: 'biometric_enrollment',
                actionTitle: `Student Face Profile Cleared: ${student.full_name}`,
                details: `Removed facial biometric profile for student ${student.full_name}.`,
                targetName: student.full_name
            });
        } catch (logErr) {}

        res.json({ message: `Facial recognition profile cleared for ${student.full_name}.` });
    } catch (error) {
        console.error('Student face clear error:', error.message);
        res.status(500).json({ error: 'Server error clearing student biometric profile.' });
    }
});

module.exports = router;