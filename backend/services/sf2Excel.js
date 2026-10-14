/**
 * SF2 Excel Generator & Attendance Report Service
 *
 * Implements the official DepEd School Form 2 (SF2) report logic and Excel builder
 * matching the template "excel format.xls" (saved as templates/sf2_template.xlsx).
 */
const path = require('path');
const ExcelJS = require('exceljs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'sf2_template.xlsx');
const TEMPLATE_SHEET = 'MARCH';
const LAST_COL = 47; // AU

const T = {
    headerEnd: 7,
    maleProto: 12,
    maleTotal: 24,
    femaleProto: 25,
    femaleTotal: 38,
    combined: 39,
    footerStart: 40,
    footerEnd: 72
};

// 25 day slots (5 weeks x Mon-Fri) in the template, left to right.
const DAY_COLS = [
    'F', 'H', 'I', 'J', 'K', 'L', 'N', 'O', 'P', 'Q', 'R', 'T', 'U', 'V', 'X',
    'Z', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AI', 'AJ', 'AK'
];
const WEEKDAY_LABEL = ['', 'M', 'T', 'W', 'TH', 'F'];
const MONTH_NAMES = [
    '', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
    'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

function clone(obj) { return obj ? JSON.parse(JSON.stringify(obj)) : obj; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function localToday() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function splitRef(ref) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    return { col: m[1], row: parseInt(m[2], 10) };
}

/** Copy one template row into destination sheet with styles and merges. */
function copyRow(src, dst, srcRow, dstRow, merges, withValues) {
    const s = src.getRow(srcRow);
    const d = dst.getRow(dstRow);
    if (s.height) d.height = s.height;
    for (let c = 1; c <= LAST_COL; c++) {
        const sc = s.getCell(c);
        const dc = d.getCell(c);
        if (sc.style && Object.keys(sc.style).length) dc.style = clone(sc.style);
        if (withValues && !(sc.isMerged && sc.master.address !== sc.address)) {
            if (sc.value !== null && sc.value !== undefined) dc.value = clone(sc.value);
        }
    }
    merges.forEach(function (m) {
        const [a, b] = m.split(':');
        const A = splitRef(a), B = splitRef(b);
        if (A.row === srcRow) {
            const offset = dstRow - srcRow;
            dst.mergeCells(A.col + (A.row + offset) + ':' + B.col + (B.row + offset));
        }
    });
}

/** All weekdays (Mon-Fri) of the month up to max 25 slots */
function schoolDaysOfMonth(year, month) {
    const days = [];
    const count = new Date(year, month, 0).getDate();
    for (let d = 1; d <= count; d++) {
        const dow = new Date(year, month - 1, d).getDay();
        if (dow >= 1 && dow <= 5) {
            days.push({ day: d, dow: dow, date: year + '-' + pad(month) + '-' + pad(d) });
        }
    }
    return days.slice(0, DAY_COLS.length);
}

/**
 * Computes SF2 calendar columns:
 * A day is a "class day" if it's <= today AND at least one student scanned attendance.
 */
function computeSF2Days(month, attendance) {
    const [year, mon] = month.split('-').map(Number);
    const today = localToday();
    const scanned = {};
    (attendance || []).forEach(function (a) { scanned[a.date] = true; });

    return schoolDaysOfMonth(year, mon).map(function (d) {
        return Object.assign({}, d, {
            label: WEEKDAY_LABEL[d.dow],
            isClassDay: d.date <= today && !!scanned[d.date]
        });
    });
}

// DepEd standard: attendance cells use clean plain styling (no colored fills)
const FONT_ATT_MARK = { name: 'SansSerif', color: { argb: 'FF000000' }, bold: true, size: 8 };

/**
 * Applies attendance mark to an Excel cell following official DepEd SF2 rules:
 * - Empty/Blank for Present
 * - 'X' for Whole Day Absent (standard letter 'X')
 * - Upper diagonal border for AM Half-Day Absent (Latecomer / Morning absent)
 * - Lower diagonal border for PM Half-Day Absent (Cutting classes / Afternoon absent)
 *
 * CRITICAL: In ExcelJS, cell.border/cell.font/cell.alignment setters directly mutate
 * this.style in place. Since the template shares style objects across hundreds of cells,
 * any style modification MUST clone cell.style first to avoid corrupting shared styles
 * (which was causing diagonal crosses to bleed across date headers and all student rows).
 */
function applyAttendanceCell(cell, dayAtt) {
    if (!dayAtt) {
        cell.value = null;
        return;
    }

    if (dayAtt.isMorningAbsent) {
        // AM half-day absence: Upper diagonal stroke
        cell.value = '';
        const curBorder = (cell.style && cell.style.border) ? cell.style.border : {};
        cell.style = Object.assign({}, cell.style || {}, {
            alignment: { horizontal: 'center', vertical: 'middle' },
            font: FONT_ATT_MARK,
            border: Object.assign({}, curBorder, { diagonal: { up: true, style: 'thin' } })
        });
    } else if (dayAtt.isAfternoonAbsent) {
        // PM half-day absence: Lower diagonal stroke
        cell.value = '';
        const curBorder = (cell.style && cell.style.border) ? cell.style.border : {};
        cell.style = Object.assign({}, cell.style || {}, {
            alignment: { horizontal: 'center', vertical: 'middle' },
            font: FONT_ATT_MARK,
            border: Object.assign({}, curBorder, { diagonal: { down: true, style: 'thin' } })
        });
    } else if (dayAtt.isAbsent) {
        // DepEd SF2: Whole day absent is simply the character 'X'
        cell.value = 'X';
        cell.style = Object.assign({}, cell.style || {}, {
            alignment: { horizontal: 'center', vertical: 'middle' },
            font: FONT_ATT_MARK
        });
    } else {
        // Present: DepEd SF2 leaves cell blank
        cell.value = '';
    }
}

/**
 * Shared calculation logic for both API JSON response and Excel generator.
 */
function computeSF2ReportData(opts) {
    const month = opts.month;
    const [year, mon] = month.split('-').map(Number);
    const monthName = MONTH_NAMES[mon] || '';
    const schoolDays = computeSF2Days(month, opts.attendance);
    const elapsedDays = schoolDays.filter(function (d) { return d.isClassDay; });

    const attMap = {};
    (opts.attendance || []).forEach(function (a) {
        if (!attMap[a.student_id]) attMap[a.student_id] = {};
        attMap[a.student_id][a.date] = a;
    });

    const activeStudents = (opts.students || []).filter(function (s) {
        return s.enrollment_status !== 'not_enrolled';
    });
    const males = activeStudents.filter(function (s) { return s.sex === 'M'; });
    const females = activeStudents.filter(function (s) { return s.sex !== 'M'; });

    function processLearners(list) {
        const perDay = schoolDays.map(function () { return 0; });
        let absentSum = 0;
        let presentSum = 0;
        let consecutive5 = 0;
        let dropped = 0;

        const learners = list.map(function (st, idx) {
            let absent = 0;
            let present = 0;
            let streak = 0;
            let maxStreak = 0;
            const rec = attMap[st.id] || {};

            const dayAttendance = {};
            schoolDays.forEach(function (sd, dayIndex) {
                if (!sd.isClassDay) {
                    dayAttendance[sd.day] = {
                        date: sd.date,
                        isClassDay: false,
                        status: null
                    };
                    return;
                }
                const aRec = rec[sd.date];

                if (aRec) {
                    const status = aRec.status || 'present';
                    const isMorningAbsent = (status === 'am_absent' || status === 'morning_absent');
                    const isAfternoonAbsent = (status === 'pm_absent' || status === 'afternoon_absent');

                    if (isMorningAbsent) {
                        absent += 0.5;
                        present += 0.5;
                        perDay[dayIndex] += 0.5;
                        streak = 0;
                        dayAttendance[sd.day] = {
                            date: sd.date,
                            isClassDay: true,
                            status: 'am_absent',
                            isPresent: true,
                            isAbsent: false,
                            isHalfDay: true,
                            isMorningAbsent: true,
                            isAfternoonAbsent: false,
                            mark: 'AM_ABSENT'
                        };
                    } else if (isAfternoonAbsent) {
                        absent += 0.5;
                        present += 0.5;
                        perDay[dayIndex] += 0.5;
                        streak = 0;
                        dayAttendance[sd.day] = {
                            date: sd.date,
                            isClassDay: true,
                            status: 'pm_absent',
                            isPresent: true,
                            isAbsent: false,
                            isHalfDay: true,
                            isMorningAbsent: false,
                            isAfternoonAbsent: true,
                            mark: 'PM_ABSENT'
                        };
                    } else {
                        // Full day present
                        present += 1;
                        perDay[dayIndex] += 1;
                        streak = 0;
                        dayAttendance[sd.day] = {
                            date: sd.date,
                            isClassDay: true,
                            status: status,
                            isPresent: true,
                            isAbsent: false,
                            isHalfDay: false,
                            isMorningAbsent: false,
                            isAfternoonAbsent: false,
                            mark: ''
                        };
                    }
                } else {
                    // Whole day absent (X)
                    absent += 1;
                    streak++;
                    if (streak > maxStreak) maxStreak = streak;
                    dayAttendance[sd.day] = {
                        date: sd.date,
                        isClassDay: true,
                        status: 'absent',
                        isPresent: false,
                        isAbsent: true,
                        isWholeDayAbsent: true,
                        isMorningAbsent: false,
                        isAfternoonAbsent: false,
                        mark: 'X'
                    };
                }
            });

            const isDropped = st.enrollment_status === 'dropped';
            if (isDropped) dropped++;
            if (maxStreak >= 5) consecutive5++;
            absentSum += absent;
            presentSum += present;

            return {
                id: st.id,
                no: idx + 1,
                name: (st.full_name || '').toUpperCase(),
                sex: st.sex,
                enrollment_status: st.enrollment_status,
                attendance: dayAttendance,
                absentCount: absent,
                presentCount: present,
                remarks: isDropped ? 'DROPPED OUT' : ''
            };
        });

        return {
            learners: learners,
            perDay: perDay,
            absentSum: absentSum,
            presentSum: presentSum,
            consecutive5: consecutive5,
            dropped: dropped
        };
    }

    const maleGroup = processLearners(males);
    const femaleGroup = processLearners(females);

    const combinedPerDay = schoolDays.map(function (sd, idx) {
        return sd.isClassDay ? (maleGroup.perDay[idx] + femaleGroup.perDay[idx]) : 0;
    });

    const daysCount = elapsedDays.length;
    const regM = males.length - maleGroup.dropped;
    const regF = females.length - femaleGroup.dropped;
    const enrM = males.length;
    const enrF = females.length;
    const adaM = daysCount ? (maleGroup.presentSum / daysCount) : 0;
    const adaF = daysCount ? (femaleGroup.presentSum / daysCount) : 0;
    const pct = function (num, den) { return den ? (num / den) * 100 : 0; };

    const syStart = mon >= 6 ? year : year - 1;
    const schoolYear = syStart + ' - ' + (syStart + 1);

    return {
        month: month,
        year: year,
        mon: mon,
        monthName: monthName,
        schoolYear: schoolYear,
        schoolDays: schoolDays,
        classDaysCount: daysCount,
        male: maleGroup.learners,
        female: femaleGroup.learners,
        maleTotals: {
            perDay: maleGroup.perDay,
            absent: maleGroup.absentSum,
            present: maleGroup.presentSum,
            count: males.length
        },
        femaleTotals: {
            perDay: femaleGroup.perDay,
            absent: femaleGroup.absentSum,
            present: femaleGroup.presentSum,
            count: females.length
        },
        combinedTotals: {
            perDay: combinedPerDay,
            absent: maleGroup.absentSum + femaleGroup.absentSum,
            present: maleGroup.presentSum + femaleGroup.presentSum,
            count: males.length + females.length
        },
        summary: {
            enrolment: { m: enrM, f: enrF, total: enrM + enrF },
            lateEnrolment: { m: 0, f: 0, total: 0 },
            registeredEnd: { m: regM, f: regF, total: regM + regF },
            pctEnrolment: {
                m: pct(regM, enrM).toFixed(2) + '%',
                f: pct(regF, enrF).toFixed(2) + '%',
                total: pct(regM + regF, enrM + enrF).toFixed(2) + '%'
            },
            ada: {
                m: adaM.toFixed(2),
                f: adaF.toFixed(2),
                total: (adaM + adaF).toFixed(2)
            },
            pctAttendance: {
                m: pct(adaM, regM).toFixed(2) + '%',
                f: pct(adaF, regF).toFixed(2) + '%',
                total: pct(adaM + adaF, regM + regF).toFixed(2) + '%'
            },
            consecutive5: {
                m: maleGroup.consecutive5,
                f: femaleGroup.consecutive5,
                total: maleGroup.consecutive5 + femaleGroup.consecutive5
            },
            droppedOut: {
                m: maleGroup.dropped,
                f: femaleGroup.dropped,
                total: maleGroup.dropped + femaleGroup.dropped
            },
            transferredOut: { m: 0, f: 0, total: 0 },
            transferredIn: { m: 0, f: 0, total: 0 }
        },
        schoolInfo: {
            schoolName: 'Sta. Rosa ES',
            schoolId: '102056',
            gradeLevel: 'Grade 6',
            section: 'GREAT GENIUSES',
            schoolYear: schoolYear,
            adviser: 'TIFANNY MARTIN ARAGON',
            principal: 'MC RIZ TEMPLETON BUEN'
        }
    };
}

/**
 * Builds the official SF2 Excel workbook using templates/sf2_template.xlsx
 */
async function buildSF2Workbook(opts) {
    const reportData = computeSF2ReportData(opts);
    const monthName = reportData.monthName;
    const schoolDays = reportData.schoolDays;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const ws = wb.getWorksheet(TEMPLATE_SHEET);

    // If learners fit within the standard 16 male slots and 13 female slots:
    // Write directly into the official template sheet to guarantee 100% perfect borders,
    // exact row heights, intact merged cells, and flawless layout matching DepEd SF2.
    if (reportData.male.length <= 16 && reportData.female.length <= 13) {
        // ---------- Header ----------
        ws.getCell('M3').value = reportData.schoolYear;
        ws.getCell('AA3').value = monthName;

        DAY_COLS.forEach(function (col, i) {
            const sd = schoolDays[i];
            ws.getCell(col + '6').value = sd ? sd.day : null;
            ws.getCell(col + '7').value = sd ? sd.label : null;
        });

        function populateLearners(startRow, slotCount, learners) {
            for (let i = 0; i < slotCount; i++) {
                const r = ws.getRow(startRow + i);
                const st = learners[i];
                if (st) {
                    r.getCell('A').value = st.no;
                    r.getCell('C').value = st.name;
                    DAY_COLS.forEach(function (col, idx) {
                        const sd = schoolDays[idx];
                        const cell = r.getCell(col);
                        if (!sd || !sd.isClassDay) {
                            cell.value = null;
                            return;
                        }
                        const dayAtt = st.attendance[sd.day];
                        applyAttendanceCell(cell, dayAtt);
                    });
                    r.getCell('AM').value = st.absentCount;
                    r.getCell('AO').value = st.presentCount;
                    r.getCell('AQ').value = st.remarks || null;
                } else {
                    // Blank row: clear placeholder data but preserve all template borders and formatting
                    r.getCell('A').value = i + 1;
                    r.getCell('C').value = null;
                    DAY_COLS.forEach(function (col) { r.getCell(col).value = null; });
                    r.getCell('AM').value = null;
                    r.getCell('AO').value = null;
                    r.getCell('AQ').value = null;
                }
            }
        }

        // Males in rows 8 to 23 (16 slots)
        populateLearners(8, 16, reportData.male);

        // Male Totals at Row 24
        ws.getCell('A24').value = reportData.maleTotals.count;
        DAY_COLS.forEach(function (col, idx) {
            const sd = schoolDays[idx];
            ws.getCell(col + '24').value = (sd && sd.isClassDay) ? (reportData.maleTotals.perDay[idx] || 0) : null;
        });
        ws.getCell('AM24').value = reportData.maleTotals.absent;
        ws.getCell('AO24').value = reportData.maleTotals.present;

        // Females in rows 25 to 37 (13 slots)
        populateLearners(25, 13, reportData.female);

        // Female Totals at Row 38
        ws.getCell('A38').value = reportData.femaleTotals.count;
        DAY_COLS.forEach(function (col, idx) {
            const sd = schoolDays[idx];
            ws.getCell(col + '38').value = (sd && sd.isClassDay) ? (reportData.femaleTotals.perDay[idx] || 0) : null;
        });
        ws.getCell('AM38').value = reportData.femaleTotals.absent;
        ws.getCell('AO38').value = reportData.femaleTotals.present;

        // Combined Totals at Row 39
        ws.getCell('A39').value = reportData.combinedTotals.count;
        DAY_COLS.forEach(function (col, idx) {
            const sd = schoolDays[idx];
            ws.getCell(col + '39').value = (sd && sd.isClassDay) ? (reportData.combinedTotals.perDay[idx] || 0) : null;
        });
        ws.getCell('AM39').value = reportData.combinedTotals.absent;
        ws.getCell('AO39').value = reportData.combinedTotals.present;

        // Footer at Row 40
        ws.getCell('AM40').value = 'Month : ' + monthName;
        ws.getCell('AP40').value = 'No. of Days of Classes: ' + reportData.classDaysCount;

        // Summary table rows at exact template rows (42 to 60)
        const s = reportData.summary;
        function writeSummaryRow(rowNo, item, isPct, isFloat) {
            [['AR', item.m], ['AS', item.f], ['AT', item.total]].forEach(function (pair) {
                const c = ws.getCell(pair[0] + rowNo);
                if (isPct) {
                    c.value = parseFloat(pair[1]) / 100;
                    c.numFmt = '0.00%';
                } else if (isFloat) {
                    c.value = parseFloat(pair[1]);
                    c.numFmt = '0.00';
                } else {
                    c.value = parseInt(pair[1], 10);
                    c.numFmt = '0';
                }
            });
        }

        writeSummaryRow(42, s.enrolment, false, false);
        writeSummaryRow(44, s.lateEnrolment, false, false);
        writeSummaryRow(48, s.registeredEnd, false, false);
        writeSummaryRow(50, s.pctEnrolment, true, false);
        writeSummaryRow(52, s.ada, false, true);
        writeSummaryRow(54, s.pctAttendance, true, false);
        writeSummaryRow(55, s.consecutive5, false, false);
        writeSummaryRow(56, s.droppedOut, false, false);
        writeSummaryRow(58, s.transferredOut, false, false);
        writeSummaryRow(60, s.transferredIn, false, false);

        // Remove extra sheet and rename
        wb.worksheets.slice().forEach(function (w) {
            if (w.id !== ws.id) wb.removeWorksheet(w.id);
        });
        ws.name = monthName || 'SF2';
        return wb;
    }

    // Dynamic copy fallback for classes exceeding standard template capacity (>16 males or >13 females)
    const src = ws;
    const merges = src.model.merges.slice();
    const dst = wb.addWorksheet('SF2_TMP', {
        pageSetup: clone(src.pageSetup),
        views: clone(src.views),
        properties: clone(src.properties)
    });
    for (let c = 1; c <= LAST_COL; c++) {
        const sc = src.getColumn(c);
        const dc = dst.getColumn(c);
        if (sc.width !== undefined) dc.width = sc.width;
        if (sc.hidden) dc.hidden = true;
    }

    for (let r = 1; r <= T.headerEnd; r++) copyRow(src, dst, r, r, merges, true);
    dst.getCell('M3').value = reportData.schoolYear;
    dst.getCell('AA3').value = monthName;

    DAY_COLS.forEach(function (col, i) {
        const sd = schoolDays[i];
        dst.getCell(col + '6').value = sd ? sd.day : null;
        dst.getCell(col + '7').value = sd ? sd.label : null;
    });

    let row = T.headerEnd + 1;

    function writeLearnerGroup(learners, groupTotals, protoRow, totalRow, label) {
        const rowsNeeded = Math.max(learners.length, 1);

        for (let i = 0; i < rowsNeeded; i++, row++) {
            copyRow(src, dst, protoRow, row, merges, false);
            const st = learners[i];
            if (!st) continue;
            const r = dst.getRow(row);
            r.getCell('A').value = st.no;
            r.getCell('C').value = st.name;

            schoolDays.forEach(function (sd, idx) {
                if (!sd.isClassDay) return;
                const cell = r.getCell(DAY_COLS[idx]);
                const dayAtt = st.attendance[sd.day];
                applyAttendanceCell(cell, dayAtt);
            });

            r.getCell('AM').value = st.absentCount;
            r.getCell('AO').value = st.presentCount;
            if (st.remarks) r.getCell('AQ').value = st.remarks;
        }

        copyRow(src, dst, totalRow, row, merges, true);
        const tr = dst.getRow(row);
        tr.getCell('A').value = groupTotals.count;
        tr.getCell('C').value = label;
        schoolDays.forEach(function (sd, idx) {
            if (sd.isClassDay) tr.getCell(DAY_COLS[idx]).value = groupTotals.perDay[idx];
        });
        tr.getCell('AM').value = groupTotals.absent;
        tr.getCell('AO').value = groupTotals.present;
        row++;
    }

    writeLearnerGroup(reportData.male, reportData.maleTotals, T.maleProto, T.maleTotal, '<=== MALE | TOTAL Per Day ===>');
    writeLearnerGroup(reportData.female, reportData.femaleTotals, T.femaleProto, T.femaleTotal, '<=== FEMALE | TOTAL Per Day ===>');

    copyRow(src, dst, T.combined, row, merges, true);
    const cr = dst.getRow(row);
    cr.getCell('A').value = reportData.combinedTotals.count;
    schoolDays.forEach(function (sd, idx) {
        if (sd.isClassDay) cr.getCell(DAY_COLS[idx]).value = reportData.combinedTotals.perDay[idx];
    });
    cr.getCell('AM').value = reportData.combinedTotals.absent;
    cr.getCell('AO').value = reportData.combinedTotals.present;
    row++;

    const off = row - T.footerStart;
    for (let r = T.footerStart; r <= T.footerEnd; r++) copyRow(src, dst, r, r + off, merges, true);
    const at = function (ref) { const p = splitRef(ref); return dst.getCell(p.col + (p.row + off)); };

    const days = reportData.classDaysCount;
    at('AM40').value = 'Month : ' + monthName;
    at('AP40').value = 'No. of Days of Classes: ' + days;

    const s = reportData.summary;
    function writeSummaryRow(rowNo, item, isPct, isFloat) {
        [['AR', item.m], ['AS', item.f], ['AT', item.total]].forEach(function (pair) {
            const c = at(pair[0] + rowNo);
            if (isPct) { c.value = parseFloat(pair[1]) / 100; c.numFmt = '0.00%'; }
            else if (isFloat) { c.value = parseFloat(pair[1]); c.numFmt = '0.00'; }
            else { c.value = parseInt(pair[1], 10); c.numFmt = '0'; }
        });
    }

    writeSummaryRow(42, s.enrolment, false, false);
    writeSummaryRow(44, s.lateEnrolment, false, false);
    writeSummaryRow(48, s.registeredEnd, false, false);
    writeSummaryRow(50, s.pctEnrolment, true, false);
    writeSummaryRow(52, s.ada, false, true);
    writeSummaryRow(54, s.pctAttendance, true, false);
    writeSummaryRow(55, s.consecutive5, false, false);
    writeSummaryRow(56, s.droppedOut, false, false);
    writeSummaryRow(58, s.transferredOut, false, false);
    writeSummaryRow(60, s.transferredIn, false, false);

    dst.pageSetup.printArea = 'A1:AU' + (T.footerEnd + off);
    wb.worksheets.slice().forEach(function (w) { if (w.id !== dst.id) wb.removeWorksheet(w.id); });
    dst.name = monthName || 'SF2';
    return wb;
}

module.exports = {
    buildSF2Workbook,
    computeSF2ReportData,
    computeSF2Days
};
