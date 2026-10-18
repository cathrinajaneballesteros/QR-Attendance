import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Loader2, 
  AlertCircle,
  Printer
} from 'lucide-react';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function SF2Report() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  });

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = async () => {
    // Skip partial/invalid values emitted while the month picker is being edited
    if (!selectedMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) return;
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/api/sf2/report?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const body = await response.json().catch(() => ({}));
        setError(body.error
          ? `Unable to generate the SF2 report: ${body.error}`
          : 'Unable to generate the SF2 report for this month. Please try again.');
      }
    } catch (err) {
      setError('Cannot reach the server. Check that the attendance service is running, then try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedMonth]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const response = await apiFetch(`/api/sf2/download?month=${selectedMonth}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const parts = selectedMonth.split('-');
      const mName = MONTH_NAMES[parseInt(parts[1], 10)] || 'Month';
      a.download = `SF2_Report_${mName}_${parts[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download Excel file. Ensure the backend server is running.');
    } finally {
      setDownloading(false);
    }
  };

  const schoolDays = reportData?.schoolDays || [];
  const monthTitle = reportData ? `${reportData.monthName} ${reportData.year}` : selectedMonth;
  const schoolInfo = reportData?.schoolInfo || {
    schoolName: 'Sta. Rosa ES',
    schoolId: '102056',
    gradeLevel: 'Grade 6',
    section: 'GREAT GENIUSES',
    schoolYear: '2026 - 2027',
    adviser: 'TIFANNY MARTIN ARAGON',
    principal: 'MC RIZ TEMPLETON BUEN'
  };

  return (
    <div className="sf2-page-container">
      {/* Top Toolbar Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title">
              <FileSpreadsheet size={22} style={{ color: '#15803d' }} />
              <span>School Form 2 (SF2) Daily Attendance Report</span>
            </h2>
            <p className="card-subtitle">
              Official DepEd Learner Attendance and Absenteeism Profile
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} style={{ color: 'var(--primary)' }} />
              <input
                type="month"
                className="form-input"
                style={{ padding: '7px 12px', fontSize: '0.85rem', width: 'auto' }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <button className="btn btn-secondary btn-sm" onClick={loadReport} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <span>Refresh</span>}
            </button>

            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleDownloadExcel} 
              disabled={downloading}
              style={{ 
                background: 'linear-gradient(135deg, #15803d, #166534)',
                boxShadow: '0 2px 8px rgba(21, 128, 61, 0.3)'
              }}
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{downloading ? 'Generating Excel...' : 'Download .xlsx'}</span>
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => window.print()}
              title="Print SF2 Report"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '12px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* DepEd SF2 Legend */}
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          marginTop: '12px',
          padding: '8px 14px',
          background: '#f8fafc',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.78rem',
          flexWrap: 'wrap',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontWeight: 700, color: '#475569' }}>Legend:</span>
          
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              display: 'inline-block', width: '20px', height: '20px', 
              background: '#ffffff', border: '1.5px solid #000000', borderRadius: '2px' 
            }}></span>
            <span><strong>Present</strong> (Empty box / Blank)</span>
          </span>


          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              display: 'inline-block', width: '20px', height: '20px', 
              background: '#ffffff', border: '1.5px solid #000000', borderRadius: '2px', overflow: 'hidden'
            }}>
              <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', display: 'block' }}>
                <line x1="2" y1="22" x2="22" y2="2" stroke="#000000" strokeWidth="1.6" />
                <line x1="2" y1="2" x2="12" y2="12" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span><strong>Absent in Morning</strong> (Upper diagonal line)</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              display: 'inline-block', width: '20px', height: '20px', 
              background: '#ffffff', border: '1.5px solid #000000', borderRadius: '2px', overflow: 'hidden'
            }}>
              <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', display: 'block' }}>
                <line x1="2" y1="22" x2="22" y2="2" stroke="#000000" strokeWidth="1.6" />
                <line x1="12" y1="12" x2="22" y2="22" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span><strong>Absent in Afternoon</strong> (Lower diagonal line)</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              display: 'inline-block', width: '20px', height: '20px', 
              background: '#ffffff', border: '1.5px solid #000000', borderRadius: '2px', overflow: 'hidden'
            }}>
              <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', display: 'block' }}>
                <line x1="3" y1="21" x2="21" y2="3" stroke="#000000" strokeWidth="1.6" />
                <line x1="3" y1="3" x2="21" y2="21" stroke="#000000" strokeWidth="1.6" />
              </svg>
            </span>
            <span><strong>Whole Day Absent</strong> ("X")</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
            <span style={{ 
              display: 'inline-block', width: '20px', height: '20px', 
              background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '2px', textAlign: 'center', lineHeight: '20px' 
            }}>-</span>
            <span>Unscheduled / No Class</span>
          </span>
        </div>
      </div>

      {/* Main DepEd SF2 Sheet Preview Container */}
      <div className="card" style={{ padding: '20px', background: '#ffffff', border: '1px solid #cbd5e1' }}>
        
        {/* DepEd SF2 Official Header Table */}
        <div style={{ marginBottom: '16px', border: '2px solid #000000', padding: '12px 16px', background: '#ffffff' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h1 style={{ 
              fontSize: '1.05rem', 
              fontWeight: 800, 
              color: '#000000', 
              textTransform: 'uppercase', 
              margin: 0,
              letterSpacing: '0.02em'
            }}>
              School Form 2 (SF2) Daily Attendance Report of Learners
            </h1>
            <p style={{ 
              fontSize: '0.72rem', 
              color: '#334155', 
              fontStyle: 'italic', 
              margin: '2px 0 0' 
            }}>
              (This replaces Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)
            </p>
          </div>

          {/* Header Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '6px 16px',
            fontSize: '0.8rem',
            borderTop: '1px solid #000000',
            paddingTop: '8px',
            color: '#000000'
          }}>
            <div><strong>School ID:</strong> <span style={{ textDecoration: 'underline' }}>{schoolInfo.schoolId}</span></div>
            <div><strong>School Year:</strong> <span style={{ textDecoration: 'underline' }}>{schoolInfo.schoolYear}</span></div>
            <div><strong>Report for the Month of:</strong> <span style={{ textDecoration: 'underline', fontWeight: 800 }}>{monthTitle}</span></div>
            <div><strong>Name of School:</strong> <span style={{ textDecoration: 'underline' }}>{schoolInfo.schoolName}</span></div>
            <div><strong>Grade Level:</strong> <span style={{ textDecoration: 'underline' }}>{schoolInfo.gradeLevel}</span></div>
            <div><strong>Section:</strong> <span style={{ textDecoration: 'underline' }}>{schoolInfo.section}</span></div>
          </div>
        </div>

        {/* SF2 Main Attendance Table */}
        <div className="table-responsive" style={{ maxHeight: '650px', overflowX: 'auto', border: '2px solid #000000' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.72rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <thead>
              {/* Header Row 1 */}
              <tr style={{ background: '#f8fafc', color: '#000000', fontWeight: 800, textAlign: 'center' }}>
                <th rowSpan={3} style={headerCellStyle({ width: '38px', minWidth: '38px' })}>
                  No.
                </th>
                <th rowSpan={3} style={headerCellStyle({ minWidth: '220px', textAlign: 'left', paddingLeft: '8px' })}>
                  NAME<br />
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#475569' }}>
                    (Last Name, First Name, Middle Name)
                  </span>
                </th>
                <th colSpan={Math.max(schoolDays.length, 1)} style={headerCellStyle({ padding: '4px 2px', fontSize: '0.7rem' })}>
                  (1st row for date)
                </th>
                <th colSpan={2} style={headerCellStyle({ minWidth: '90px' })}>
                  Total for the Month
                </th>
                <th rowSpan={3} style={headerCellStyle({ minWidth: '160px', fontSize: '0.65rem', padding: '4px 6px' })}>
                  REMARKS<br />
                  <span style={{ fontSize: '0.58rem', fontWeight: 400, color: '#475569' }}>
                    (If DROPPED OUT, state reason. If TRANSFERRED IN/OUT, write name of School.)
                  </span>
                </th>
              </tr>

              {/* Header Row 2: Day numbers */}
              <tr style={{ background: '#ffffff', color: '#000000', fontWeight: 800, textAlign: 'center' }}>
                {schoolDays.length > 0 ? (
                  schoolDays.map((sd) => (
                    <th 
                      key={`day-${sd.day}`} 
                      style={headerCellStyle({ 
                        width: '26px', 
                        minWidth: '26px', 
                        padding: '3px 0',
                        background: sd.isClassDay ? '#e0f2fe' : '#ffffff',
                        color: sd.isClassDay ? '#0369a1' : '#000000'
                      })}
                      title={`Date: ${sd.date}${sd.isClassDay ? ' (Class held)' : ''}`}
                    >
                      {sd.day}
                    </th>
                  ))
                ) : (
                  <th style={headerCellStyle({})}>-</th>
                )}
                <th rowSpan={2} style={headerCellStyle({ width: '45px', background: '#f8fafc', color: '#000000' })}>
                  ABSENT
                </th>
                <th rowSpan={2} style={headerCellStyle({ width: '45px', background: '#f8fafc', color: '#000000' })}>
                  PRESENT
                </th>
              </tr>

              {/* Header Row 3: Weekdays */}
              <tr style={{ background: '#f8fafc', color: '#000000', fontWeight: 700, textAlign: 'center' }}>
                {schoolDays.length > 0 ? (
                  schoolDays.map((sd) => (
                    <th 
                      key={`dow-${sd.day}`} 
                      style={headerCellStyle({ 
                        width: '26px', 
                        minWidth: '26px', 
                        padding: '3px 0',
                        fontSize: '0.65rem'
                      })}
                    >
                      {sd.label}
                    </th>
                  ))
                ) : (
                  <th style={headerCellStyle({})}>-</th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={schoolDays.length + 5} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                    <Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 10px', color: '#15803d' }} />
                    <p style={{ fontWeight: 600 }}>Loading official SF2 attendance data...</p>
                  </td>
                </tr>
              ) : !reportData ? (
                <tr>
                  <td colSpan={schoolDays.length + 5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No report loaded for the selected month.
                  </td>
                </tr>
              ) : (
                <>
                  {/* ================= MALE LEARNERS ================= */}
                  {reportData.male?.map((st) => (
                    <tr key={`male-${st.id}`} style={{ background: '#ffffff' }}>
                      <td style={bodyCellStyle({ textAlign: 'center', fontWeight: 600 })}>{st.no}</td>
                      <td style={bodyCellStyle({ textAlign: 'left', fontWeight: 700, paddingLeft: '8px' })}>
                        {st.name}
                      </td>
                      {schoolDays.map((sd) => {
                        const dayAtt = st.attendance?.[sd.day];
                        return renderAttendanceCell(dayAtt, sd, st.name);
                      })}
                      <td style={bodyCellStyle({ 
                        textAlign: 'center', 
                        fontWeight: 800, 
                        color: st.absentCount > 0 ? '#b91c1c' : '#000000'
                      })}>
                        {st.absentCount}
                      </td>
                      <td style={bodyCellStyle({ 
                        textAlign: 'center', 
                        fontWeight: 800, 
                        color: '#000000'
                      })}>
                        {st.presentCount}
                      </td>
                      <td style={bodyCellStyle({ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 700 })}>
                        {st.remarks}
                      </td>
                    </tr>
                  ))}

                  {/* MALE TOTAL PER DAY ROW */}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #000000' }}>
                    <td style={bodyCellStyle({ textAlign: 'center' })}>
                      {reportData.maleTotals?.count || reportData.male?.length || 0}
                    </td>
                    <td style={bodyCellStyle({ textAlign: 'center', letterSpacing: '0.04em' })}>
                      &lt;=== MALE | TOTAL Per Day ===&gt;
                    </td>
                    {schoolDays.map((sd, idx) => (
                      <td 
                        key={`male-tot-${sd.day}`} 
                        style={bodyCellStyle({ 
                          textAlign: 'center', 
                          fontWeight: 800,
                          background: sd.isClassDay ? '#e2e8f0' : 'transparent'
                        })}
                      >
                        {sd.isClassDay ? (reportData.maleTotals?.perDay?.[idx] ?? 0) : ''}
                      </td>
                    ))}
                    <td style={bodyCellStyle({ textAlign: 'center', color: '#000000' })}>
                      {reportData.maleTotals?.absent ?? 0}
                    </td>
                    <td style={bodyCellStyle({ textAlign: 'center', color: '#000000' })}>
                      {reportData.maleTotals?.present ?? 0}
                    </td>
                    <td style={bodyCellStyle({})}></td>
                  </tr>

                  {/* ================= FEMALE LEARNERS ================= */}
                  {reportData.female?.map((st) => (
                    <tr key={`female-${st.id}`} style={{ background: '#ffffff' }}>
                      <td style={bodyCellStyle({ textAlign: 'center', fontWeight: 600 })}>{st.no}</td>
                      <td style={bodyCellStyle({ textAlign: 'left', fontWeight: 700, paddingLeft: '8px' })}>
                        {st.name}
                      </td>
                      {schoolDays.map((sd) => {
                        const dayAtt = st.attendance?.[sd.day];
                        return renderAttendanceCell(dayAtt, sd, st.name);
                      })}
                      <td style={bodyCellStyle({ 
                        textAlign: 'center', 
                        fontWeight: 800, 
                        color: st.absentCount > 0 ? '#b91c1c' : '#000000'
                      })}>
                        {st.absentCount}
                      </td>
                      <td style={bodyCellStyle({ 
                        textAlign: 'center', 
                        fontWeight: 800, 
                        color: '#000000'
                      })}>
                        {st.presentCount}
                      </td>
                      <td style={bodyCellStyle({ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 700 })}>
                        {st.remarks}
                      </td>
                    </tr>
                  ))}

                  {/* FEMALE TOTAL PER DAY ROW */}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #000000' }}>
                    <td style={bodyCellStyle({ textAlign: 'center' })}>
                      {reportData.femaleTotals?.count || reportData.female?.length || 0}
                    </td>
                    <td style={bodyCellStyle({ textAlign: 'center', letterSpacing: '0.04em' })}>
                      &lt;=== FEMALE | TOTAL Per Day ===&gt;
                    </td>
                    {schoolDays.map((sd, idx) => (
                      <td 
                        key={`female-tot-${sd.day}`} 
                        style={bodyCellStyle({ 
                          textAlign: 'center', 
                          fontWeight: 800,
                          background: sd.isClassDay ? '#e2e8f0' : 'transparent'
                        })}
                      >
                        {sd.isClassDay ? (reportData.femaleTotals?.perDay?.[idx] ?? 0) : ''}
                      </td>
                    ))}
                    <td style={bodyCellStyle({ textAlign: 'center', color: '#000000' })}>
                      {reportData.femaleTotals?.absent ?? 0}
                    </td>
                    <td style={bodyCellStyle({ textAlign: 'center', color: '#000000' })}>
                      {reportData.femaleTotals?.present ?? 0}
                    </td>
                    <td style={bodyCellStyle({})}></td>
                  </tr>

                  {/* ================= COMBINED TOTAL PER DAY ROW ================= */}
                  <tr style={{ 
                    background: '#e2e8f0', 
                    fontWeight: 900, 
                    borderTop: '2px solid #000000',
                    borderBottom: '2px solid #000000'
                  }}>
                    <td style={bodyCellStyle({ textAlign: 'center' })}>
                      {reportData.combinedTotals?.count ?? 0}
                    </td>
                    <td style={bodyCellStyle({ textAlign: 'center', letterSpacing: '0.05em' })}>
                      Combined TOTAL Per Day
                    </td>
                    {schoolDays.map((sd, idx) => (
                      <td 
                        key={`comb-tot-${sd.day}`} 
                        style={bodyCellStyle({ 
                          textAlign: 'center', 
                          fontWeight: 900,
                          background: sd.isClassDay ? '#cbd5e1' : 'transparent'
                        })}
                      >
                        {sd.isClassDay ? (reportData.combinedTotals?.perDay?.[idx] ?? 0) : ''}
                      </td>
                    ))}
                    <td style={bodyCellStyle({ textAlign: 'center', color: '#000000', fontWeight: 900 })}>
                      {reportData.combinedTotals?.absent ?? 0}
                    </td>
                    <td style={bodyCellStyle({ textAlign: 'center', color: '#000000', fontWeight: 900 })}>
                      {reportData.combinedTotals?.present ?? 0}
                    </td>
                    <td style={bodyCellStyle({})}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* DepEd SF2 Bottom Summary & Guidelines Section (Matching Excel Format) */}
        {reportData && (
          <div className="responsive-two-col" style={{ 
            marginTop: '20px', 
            gap: '16px',
            color: '#000000',
            fontSize: '0.74rem'
          }}>
            
            {/* 1. GUIDELINES PANEL */}
            <div style={{ border: '1px solid #000000', padding: '12px', background: '#fafafa' }}>
              <div style={{ fontWeight: 800, borderBottom: '1px solid #000000', paddingBottom: '4px', marginBottom: '8px' }}>
                GUIDELINES:
              </div>
              <ol style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.45, color: '#1e293b' }}>
                <li>The attendance shall be accomplished daily. Refer to the codes for checking learners' attendance.</li>
                <li>Dates shall be written in the columns after Learner's Name.</li>
                <li>
                  To compute the following:
                  <div style={{ margin: '4px 0', padding: '4px 8px', background: '#ffffff', border: '1px dashed #cbd5e1', fontSize: '0.7rem' }}>
                    <div><strong>a. % Enrolment</strong> = (Registered End / Enrolment 1st Friday) × 100</div>
                    <div><strong>b. Average Daily Attendance</strong> = Total Daily Attendance / No. of Class Days</div>
                    <div><strong>c. % Attendance for Month</strong> = (Average Daily Attendance / Registered End) × 100</div>
                  </div>
                </li>
                <li>Every end of the month, the class adviser will submit this form to the principal for recording into School Form 4.</li>
                <li>The adviser will provide necessary interventions including home visitation to learners absent for 5 consecutive days or at risk of dropping out.</li>
                <li>Attendance performance of learners will be reflected in Form 137 and Form 138 every grading period.</li>
              </ol>
            </div>

            {/* 2. CODES & REASONS FOR NLS PANEL */}
            <div style={{ border: '1px solid #000000', padding: '12px', background: '#fafafa' }}>
              <div style={{ fontWeight: 800, borderBottom: '1px solid #000000', paddingBottom: '4px', marginBottom: '8px' }}>
                1. CODES FOR CHECKING ATTENDANCE
              </div>
              <div style={{ marginBottom: '10px', lineHeight: 1.5, paddingLeft: '4px' }}>
                <div><strong>(blank)</strong> - Present (Empty box)</div>
                <div><strong>Upper Diagonal</strong> - Absent in Morning (AM Half-Day)</div>
                <div><strong>Lower Diagonal</strong> - Absent in Afternoon (PM Half-Day)</div>
                <div><strong>(X)</strong> - Whole Day Absent (AM &amp; PM Crossed)</div>
              </div>

              <div style={{ fontWeight: 800, borderBottom: '1px solid #000000', paddingBottom: '4px', marginBottom: '8px' }}>
                2. REASONS/CAUSES FOR NLS (No Longer in School)
              </div>
              <div style={{ fontSize: '0.68rem', lineHeight: 1.35, color: '#334155' }}>
                <div><strong>a. Domestic-Related:</strong> a.1 Siblings care, a.2 Early marriage/pregnancy, a.3 Parents' attitude, a.4 Family problems</div>
                <div><strong>b. Individual-Related:</strong> b.1 Illness, b.2 Overage, b.3 Death, b.4 Drug Abuse, b.5 Poor academics, b.6 Lack of interest, b.7 Malnutrition</div>
                <div><strong>c. School-Related:</strong> c.1 Teacher Factor, c.2 Physical condition, c.3 Peer influence</div>
                <div><strong>d. Geographic/Environmental:</strong> d.1 Distance, d.2 Armed conflict, d.3 Calamities</div>
                <div><strong>e. Financial:</strong> e.1 Child labor/work</div>
                <div><strong>f. Others</strong> (Specify)</div>
              </div>
            </div>

            {/* 3. OFFICIAL SUMMARY TABLE */}
            <div style={{ border: '1px solid #000000', padding: '12px', background: '#ffffff' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 800, 
                borderBottom: '1px solid #000000', 
                paddingBottom: '4px', 
                marginBottom: '8px' 
              }}>
                <span>Month: {reportData.monthName}</span>
                <span>No. of Days of Classes: {reportData.classDaysCount}</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'center', fontWeight: 800 }}>
                    <th style={{ border: '1px solid #000000', padding: '4px', textAlign: 'left' }}>Summary</th>
                    <th style={{ border: '1px solid #000000', padding: '4px', width: '38px' }}>M</th>
                    <th style={{ border: '1px solid #000000', padding: '4px', width: '38px' }}>F</th>
                    <th style={{ border: '1px solid #000000', padding: '4px', width: '48px' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {renderSummaryRow('* Enrolment as of (1st Friday of June)', reportData.summary?.enrolment)}
                  {renderSummaryRow('Late enrolment during month', reportData.summary?.lateEnrolment)}
                  {renderSummaryRow('Registered Learners as of end of month', reportData.summary?.registeredEnd)}
                  {renderSummaryRow('Percentage of Enrolment as of end of month', reportData.summary?.pctEnrolment)}
                  {renderSummaryRow('Average Daily Attendance', reportData.summary?.ada)}
                  {renderSummaryRow('Percentage of Attendance for the month', reportData.summary?.pctAttendance)}
                  {renderSummaryRow('Number of students absent for 5 consecutive days', reportData.summary?.consecutive5)}
                  {renderSummaryRow('Dropped out', reportData.summary?.droppedOut)}
                  {renderSummaryRow('Transferred out', reportData.summary?.transferredOut)}
                  {renderSummaryRow('Transferred in', reportData.summary?.transferredIn)}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* DepEd Signatures Section */}
        {reportData && (
          <div style={{ 
            marginTop: '24px', 
            borderTop: '2px solid #000000', 
            paddingTop: '16px',
            color: '#000000'
          }}>
            <p style={{ fontSize: '0.75rem', fontStyle: 'italic', marginBottom: '16px' }}>
              I certify that this is a true and correct report.
            </p>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-around', 
              flexWrap: 'wrap', 
              gap: '24px',
              textAlign: 'center'
            }}>
              <div style={{ minWidth: '240px' }}>
                <div style={{ 
                  fontWeight: 800, 
                  fontSize: '0.88rem', 
                  borderBottom: '1px solid #000000', 
                  paddingBottom: '2px',
                  textTransform: 'uppercase'
                }}>
                  {schoolInfo.adviser}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>
                  (Signature of Adviser over Printed Name)
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
                  Generated thru LIS
                </div>
              </div>

              <div style={{ minWidth: '240px' }}>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '8px' }}>
                  Attested by:
                </div>
                <div style={{ 
                  fontWeight: 800, 
                  fontSize: '0.88rem', 
                  borderBottom: '1px solid #000000', 
                  paddingBottom: '2px',
                  textTransform: 'uppercase'
                }}>
                  {schoolInfo.principal}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>
                  (Signature of School Head over Printed Name)
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/** Render DepEd SF2 attendance cell (Empty=Present, Upper Diagonal=AM Absent, Lower Diagonal=PM Absent, X=Whole Day Absent) */
function renderAttendanceCell(dayAtt, sd, studentName) {
  if (!sd.isClassDay) {
    return (
      <td 
        key={`cell-${sd.day}`} 
        style={bodyCellStyle({ 
          textAlign: 'center', 
          background: '#ffffff',
          color: '#cbd5e1',
          padding: 0,
          height: '24px'
        })}
        title={`No attendance scheduled for ${sd.date}`}
      >
        -
      </td>
    );
  }

  // Absent in Morning (AM half-day absent: dividing diagonal + upper diagonal stroke)
  if (dayAtt?.isMorningAbsent) {
    return (
      <td 
        key={`cell-${sd.day}`} 
        style={bodyCellStyle({ 
          textAlign: 'center', 
          background: '#ffffff',
          border: '1px solid #000000',
          padding: 0,
          height: '24px'
        })}
        title={`${studentName}: Absent in Morning (AM Half-Day) on ${sd.date}`}
      >
        <svg viewBox="0 0 24 24" style={{ width: '100%', height: '22px', display: 'block', margin: '0 auto' }}>
          {/* Dividing diagonal: bottom-left to top-right */}
          <line x1="2" y1="22" x2="22" y2="2" stroke="#000000" strokeWidth="1.5" />
          {/* Upper diagonal stroke: top-left to center */}
          <line x1="2" y1="2" x2="12" y2="12" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </td>
    );
  }

  // Absent in Afternoon (PM half-day absent: dividing diagonal + lower diagonal stroke)
  if (dayAtt?.isAfternoonAbsent) {
    return (
      <td 
        key={`cell-${sd.day}`} 
        style={bodyCellStyle({ 
          textAlign: 'center', 
          background: '#ffffff',
          border: '1px solid #000000',
          padding: 0,
          height: '24px'
        })}
        title={`${studentName}: Absent in Afternoon (PM Half-Day) on ${sd.date}`}
      >
        <svg viewBox="0 0 24 24" style={{ width: '100%', height: '22px', display: 'block', margin: '0 auto' }}>
          {/* Dividing diagonal: bottom-left to top-right */}
          <line x1="2" y1="22" x2="22" y2="2" stroke="#000000" strokeWidth="1.5" />
          {/* Lower diagonal stroke: center to bottom-right */}
          <line x1="12" y1="12" x2="22" y2="22" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </td>
    );
  }

  // Whole day absent: crossed diagonal forming 'X'
  if (dayAtt?.isAbsent) {
    return (
      <td 
        key={`cell-${sd.day}`} 
        style={bodyCellStyle({ 
          textAlign: 'center', 
          background: '#ffffff',
          border: '1px solid #000000',
          padding: 0,
          height: '24px'
        })}
        title={`${studentName}: Whole Day Absent on ${sd.date} (X)`}
      >
        <svg viewBox="0 0 24 24" style={{ width: '100%', height: '22px', display: 'block', margin: '0 auto' }}>
          <line x1="3" y1="21" x2="21" y2="3" stroke="#000000" strokeWidth="1.6" />
          <line x1="3" y1="3" x2="21" y2="21" stroke="#000000" strokeWidth="1.6" />
        </svg>
      </td>
    );
  }

  // Present: Empty Box (blank)
  return (
    <td 
      key={`cell-${sd.day}`} 
      style={bodyCellStyle({ 
        textAlign: 'center', 
        background: '#ffffff',
        border: '1px solid #000000',
        padding: 0,
        height: '24px'
      })}
      title={`${studentName}: Present on ${sd.date} (Empty box)`}
    >
      {/* Empty box / Blank */}
    </td>
  );
}

function renderSummaryRow(label, values) {
  return (
    <tr>
      <td style={{ border: '1px solid #000000', padding: '3px 6px', fontSize: '0.7rem' }}>
        {label}
      </td>
      <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center', fontWeight: 600 }}>
        {values?.m ?? 0}
      </td>
      <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center', fontWeight: 600 }}>
        {values?.f ?? 0}
      </td>
      <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center', fontWeight: 800 }}>
        {values?.total ?? 0}
      </td>
    </tr>
  );
}

function headerCellStyle(extra = {}) {
  return {
    border: '1px solid #000000',
    padding: '3px 2px',
    verticalAlign: 'middle',
    fontSize: '0.72rem',
    ...extra
  };
}

function bodyCellStyle(extra = {}) {
  return {
    border: '1px solid #000000',
    padding: '3px 2px',
    verticalAlign: 'middle',
    fontSize: '0.72rem',
    ...extra
  };
}
