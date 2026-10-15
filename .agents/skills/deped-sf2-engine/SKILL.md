---
name: deped-sf2-engine
description: >-
  Use this skill when working on DepEd School Form 2 (SF2) monthly attendance calculations,
  report generation, Excel spreadsheet exports, attendance status classifications, or SARDO
  (5-consecutive-day absence) tracking.
---

# DepEd SF2 Engine Skill

This skill governs the generation, calculation, and formatting of the official **Department of Education (DepEd) School Form 2 (SF2): Daily Attendance Report of Learners**.

## When to Use This Skill
- When modifying attendance aggregation logic in `backend/routes/sf2.js` or `backend/services/sf2Excel.js`.
- When updating the frontend preview components in `frontend/src/pages/SF2Report.jsx` or `frontend/src/pages/SF2Progress.jsx`.
- When fixing issues with Excel generation via ExcelJS (`templates/sf2_template.xlsx`).
- When managing absence markings (Whole-day absent, AM half-day, PM half-day).

---

## Official DepEd Marking Standards

| Status | DepEd Symbol | Excel Representation | In-App Mark Code |
| :--- | :--- | :--- | :--- |
| **Present / On Time** | *Blank* | Cell value is empty string / null | `''` |
| **Late / AM Absent** | Upper diagonal stroke (left-bottom to right-top) | `diagonal: { up: true, style: 'thin' }` | `'AM_ABSENT'` |
| **Cutting / PM Absent** | Lower diagonal stroke (left-top to right-bottom) | `diagonal: { down: true, style: 'thin' }` | `'PM_ABSENT'` |
| **Whole Day Absent** | `X` | Standard uppercase letter `'X'` | `'X'` |

> [!CAUTION]
> **ExcelJS Shared Style Mutation Bug:**
> In ExcelJS, assigning `cell.border` directly mutates the workbook's shared style object. When applying diagonal borders for half-day absences, **ALWAYS clone `cell.style` first**:
> ```javascript
> const curBorder = (cell.style && cell.style.border) ? cell.style.border : {};
> cell.style = Object.assign({}, cell.style || {}, {
>     border: Object.assign({}, curBorder, { diagonal: { up: true, style: 'thin' } })
> });
> ```
> Failing to do this causes diagonal lines to corrupt all header cells and unaffected rows!

---

## Official DepEd Mathematical Formulas

All monthly summary statistics must adhere strictly to DepEd SF2 regulations:

1. **Roster Segregation & Ordering:**
   - Male learners are ALWAYS listed first, sorted alphabetically by Surname.
   - Female learners are listed second, sorted alphabetically by Surname.
   - Dropped learners (`enrollment_status = 'dropped'`) are kept at the bottom or marked with remarks `'DROPPED OUT'` / `'TRANSFERRED OUT'`.

2. **Registered Learners (End of the Month):**
   $$\text{Registered End} = \text{Enrolled Learners} - \text{Dropped Learners}$$

3. **Daily Attendance Count:**
   $$\text{Daily Attendance} = \text{Full Present (1.0)} + \text{Half-Day AM/PM Present (0.5)}$$

4. **Average Daily Attendance (ADA):**
   $$\text{ADA} = \frac{\sum \text{Daily Attendance for all class days}}{\text{Total Class Days in Month}}$$
   *(Calculated separately for Male, Female, and Combined Total)*

5. **Percentage of Attendance for the Month:**
   $$\text{Percentage of Attendance} = \left( \frac{\text{ADA}}{\text{Registered Learners (End of Month)}} \right) \times 100\%$$

6. **Consecutive 5-Day Absences (SARDO):**
   - Count learners who accumulated $\ge 5$ consecutive school days of absence without valid excuse.
   - Triggers warning banner on the teacher's dashboard and SF2 summary box for home visitation intervention.

---

## Verification Checklist
Before submitting changes to the SF2 module:
- [ ] Are male students listed first, followed by female students?
- [ ] Are present marks represented as blank cells in both preview and Excel?
- [ ] Do whole-day absences render as 'X'?
- [ ] Do half-day absences render with proper diagonal border orientations?
- [ ] Is `percentageOfAttendance` rounded to 2 decimal places with a `%` suffix?
- [ ] Does `GET /api/sf2/report?month=YYYY-MM` succeed for both admin and teacher roles?
