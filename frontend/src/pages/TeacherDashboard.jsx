import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import LiveClock from '../components/LiveClock';
import StatCard from '../components/StatCard';
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp, 
  QrCode, 
  FileSpreadsheet, 
  MessageSquare, 
  RefreshCw,
  Clock,
  History,
  Building,
  Laptop,
  MapPin,
  Download
} from 'lucide-react';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ 
    total_students: 0, 
    present_today: 0, 
    absent_today: 0, 
    attendance_rate: 0,
    room: 'Room 101 - Grade 6 Great Geniuses',
    attendance_mode: 'onsite'
  });
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, recordsRes] = await Promise.all([
        apiFetch('/api/attendance/summary'),
        apiFetch('/api/attendance/today')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setTodayRecords(recordsData);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <LiveClock />

      <div className="card" style={{ background: 'var(--surface-gradient)', border: '1px solid var(--primary-border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                Welcome back, {user?.full_name || user?.username || 'Teacher'}! 👋
              </h2>
              {/* Room badge (Requirement 8) */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.76rem',
                fontWeight: 700
              }}>
                <Building size={13} />
                <span>{stats.room || 'Room 101 - Grade 6 Great Geniuses'}</span>
              </span>
              {/* Mode badge (Requirement 2) */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: stats.attendance_mode === 'flipped' ? '#e0f2fe' : '#dcfce7',
                color: stats.attendance_mode === 'flipped' ? '#0369a1' : '#15803d',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.76rem',
                fontWeight: 700
              }}>
                {stats.attendance_mode === 'flipped' ? <Laptop size={13} /> : <MapPin size={13} />}
                <span>{stats.attendance_mode === 'flipped' ? 'Online Mode' : 'Onsite Mode'}</span>
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Grade 6 - GREAT GENIUSES • Class Adviser: {user?.full_name || user?.username || 'Teacher'} • S.Y. 2026-2027
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={loadData} 
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Fresh Account Onboarding: Prompt to import Excel when roster is empty */}
      {stats.total_students === 0 && !loading && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(136, 14, 79, 0.05) 0%, rgba(194, 24, 91, 0.1) 100%)',
          border: '1.5px dashed var(--primary)',
          borderRadius: '16px',
          padding: '22px 24px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '680px' }}>
            <div style={{
              background: 'var(--primary)',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 10px rgba(136, 14, 79, 0.25)'
            }}>
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 5px 0' }}>
                Setup Your Class Roster: Import from Excel
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Your teacher account currently has no student records. Import your DepEd SF2 Excel file (such as <code>add learner.xls</code> on sheet <code>MARCH</code>) to automatically register your student names and generate attendance QR codes.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link to="/students?import=true" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={16} />
              <span>Import Excel Roster</span>
            </Link>
            <Link to="/students" className="btn btn-secondary">
              <span>View Learners</span>
            </Link>
          </div>
        </div>
      )}

      {/* Stats Counter Grid */}
      <div className="stats-grid">
        <StatCard
          label="Total Learners"
          value={stats.total_students || 0}
          icon={<Users size={24} />}
          color="#880e4f"
        />
        <StatCard
          label="Present Today"
          value={stats.present_today || 0}
          icon={<UserCheck size={24} />}
          color="#16a34a"
        />
        <StatCard
          label="Absent Today"
          value={stats.absent_today || 0}
          icon={<UserX size={24} />}
          color="#dc2626"
        />
        <StatCard
          label="Attendance Rate"
          value={`${stats.attendance_rate || 0}%`}
          icon={<TrendingUp size={24} />}
          color="#0284c7"
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginRight: '4px' }}>
            Quick Actions:
          </span>
          <Link to="/attendance" className="btn btn-primary btn-sm">
            <QrCode size={15} />
            <span>Start QR Scanner</span>
          </Link>
          <Link to="/students?import=true" className="btn btn-secondary btn-sm" title="Import students from Excel (.xls / .xlsx)">
            <FileSpreadsheet size={15} />
            <span>Import Excel Roster</span>
          </Link>
          <Link to="/history" className="btn btn-secondary btn-sm">
            <History size={15} />
            <span>Historical Attendance</span>
          </Link>
          <Link to="/students" className="btn btn-secondary btn-sm">
            <Users size={15} />
            <span>Class Roster ({stats.total_students})</span>
          </Link>
          <Link to="/sf2-report" className="btn btn-secondary btn-sm">
            <FileSpreadsheet size={15} />
            <span>SF2 Report</span>
          </Link>
          <Link to="/sms-logs" className="btn btn-secondary btn-sm">
            <MessageSquare size={15} />
            <span>SMS Alerts</span>
          </Link>
        </div>
      </div>

      {/* Today's Attendance Table Feed */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <Clock size={20} />
              <span>Today's Recorded Attendance</span>
            </h3>
            <p className="card-subtitle">Real-time attendance check-ins for today • {stats.room}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge badge-submitted">
              {todayRecords.length} recorded
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => window.open(`/api/attendance/export?from=${new Date().toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`, '_blank')}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>No.</th>
                <th>Learner Name</th>
                <th style={{ width: '80px' }}>Sex</th>
                <th style={{ width: '130px' }}>Time In</th>
                <th style={{ width: '100px' }}>Status</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {todayRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No attendance records for today yet. Start scanning QR codes at the gate!
                  </td>
                </tr>
              ) : (
                todayRecords.map((r, i) => (
                  <tr key={r.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                    <td>
                      <span className={`badge ${r.sex === 'M' ? 'badge-not-started' : 'badge-pending'}`}>
                        {r.sex === 'M' ? 'Male' : 'Female'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {r.time_in}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'late' ? 'badge-late' : 'badge-present'}`}>
                        {r.status || 'Present'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {r.room || stats.room}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
