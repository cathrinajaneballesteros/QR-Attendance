import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { 
  PageTitle, 
  Card, 
  SectionCard, 
  StatCard, 
  DataTable, 
  StatusBadge, 
  Button 
} from '../components/ui';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  ShieldAlert, 
  Save, 
  RefreshCw, 
  Sliders, 
  UserPlus, 
  CheckCircle2,
  AlertCircle,
  History,
  GraduationCap,
  KeyRound
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

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total_students: 0, present_today: 0, attendance_rate: 0, total_teachers: 0 });
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [progressData, setProgressData] = useState({});
  const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, usersRes, progRes] = await Promise.all([
        apiFetch('/api/attendance/summary'),
        apiFetch('/api/auth/users'),
        apiFetch('/api/sf2/progress?school_year=2026-2027')
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setStats(prev => ({
          ...prev,
          total_students: sumData.total_students || 0,
          present_today: sumData.present_today || 0,
          attendance_rate: sumData.attendance_rate || 0
        }));
      }

      if (usersRes.ok) {
        const users = await usersRes.json();
        const teacherList = users.filter(u => u.role === 'teacher');
        setTeachers(teacherList);
        setStats(prev => ({ ...prev, total_teachers: teacherList.length }));
      }

      if (progRes.ok) {
        const progData = await progRes.json();
        setProgressData(progData.progress || {});
      } else {
        // Fallback to local storage
        try {
          const savedLocal = localStorage.getItem('sf2_progress_data');
          if (savedLocal) setProgressData(JSON.parse(savedLocal));
        } catch {}
      }
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
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

  const handleSaveProgress = async () => {
    setSaving(true);
    setSaveStatus({ message: '', isError: false });

    // Always cache locally as well
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
        setSaveStatus({ message: 'SF2 Submission Progress saved successfully to database!', isError: false });
      } else {
        setSaveStatus({ message: 'Saved to local session.', isError: false });
      }
    } catch (err) {
      setSaveStatus({ message: 'Network error. Saved locally.', isError: false });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus({ message: '', isError: false }), 4000);
    }
  };

  // Calculate SF2 status summaries
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
    <div className="sres-admin-dashboard-page">
      {/* 1. Page Header with Tag and Navigation Actions */}
      <PageTitle
        title="School Administration Console"
        emoji="🛡️"
        tag="Sta. Rosa Elementary School • System Monitoring & DepEd SF2 Compliance"
        icon={ShieldAlert}
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link to="/admin/teachers" className="sres-btn sres-btn-primary sres-btn-sm">
              <UserPlus size={14} strokeWidth={1.8} />
              <span>Manage Teachers</span>
            </Link>
            <Link to="/admin/student-accounts" className="sres-btn sres-btn-secondary sres-btn-sm">
              <GraduationCap size={14} strokeWidth={1.8} />
              <span>Student Accounts</span>
            </Link>
            <Link to="/admin/history" className="sres-btn sres-btn-secondary sres-btn-sm">
              <History size={14} strokeWidth={1.8} />
              <span>Historical Data</span>
            </Link>
            <Link to="/admin/settings" className="sres-btn sres-btn-secondary sres-btn-sm">
              <Sliders size={14} strokeWidth={1.8} />
              <span>Settings &amp; SMS</span>
            </Link>
            <Link to="/admin/settings?tab=admin_credentials" className="sres-btn sres-btn-secondary sres-btn-sm">
              <KeyRound size={14} strokeWidth={1.8} />
              <span>Admin Credentials</span>
            </Link>
          </div>
        }
      />

      {/* Stats Counter Grid */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard
          label="Total Students"
          value={stats.total_students || 0}
          icon={Users}
          color="#C2185B"
          bgTint="#FDF2F6"
        />
        <StatCard
          label="Active Teachers"
          value={stats.total_teachers || 0}
          icon={UserCheck}
          color="#6366F1"
          bgTint="#EEF2FF"
        />
        <StatCard
          label="Present Today"
          value={stats.present_today || 0}
          icon={UserCheck}
          color="#10B981"
          bgTint="#ECFDF5"
        />
        <StatCard
          label="School Attendance Rate"
          value={`${stats.attendance_rate || 0}%`}
          icon={TrendingUp}
          color="#0284C7"
          bgTint="#E0F2FE"
        />
      </div>

      {/* SF2 Submission Progress Matrix Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <ShieldAlert size={20} />
              <span>SF2 Submission Progress — S.Y. 2026–2027</span>
            </h3>
            <p className="card-subtitle">
              Monitor monthly School Form 2 submissions from class advisers
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Adviser:</label>
            <select 
              className="form-select" 
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="all">All Class Advisers</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name || t.username}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend & Summary Counter Chips */}
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

        {/* Matrix Table */}
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Month</th>
                <th>Class Adviser</th>
                <th style={{ width: '160px' }}>SF2 Status</th>
                <th>Remarks / Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No teachers registered yet. Click "Manage Teachers" above to register advisers.
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
                            placeholder="Add submission notes..."
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
            onClick={handleSaveProgress}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save SF2 Progress'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
