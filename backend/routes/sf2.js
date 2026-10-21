const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Note: /seed-sample-absences is kept as an explicit debug route if called directly, but no longer mutates database on standard report queries.

router.all('/seed-sample-absences', async function(req, res) {
    try {
        var db = req.app.get('db');
        await db.prepare("UPDATE attendance SET status = 'am_absent' WHERE student_id = 3 AND date = '2026-10-06'").run();
        await db.prepare("UPDATE attendance SET status = 'pm_absent' WHERE student_id = 4 AND date = '2026-10-07'").run();
        await db.prepare("UPDATE attendance SET status = 'am_absent' WHERE student_id = 15 AND date = '2026-10-06'").run();
        await db.prepare("UPDATE attendance SET status = 'pm_absent' WHERE student_id = 17 AND date = '2026-10-07'").run();
        var sampleRows = await db.prepare("SELECT student_id, date, status FROM attendance WHERE student_id IN (3, 4, 15, 17) AND date IN ('2026-10-06', '2026-10-07')").all();
        res.json({ success: true, samples: sampleRows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/report', auth, async function(req, res) {
    try {
        var db = req.app.get('db');
        var month = req.query.month || new Date().toISOString().substring(0, 7);
        if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month format' });

        var studentsSql = 'SELECT * FROM students';
        var attSql = "SELECT a.*, s.full_name, s.sex FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date LIKE ?";
        var studentsParams = [];
        var attParams = [month + '%'];

        if (req.user.role === 'teacher') {
            studentsSql += ' WHERE teacher_id = ?';
            studentsParams.push(req.user.id);
            attSql += ' AND s.teacher_id = ?';
            attParams.push(req.user.id);
        }
        studentsSql += ' ORDER BY sex, full_name';

        var students = (await db.prepare(studentsSql).all(...studentsParams)) || [];
        var attendance = (await db.prepare(attSql).all(...attParams)) || [];

        var teacherName = (req.user && req.user.full_name) || 'TIFANNY MARTIN ARAGON';
        if (req.user && req.user.role === 'teacher' && !req.user.full_name) {
            var teacherRow = await db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user.id);
            if (teacherRow && teacherRow.full_name) teacherName = teacherRow.full_name;
        }
        teacherName = (teacherName || 'TIFANNY MARTIN ARAGON').toUpperCase();

        var { computeSF2ReportData } = require('../services/sf2Excel');
        var data = computeSF2ReportData({
            month: month,
            students: students,
            attendance: attendance,
            schoolInfo: {
                schoolName: 'Sta. Rosa ES',
                schoolId: '102056',
                gradeLevel: 'Grade 6',
                section: 'GREAT GENIUSES',
                adviser: teacherName,
                principal: 'MC RIZ TEMPLETON BUEN'
            }
        });
        res.json(data);
    } catch (error) {
        console.error('SF2 report error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/summary', auth, async function(req, res) {
    try {
        var db = req.app.get('db');
        var today = new Date().toISOString().split('T')[0];
        var totalSql = 'SELECT COUNT(*) as count FROM students';
        var presentSql = 'SELECT COUNT(*) as count FROM attendance WHERE date = ?';
        var totalParams = [];
        var presParams = [today];

        if (req.user.role === 'teacher') {
            totalSql += ' WHERE teacher_id = ?';
            totalParams.push(req.user.id);
            presentSql = 'SELECT COUNT(*) as count FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = ? AND s.teacher_id = ?';
            presParams.push(req.user.id);
        }

        var totalStudents = await db.prepare(totalSql).get(...totalParams);
        var presentToday = await db.prepare(presentSql).get(...presParams);
        var total = totalStudents ? Number(totalStudents.count) : 0;
        var present = presentToday ? Number(presentToday.count) : 0;
        res.json({ total_students: total, present_today: present, absent_today: total - present, attendance_rate: total > 0 ? Math.round((present / total) * 100) : 0 });
    } catch (error) {
        console.error('SF2 summary error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/download', auth, async function(req, res) {
    try {
        var db = req.app.get('db');
        var month = req.query.month || new Date().toISOString().substring(0, 7);
        if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month' });
        var monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var parts = month.split('-');
        var monthName = monthNames[parseInt(parts[1])] || '';

        var studentsSql = 'SELECT * FROM students';
        var attSql = 'SELECT a.* FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date LIKE ?';
        var studentsParams = [];
        var attParams = [month + '%'];

        if (req.user.role === 'teacher') {
            studentsSql += ' WHERE teacher_id = ?';
            studentsParams.push(req.user.id);
            attSql += ' AND s.teacher_id = ?';
            attParams.push(req.user.id);
        }
        studentsSql += ' ORDER BY sex, full_name';

        var students = (await db.prepare(studentsSql).all(...studentsParams)) || [];
        var attendance = (await db.prepare(attSql).all(...attParams)) || [];

        var teacherName = (req.user && req.user.full_name) || 'TIFANNY MARTIN ARAGON';
        if (req.user && req.user.role === 'teacher' && !req.user.full_name) {
            var teacherRow = await db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.user.id);
            if (teacherRow && teacherRow.full_name) teacherName = teacherRow.full_name;
        }
        teacherName = (teacherName || 'TIFANNY MARTIN ARAGON').toUpperCase();

        // Uses the official SF2 layout from templates/sf2_template.xlsx ("excel format.xls").
        var { buildSF2Workbook } = require('../services/sf2Excel');
        var workbook = await buildSF2Workbook({
            month: month,
            students: students,
            attendance: attendance,
            schoolInfo: {
                schoolName: 'Sta. Rosa ES',
                schoolId: '102056',
                gradeLevel: 'Grade 6',
                section: 'GREAT GENIUSES',
                adviser: teacherName,
                principal: 'MC RIZ TEMPLETON BUEN'
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=SF2_Report_' + monthName + '_' + parts[0] + '.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('SF2 download error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Server error generating report' });
    }
});

router.get('/download-legacy', auth, async function(req, res) {
    try {
        var ExcelJS = require('exceljs');
        var db = req.app.get('db');
        var month = req.query.month || new Date().toISOString().substring(0, 7);
        var monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var parts = month.split('-');
        var monthName = monthNames[parseInt(parts[1])] || '';
        var year = parts[0];

        var students = (await db.prepare('SELECT * FROM students ORDER BY sex, full_name').all()) || [];
        var attendance = (await db.prepare("SELECT * FROM attendance WHERE date LIKE ?").all(month + '%')) || [];
        var maleStudents = students.filter(function(s) { return s.sex === 'M'; });
        var femaleStudents = students.filter(function(s) { return s.sex === 'F'; });

        var workbook = new ExcelJS.Workbook();
        var sheet = workbook.addWorksheet('SF2 ' + monthName);

        sheet.mergeCells('A1:AH1');
        sheet.getCell('A1').value = 'School Form 2 (SF2) Daily Attendance Report of Learners';
        sheet.getCell('A1').font = { bold: true, size: 12 };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.mergeCells('A2:AH2');
        sheet.getCell('A2').value = '(This replaces Form 1, Form 2 & STS Form 4 - Absenteeism and Dropout Profile)';
        sheet.getCell('A2').alignment = { horizontal: 'center' };
        sheet.getCell('A2').font = { size: 8, italic: true };

        sheet.getCell('A3').value = 'School: Sta. Rosa ES';
        sheet.getCell('D3').value = 'School ID: 102056';
        sheet.getCell('H3').value = 'School Year: 2026-2027';
        sheet.getCell('N3').value = 'Grade Level: Grade 6';
        sheet.getCell('T3').value = 'Section: GREAT GENIUSES';
        sheet.getCell('Z3').value = 'Report for: ' + monthName.toUpperCase();

        var headerRow = sheet.addRow([]);
        headerRow.getCell(1).value = 'No.';
        headerRow.getCell(2).value = 'LEARNER NAME (Last, First, Middle)';
        headerRow.getCell(3).value = 'Sex';
        for (var d = 1; d <= 31; d++) { headerRow.getCell(d + 3).value = d; }
        headerRow.getCell(35).value = 'ABSENT';
        headerRow.getCell(36).value = 'PRESENT';
        headerRow.font = { bold: true, size: 8 };

        var maleLabel = sheet.addRow([]);
        maleLabel.getCell(1).value = 'MALE';
        maleLabel.font = { bold: true };

        for (var mi = 0; mi < maleStudents.length; mi++) {
            var ms = maleStudents[mi];
            var mRow = sheet.addRow([]);
            mRow.getCell(1).value = mi + 1;
            mRow.getCell(2).value = ms.full_name;
            mRow.getCell(3).value = 'M';
            var mPresent = 0;
            for (var day = 1; day <= 31; day++) {
                var dateStr = month + '-' + (day < 10 ? '0' : '') + day;
                var found = false;
                for (var a = 0; a < attendance.length; a++) {
                    if (attendance[a].student_id === ms.id && attendance[a].date === dateStr) { found = true; break; }
                }
                if (found) { mRow.getCell(day + 3).value = ''; mPresent++; }
            }
            mRow.getCell(35).value = 0;
            mRow.getCell(36).value = mPresent;
        }

        var femaleLabel = sheet.addRow([]);
        femaleLabel.getCell(1).value = 'FEMALE';
        femaleLabel.font = { bold: true };

        for (var fi = 0; fi < femaleStudents.length; fi++) {
            var fs2 = femaleStudents[fi];
            var fRow = sheet.addRow([]);
            fRow.getCell(1).value = fi + 1;
            fRow.getCell(2).value = fs2.full_name;
            fRow.getCell(3).value = 'F';
            var fPresent = 0;
            for (var day2 = 1; day2 <= 31; day2++) {
                var dateStr2 = month + '-' + (day2 < 10 ? '0' : '') + day2;
                var found2 = false;
                for (var a2 = 0; a2 < attendance.length; a2++) {
                    if (attendance[a2].student_id === fs2.id && attendance[a2].date === dateStr2) { found2 = true; break; }
                }
                if (found2) { fRow.getCell(day2 + 3).value = ''; fPresent++; }
            }
            fRow.getCell(35).value = 0;
            fRow.getCell(36).value = fPresent;
        }

        var summaryRow = sheet.addRow([]);
        summaryRow.getCell(1).value = 'TOTAL';
        summaryRow.getCell(2).value = (maleStudents.length + femaleStudents.length) + ' students';
        summaryRow.font = { bold: true };

        sheet.addRow([]);
        var adviserRow = sheet.addRow([]);
        adviserRow.getCell(2).value = 'Prepared by: TIFANNY MARTIN ARAGON (Class Adviser)';
        var headRow = sheet.addRow([]);
        headRow.getCell(2).value = 'Attested by: MC RIZ TEMPLETON BUEN (School Head)';

        sheet.getColumn(1).width = 5;
        sheet.getColumn(2).width = 35;
        sheet.getColumn(3).width = 5;
        for (var cw = 4; cw <= 34; cw++) { sheet.getColumn(cw).width = 4; }
        sheet.getColumn(35).width = 8;
        sheet.getColumn(36).width = 8;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=SF2_Report_' + monthName + '_' + year + '.xlsx');
        workbook.xlsx.write(res).then(function() { res.end(); });
    } catch (error) {
        console.error('SF2 download error:', error.message);
        res.status(500).json({ error: 'Server error generating report' });
    }
});

router.post('/progress', auth, async function(req, res) {
    try {
        var db = req.app.get('db');
        var schoolYear = req.body.school_year || '2026-2027';
        var progressData = JSON.stringify(req.body.progress || {});
        var existing = await db.prepare('SELECT id FROM sf2_progress WHERE school_year = ?').get(schoolYear);
        if (existing) {
            await db.prepare('UPDATE sf2_progress SET progress_data = ?, updated_at = CURRENT_TIMESTAMP WHERE school_year = ?').run(progressData, schoolYear);
        } else {
            await db.prepare('INSERT INTO sf2_progress (school_year, progress_data) VALUES (?, ?)').run(schoolYear, progressData);
        }

        try {
            const { logActivity } = require('../services/activityLogger');
            const role = req.user?.role || 'admin';
            await logActivity(db, {
                role: role,
                userName: req.user?.username || (role === 'admin' ? 'admin' : 'teacher'),
                actionType: 'sf2_update',
                actionTitle: role === 'admin' ? `Admin SF2 Compliance Review Saved` : `Teacher SF2 Progress Submission`,
                details: `Saved SF2 tracking and compliance updates for School Year ${schoolYear}.`,
                targetName: `SF2 Progress (${schoolYear})`
            });
        } catch (logErr) {}

        res.json({ message: 'Progress saved' });
    } catch (error) {
        console.error('Save progress error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }

});

router.get('/progress', auth, async function(req, res) {
    try {
        var db = req.app.get('db');
        var schoolYear = req.query.school_year || '2026-2027';
        var existing = await db.prepare('SELECT progress_data FROM sf2_progress WHERE school_year = ?').get(schoolYear);
        var progress = existing ? JSON.parse(existing.progress_data || '{}') : {};
        res.json({ school_year: schoolYear, progress: progress });
    } catch (error) {
        console.error('Get progress error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
