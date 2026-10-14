import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  ListTodo, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';

const MONTHS = [
  { name: 'June 2026', key: '2026-06' },
  { name: 'July 2026', key: '2026-07' },
  { name: 'August 2026', key: '2026-08' },
  { name: 'September 2026', key: '2026-09' },
  { name: 'October 2026', key: '2026-10' },
  { name: 'November 2026', key: '2026-11' },
  { name: 'December 2026', key: '2026-12' },
  { name: 'January 2027', key: '2027-01' },
  { name: 'February 2027', key: '2027-02' },
  { name: 'March 2027', key: '2027-03' }
];

export default function SF2Progress() {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [progressData, setProgressData] = useState({});
  const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, progRes] = await Promise.all([
        apiFetch('/api/auth/users'),
        apiFetch('/api/sf2/progress?school_year=2026-2027')
      ]);

      if (usersRes.ok) {
        const users = await usersRes.json();
        setTeachers(users.filter(u => u.role === 'teacher'));
      }

      if (progRes.ok) {
        const progData = await progRes.json();
        setProgressData(progData.progress || {});
      } else {
        try {
          const savedLocal = localStorage.getItem('sf2_progress_data');
          if (savedLocal) setProgressData(JSON.parse(savedLocal));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load SF2 progress:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = (key, value) => {
    setProgressData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), status: value }
    }));
  };

  const handleRemarksChange = (key, value) => {
    setProgressData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), remarks: value }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus({ message: '', isError: false });

    localStorage.setItem('sf2_progress_data', JSON.stringify(progressData));

    try {
      const response = await apiFetch('/api/sf2/progress', {
        method: 'POST',
        body: JSON.stringify({
          school_year: '2026-2027',
          progress: progressData
        })
      });

      if (response.ok) {
        setSaveStatus({ message: 'Progress saved successfully to database!', isError: false });
      } else {
        setSaveStatus({ message: 'Saved locally for your session.', isError: false });
      }
    } catch (err) {
      setSaveStatus({ message: 'Saved locally.', isError: false });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus({ message: '', isError: false }), 4000);
    }
  };

  const getCounts = () => {
    const counts = { not_started: 0, pending: 0, submitted: 0, approved: 0, rejected: 0 };
    const filteredTeachers = selectedTeacher === 'all' 
      ? teachers 
      : teachers.filter(t => String(t.id) === selectedTeacher);

    filteredTeachers.forEach(t => {
      MONTHS.forEach(m => {
        const key = `${t.id}_${m.key}`;
        const item = progressData[key];
        const status = item?.status || 'not_started';
        if (counts[status] !== undefined) counts[status]++;
      });
    });

    return counts;
  };

  const counts = getCounts();
  const filteredTeachers = selectedTeacher === 'all' 
    ? teachers 
    : teachers.filter(t => String(t.id) === selectedTeacher);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <ListTodo size={22} />
              <span>SF2 Submission Progress — S.Y. 2026–2027</span>
            </h2>
            <p className="card-subtitle">
              Track and update SF2 submission timeline per teacher
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Teacher:</label>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="all">All Teachers</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name || t.username}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Legend Chips */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#64748b' }}>{counts.not_started}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Not Started</div>
          </div>
          <div style={{ padding: '10px', background: '#fffbeb', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid #fef3c7' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>{counts.pending}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309' }}>Pending</div>
          </div>
          <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid #dcfce7' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>{counts.submitted}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d' }}>Submitted</div>
          </div>
          <div style={{ padding: '10px', background: '#ecfdf5', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>{counts.approved}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534' }}>Approved</div>
          </div>
          <div style={{ padding: '10px', background: '#fef2f2', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid #fee2e2' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b' }}>{counts.rejected}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#991b1b' }}>Rejected</div>
          </div>
        </div>

        {saveStatus.message && (
          <div className={`alert ${saveStatus.isError ? 'alert-error' : 'alert-success'}`}>
            {saveStatus.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{saveStatus.message}</span>
          </div>
        )}

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Month</th>
                <th>Class Adviser</th>
                <th style={{ width: '160px' }}>Submission Status</th>
                <th>Adviser Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No teachers found.
                  </td>
                </tr>
              ) : (
                filteredTeachers.flatMap(teacher => 
                  MONTHS.map(month => {
                    const key = `${teacher.id}_${month.key}`;
                    const saved = progressData[key] || {};
                    const status = saved.status || 'not_started';
                    const remarks = saved.remarks || '';

                    return (
                      <tr key={key}>
                        <td style={{ fontWeight: 700 }}>{month.name}</td>
                        <td style={{ fontWeight: 600 }}>{teacher.full_name || teacher.username}</td>
                        <td>
                          <select 
                            className="form-select"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            value={status}
                            onChange={(e) => handleStatusChange(key, e.target.value)}
                          >
                            <option value="not_started">⚪ Not Started</option>
                            <option value="pending">🟡 Pending</option>
                            <option value="submitted">🟢 Submitted</option>
                            <option value="approved">✅ Approved</option>
                            <option value="rejected">❌ Rejected</option>
                          </select>
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            placeholder="Add remarks..."
                            value={remarks}
                            onChange={(e) => handleRemarksChange(key, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Progress'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
