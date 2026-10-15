# DepEd SF2 Guidelines & Regulatory Specifications

### 1. Legal & Regulatory Context
DepEd School Form 2 (SF2) is mandated by DepEd Order No. 4, s. 2014 ("Adoption of the Modified School Forms (SFs) for Public Elementary and Secondary Schools"). It serves as the official legal basis for learner accounting, attendance auditing, and allocating school resources.

---

### 2. Class Day Determination
In `backend/services/sf2Excel.js`:
- A day in the current month is recognized as a **Class Day** if:
  1. It falls on a weekday (Monday through Friday).
  2. The date is $\le$ today's date.
  3. At least one attendance record exists for that date across the class roster.
- Weekend dates and future dates within the month are disabled or flagged as non-class days (`isClassDay: false`).

---

### 3. Half-Day Absence Rules
In public elementary education, a school day is split into two sessions:
1. **Morning Session (AM):** Flagged when student arrives after the late cutoff or is excused for morning appointments.
2. **Afternoon Session (PM):** Flagged when student is present in the morning but cuts classes or leaves early for the afternoon.

In the attendance database:
- `status = 'am_absent'`: Student receives 0.5 attendance credit, 0.5 absence count.
- `status = 'pm_absent'`: Student receives 0.5 attendance credit, 0.5 absence count.
- `status = 'present'` or `status = 'late'`: Full 1.0 attendance credit.
- `status = 'absent'`: 1.0 absence count, 0 attendance credit.

---

### 4. Excel Template Cell Mapping (AU / 47 Columns)
The Excel template (`sf2_template.xlsx`) defines 25 calendar column slots (5 weeks $\times$ 5 school days):
```text
Slot 1..25 Columns: F, H, I, J, K, L, N, O, P, Q, R, T, U, V, X, Z, AB, AC, AD, AE, AF, AG, AI, AJ, AK
```
Rows are dynamically allocated based on the number of enrolled males and females.
- Header ends at row 7.
- Male prototype row is copied for each male student.
- Male total subtotal row calculates totals.
- Female prototype row is copied for each female student.
- Female subtotal row calculates totals.
- Combined summary row aggregates totals.
- Footer instructions, legend, and certification signatures occupy the lower rows.
