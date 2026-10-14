import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import StatCard from '../components/StatCard';
import { 
  Calendar, 
  Search, 
  Download, 
  Users, 
  UserCheck, 
  Clock, 
  UserX, 
  TrendingUp, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  Building,
  RefreshCw,
  FileSpreadsheet,
  GraduationCap,
  Shield,
  ShieldAlert,
  UserPlus,
  Sliders,
  MessageSquare,
  ListTodo,
  Activity,
  Layers
} from 'lucide-react';

export default function AttendanceHistory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Common Loading State
  const [loading, setLoading] = useState(true);

  // ==========================================
  // ADMIN HISTORICAL DATA STATES
  // ==========================================
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminStats, setAdminStats] = useState({
    total_events: 0,
    teacher_mgmt: 0,
    sf2_reviews: 0,
    settings_updates: 0
  });
  const [adminCategory, setAdminCategory] = useState('ALL');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminDateFilter, setAdminDateFilter] = useState('ALL');
  const [adminActiveTab, setAdminActiveTab] = useState('activity'); // 'activity' | 'attendance'
  const [adminAttendanceRecords, setAdminAttendanceRecords] = useState([]);

  // ==========================================
  // TEACHER HISTORICAL DATA STATES
  // ==========================================
  const [teacherHistoryData, setTeacherHistoryData] = useState({ records: [], dates_summary: [], total_enrolled: 0 });
  const [teacherLogs, setTeacherLogs] = useState([]);
  const [teacherStats, setTeacherStats] = useState({ total_events: 0, attendance_records: 0, sms_alerts: 0, sf2_updates: 0 });
  const [students, setStudents] = useState([]);
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [teacherActiveTab, setTeacherActiveTab] = useState('attendance'); // 'attendance' | 'activity'
  const [studentModalData, setStudentModalData] = useState(null);

  // Load Admin Data (Only what's happening on admin side)
  const loadAdminHistory = async () => {
    setLoading(true);
    try {
      const [histRes, attRes] = await Promise.all([
        apiFetch('/api/history?role=admin'),
        apiFetch('/api/attendance/history?source=admin')
      ]);

      if (histRes.ok) {
        const data = await histRes.json();
        setAdminLogs(data.logs || []);
        if (data.stats) setAdminStats(data.stats);
      }

      if (attRes.ok) {
        const attData = await attRes.json();
        setAdminAttendanceRecords(attData.records || []);
      }
    } catch (err) {
      console.error('Failed to load admin historical data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Teacher Data (Only updates on teacher side)
  const loadTeacherHistory = async () => {
    setLoading(true);
    try {
      const [histRes, studRes, logRes] = await Promise.all([
        apiFetch('/api/attendance/history?source=teacher'),
        apiFetch('/api/students'),
        apiFetch('/api/history?role=teacher')
      ]);

      if (histRes.ok) {
        const data = await histRes.json();
        setTeacherHistoryData(data);
      }
      if (studRes.ok) {
        const studData = await studRes.json();
        setStudents(studData);
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setTeacherLogs(logData.logs || []);
        if (logData.stats) setTeacherStats(logData.stats);
      }
    } catch (err) {
      console.error('Failed to load teacher historical data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminHistory();
    } else {
      loadTeacherHistory();
    }
  }, [isAdmin]);

  // Handle student profile timeline
  const handleStudentClick = async (studentId) => {
    try {
      const res = await apiFetch(`/api/attendance/history/student/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setStudentModalData(data);
      }
    } catch (e) {
      console.error('Failed to fetch student timeline', e);
    }
  };

  // Export handlers
  const handleExportAdminCSV = () => {
    window.open('/api/history/export?role=admin', '_blank');
  };

  const handleExportTeacherCSV = () => {
    const from = selectedDate === 'ALL' ? '2026-01-01' : selectedDate;
    const to = selectedDate === 'ALL' ? new Date().toISOString().split('T')[0] : selectedDate;
    window.open(`/api/attendance/export?from=${from}&to=${to}`, '_blank');
  };

  // ========================================================
  // FILTERING FOR ADMIN LOGS
  // ========================================================
  const filteredAdminLogs = adminLogs.filter(log => {
    const matchesCat = adminCategory === 'ALL' || log.action_type === adminCategory;
    const matchesSearch = !adminSearch.trim() ||
      (log.action_title && log.action_title.toLowerCase().includes(adminSearch.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(adminSearch.toLowerCase())) ||
      (log.target_name && log.target_name.toLowerCase().includes(adminSearch.toLowerCase())) ||
      (log.user_name && log.user_name.toLowerCase().includes(adminSearch.toLowerCase()));

    let matchesDate = true;
    if (adminDateFilter !== 'ALL' && log.created_at) {
      const logDate = log.created_at.split('T')[0] || log.created_at.split(' ')[0];
      const today = new Date().toISOString().split('T')[0];
      if (adminDateFilter === 'today') {
        matchesDate = logDate === today;
      } else if (adminDateFilter === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        matchesDate = logDate >= d.toISOString().split('T')[0];
      } else if (adminDateFilter === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        matchesDate = logDate >= d.toISOString().split('T')[0];
      }
    }

    return matchesCat && matchesSearch && matchesDate;
  });

  // ========================================================
  // FILTERING FOR TEACHER ATTENDANCE RECORDS
  // ========================================================
  const filteredTeacherRecords = (teacherHistoryData.records || []).filter(r => {
    const matchesDate = selectedDate === 'ALL' || r.date === selectedDate;
    const matchesStudent = selectedStudent === 'ALL' || String(r.student_id) === String(selectedStudent);
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSearch = !searchQuery.trim() || 
      (r.full_name && r.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.lrn && r.lrn.includes(searchQuery)) ||
      (r.room && r.room.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesDate && matchesStudent && matchesStatus && matchesSearch;
  });

  const totalEnrolled = teacherHistoryData.total_enrolled || students.length || 1;
  const uniqueDatesCount = new Set(filteredTeacherRecords.map(r => r.date)).size || 1;
  const totalPresent = filteredTeacherRecords.filter(r => r.status === 'present').length;
  const totalLate = filteredTeacherRecords.filter(r => r.status === 'late').length;
  const recordedCount = filteredTeacherRecords.length;
  const expectedTotal = selectedDate === 'ALL' ? (totalEnrolled * uniqueDatesCount) : totalEnrolled;
  const attendanceRate = expectedTotal ? Math.round((recordedCount / expectedTotal) * 100) : 0;

  // Helper badge for categories
  const getCategoryBadge = (type) => {
    switch (type) {
      case 'teacher_management':
        return { label: 'Faculty Management', bg: '#f3e8ff', text: '#7e22ce' };
      case 'sf2_update':
        return { label: 'SF2 Compliance Review', bg: '#dcfce7', text: '#15803d' };
      case 'settings_update':
        return { label: 'System Configuration', bg: '#e0f2fe', text: '#0369a1' };
      case 'attendance_record':
        return { label: 'Attendance Check-In', bg: '#fef3c7', text: '#b45309' };
      case 'sms_alert':
        return { label: 'SMS Notice', bg: '#fce7f3', text: '#be185d' };
      case 'student_update':
        return { label: 'Learner Profile', bg: '#ede9fe', text: '#6d28d9' };
      default:
        return { label: 'System Action', bg: '#f1f5f9', text: '#475569' };
    }
  };

  // ========================================================
  // RENDER: ADMIN VIEW
  // ========================================================
  if (isAdmin) {
    return (
      <div>
        {/* Admin Header Card */}
        <div className="card" style={{ background: 'var(--surface-gradient)', border: '1px solid var(--primary-border)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={26} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  Admin Historical Data & System Audit Trail
                </h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Exclusive historical logs of administrative updates, faculty management, SF2 compliance reviews, and system modifications on the Admin side.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={loadAdminHistory} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleExportAdminCSV}>
                <Download size={14} />
                <span>Export Admin History</span>
              </button>
            </div>
          </div>
        </div>

        {/* Admin Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <StatCard
            label="Total Admin Updates"
            value={adminStats.total_events || adminLogs.length}
            icon={<Shield size={22} />}
            color="#880e4f"
          />
          <StatCard
            label="Faculty Management"
            value={adminStats.teacher_mgmt || 0}
            icon={<UserCheck size={22} />}
            color="#7e22ce"
          />
          <StatCard
            label="SF2 Compliance Reviews"
            value={adminStats.sf2_reviews || 0}
            icon={<FileSpreadsheet size={22} />}
            color="#16a34a"
          />
          <StatCard
            label="System Configurations"
            value={adminStats.settings_updates || 0}
            icon={<Sliders size={22} />}
            color="#0284c7"
          />
        </div>

        {/* Admin Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setAdminActiveTab('activity')}
            className={`btn btn-sm ${adminActiveTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Activity size={14} />
            <span>Admin Updates & Events ({filteredAdminLogs.length})</span>
          </button>
          <button
            onClick={() => setAdminActiveTab('attendance')}
            className={`btn btn-sm ${adminActiveTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={14} />
            <span>Admin-Recorded Attendance ({adminAttendanceRecords.length})</span>
          </button>
        </div>

        {adminActiveTab === 'activity' ? (
          <>
            {/* Filter Controls for Admin Logs */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {/* Search Bar */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Search Admin Actions</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                      placeholder="Search title, target, details..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                    />
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Filter by Category</label>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.85rem' }}
                    value={adminCategory}
                    onChange={(e) => setAdminCategory(e.target.value)}
                  >
                    <option value="ALL">All Administrative Actions</option>
                    <option value="teacher_management">Faculty Management (Teachers)</option>
                    <option value="sf2_update">SF2 Compliance & Reviews</option>
                    <option value="settings_update">System Settings & Policies</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Time Horizon</label>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.85rem' }}
                    value={adminDateFilter}
                    onChange={(e) => setAdminDateFilter(e.target.value)}
                  >
                    <option value="ALL">All Recorded Time</option>
                    <option value="today">Today Only</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">Past 30 Days</option>
                  </select>
                </div>

                {/* Reset Filters */}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    onClick={() => {
                      setAdminSearch('');
                      setAdminCategory('ALL');
                      setAdminDateFilter('ALL');
                    }}
                  >
                    <Filter size={14} />
                    <span>Reset Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Historical Events Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary)' }}>
                  Administrative Action Log ({filteredAdminLogs.length} updates logged)
                </div>
                <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                  Scope: Admin Only
                </span>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>Date & Time</th>
                      <th style={{ width: '110px' }}>Admin User</th>
                      <th style={{ width: '180px' }}>Category</th>
                      <th>Action Title & Subject</th>
                      <th>Specific Details / Changes</th>
                      <th style={{ width: '100px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminLogs.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                          No administrative historical records match your current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredAdminLogs.map((log) => {
                        const badge = getCategoryBadge(log.action_type);
                        const formattedDate = log.created_at ? log.created_at.replace('T', ' ').substring(0, 19) : 'N/A';
                        return (
                          <tr key={log.id}>
                            <td style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {formattedDate}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem' }}>
                              @{log.user_name || 'admin'}
                            </td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.text,
                                display: 'inline-block'
                              }}>
                                {badge.label}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                {log.action_title}
                              </div>
                              {log.target_name && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Target: <strong>{log.target_name}</strong>
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {log.details || '—'}
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0'
                              }}>
                                Logged
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Admin-Recorded Attendance Tab */
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary)' }}>
                Attendance Recorded by Administrator ({adminAttendanceRecords.length} entries)
              </div>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Learner Name</th>
                    <th>Sex</th>
                    <th>Time In</th>
                    <th>Status</th>
                    <th>Classroom</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {adminAttendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No attendance entries have been recorded from the Admin side. Class advisers typically record attendance.
                      </td>
                    </tr>
                  ) : (
                    adminAttendanceRecords.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.date}</td>
                        <td style={{ fontWeight: 700 }}>{r.full_name}</td>
                        <td>{r.sex}</td>
                        <td>{r.time_in}</td>
                        <td>
                          <span className={`pill-badge ${r.status === 'present' ? 'badge-present' : 'badge-late'}`}>
                            {r.status === 'present' ? 'Present' : 'Late'}
                          </span>
                        </td>
                        <td>{r.room || 'Room 101'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.recorded_by}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // RENDER: TEACHER VIEW
  // ========================================================
  return (
    <div>
      {/* Teacher Header Card */}
      <div className="card" style={{ background: 'var(--surface-gradient)', border: '1px solid var(--primary-border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={24} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                Teacher Historical Attendance & Classroom Activity
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Historical attendance check-ins, scans, late arrivals, and classroom activity updates happening on the Teacher side.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={loadTeacherHistory} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleExportTeacherCSV}>
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Teacher Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard
          label={selectedDate === 'ALL' ? 'Total Logged Records' : 'Total Present Today'}
          value={recordedCount}
          icon={<UserCheck size={22} />}
          color="#16a34a"
        />
        <StatCard
          label="On-Time Arrivals"
          value={totalPresent}
          icon={<CheckCircle size={22} />}
          color="#0284c7"
        />
        <StatCard
          label="Late Arrivals"
          value={totalLate}
          icon={<Clock size={22} />}
          color="#d97706"
        />
        <StatCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          icon={<TrendingUp size={22} />}
          color="#880e4f"
        />
      </div>

      {/* Teacher Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setTeacherActiveTab('attendance')}
          className={`btn btn-sm ${teacherActiveTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <UserCheck size={14} />
          <span>Learner Attendance Records ({filteredTeacherRecords.length})</span>
        </button>
        <button
          onClick={() => setTeacherActiveTab('activity')}
          className={`btn btn-sm ${teacherActiveTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Activity size={14} />
          <span>Teacher Activity & Updates Log ({teacherLogs.length})</span>
        </button>
      </div>

      {teacherActiveTab === 'attendance' ? (
        <>
          {/* Date Presets Timeline Strip */}
          {teacherHistoryData.dates_summary && teacherHistoryData.dates_summary.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                <span>Recorded School Days on Teacher Side (Click any day to filter):</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                <button
                  onClick={() => setSelectedDate('ALL')}
                  className={`btn btn-sm ${selectedDate === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flexShrink: 0, fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  All Days ({teacherHistoryData.dates_summary.length})
                </button>
                {teacherHistoryData.dates_summary.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`btn btn-sm ${selectedDate === d.date ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      flexShrink: 0,
                      fontSize: '0.75rem',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{d.date}</span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '10px',
                      background: selectedDate === d.date ? 'rgba(255,255,255,0.25)' : 'var(--primary-light)',
                      color: selectedDate === d.date ? '#fff' : 'var(--primary)',
                      fontWeight: 700,
                      fontSize: '0.7rem'
                    }}>
                      {d.rate}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Controls for Teacher Attendance */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {/* Search bar */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Search Learner or Room</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                    placeholder="Search by name, LRN, room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Student filter */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Filter by Learner</label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.85rem' }}
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                >
                  <option value="ALL">All Learners</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.sex})</option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Status</label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.85rem' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="present">Present (On-Time)</option>
                  <option value="late">Late</option>
                </select>
              </div>

              {/* Reset Filters button */}
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                  onClick={() => {
                    setSelectedDate('ALL');
                    setSelectedStudent('ALL');
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
                >
                  <Filter size={14} />
                  <span>Reset Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Teacher Attendance Records Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary)' }}>
                Teacher Attendance Records ({filteredTeacherRecords.length} entries found)
              </div>
              <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                Scope: Teacher Side Updates Only
              </span>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Learner Name</th>
                    <th>Sex</th>
                    <th>Time In</th>
                    <th>Status</th>
                    <th>Classroom / Room</th>
                    <th>Recorded By</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeacherRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No teacher-side attendance records match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTeacherRecords.map((r) => (
                      <tr key={`${r.id}-${r.date}`}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{r.date}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.full_name}</div>
                          {r.lrn && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>LRN: {r.lrn}</div>}
                        </td>
                        <td>
                          <span className={`pill-badge ${r.sex === 'M' ? 'badge-male' : 'badge-female'}`} style={{ fontSize: '0.72rem' }}>
                            {r.sex}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{r.time_in}</td>
                        <td>
                          <span className={`pill-badge ${r.status === 'present' ? 'badge-present' : 'badge-late'}`}>
                            {r.status === 'present' ? 'Present' : 'Late'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <Building size={13} style={{ color: 'var(--primary)' }} />
                            <span>{r.room || 'Room 101 - Grade 6'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.recorded_by || 'teacher'}</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                            onClick={() => handleStudentClick(r.student_id)}
                          >
                            <GraduationCap size={13} />
                            <span>Timeline</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Tab 2: Teacher Activity & Updates Feed */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary)' }}>
              Teacher Side Updates & Actions Feed ({teacherLogs.length} updates logged)
            </div>
            <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Scope: Teacher Side Actions
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Date & Time</th>
                  <th style={{ width: '120px' }}>Adviser / Teacher</th>
                  <th style={{ width: '180px' }}>Update Type</th>
                  <th>Action Title & Learner</th>
                  <th>Details</th>
                  <th style={{ width: '90px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {teacherLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No teacher updates logged yet.
                    </td>
                  </tr>
                ) : (
                  teacherLogs.map((log) => {
                    const badge = getCategoryBadge(log.action_type);
                    const formattedDate = log.created_at ? log.created_at.replace('T', ' ').substring(0, 19) : 'N/A';
                    return (
                      <tr key={log.id}>
                        <td style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {formattedDate}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem' }}>
                          @{log.user_name || 'teacher'}
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.text,
                            display: 'inline-block'
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {log.action_title}
                          </div>
                          {log.target_name && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Learner/Subject: <strong>{log.target_name}</strong>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {log.details || '—'}
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0'
                          }}>
                            Recorded
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Historical Timeline Modal */}
      {studentModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  {studentModalData.student?.full_name}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Student Attendance Timeline & Statistics • {studentModalData.student?.sex === 'M' ? 'Male' : 'Female'}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setStudentModalData(null)}
                style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>{studentModalData.present_count}</div>
                <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>Total Days</div>
              </div>
              <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706' }}>{studentModalData.late_count}</div>
                <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>Late Arrivals</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>{studentModalData.absent_count}</div>
                <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>Absences</div>
              </div>
              <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>{studentModalData.rate}%</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>Rate</div>
              </div>
            </div>

            {/* Records List */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '10px' }}>
              Recorded Dates (Teacher Side)
            </h4>
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Status</th>
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {studentModalData.records && studentModalData.records.length > 0 ? (
                    studentModalData.records.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.date}</td>
                        <td>{r.time_in}</td>
                        <td>
                          <span className={`pill-badge ${r.status === 'present' ? 'badge-present' : 'badge-late'}`}>
                            {r.status === 'present' ? 'Present' : 'Late'}
                          </span>
                        </td>
                        <td>{r.room || 'Room 101'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        No records found for this student.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setStudentModalData(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
