import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { playSuccessChime, playDuplicateChime, playWarningChime } from '../utils/sound';
import LiveClock from '../components/LiveClock';
import StatCard from '../components/StatCard';
import { 
  GraduationCap, 
  CheckCircle, 
  CheckCircle2,
  AlertCircle, 
  AlertTriangle,
  Lock, 
  MapPin, 
  Clock, 
  KeyRound, 
  History,
  UserX,
  TrendingUp,
  Calendar,
  Bell,
  BellRing,
  RefreshCw,
  Building,
  ShieldAlert,
  Sparkles,
  Search,
  MessageSquare,
  Check
} from 'lucide-react';

export default function StudentPortal() {
  const [profile, setProfile] = useState(null);
  const [today, setToday] = useState(null);
  const [stats, setStats] = useState({
    total_school_days: 0,
    on_time_count: 0,
    late_count: 0,
    absent_count: 0,
    present_count: 0,
    attendance_rate: 0,
    absence_threshold: 5,
    at_risk: false
  });
  const [settings, setSettings] = useState(null);
  const [notices, setNotices] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInAlert, setCheckInAlert] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Change Password state
  const [isDefaultPassword, setIsDefaultPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordAlert, setPasswordAlert] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/student-account/me');
      if (response.ok) {
        const data = await response.json();
        setProfile(data.student);
        setToday(data.today || null);
        setStats(data.stats || {
          total_school_days: 0,
          on_time_count: 0,
          late_count: 0,
          absent_count: 0,
          present_count: 0,
          attendance_rate: 0,
          absence_threshold: 5,
          at_risk: false
        });
        setSettings(data.settings || null);
        setRecords(data.records || []);
        setNotices(data.notices || []);
        setIsDefaultPassword(!!data.is_default_password);
      }
    } catch (err) {
      console.error('Error loading student profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds to keep live status in sync
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelfCheckIn = async () => {
    setCheckingIn(true);
    setCheckInAlert(null);

    const submitRecord = async (coords = {}) => {
      try {
        const response = await apiFetch('/api/attendance/self', {
          method: 'POST',
          body: JSON.stringify(coords)
        });

        const data = await response.json();
        if (response.ok) {
          if (data.duplicate) {
            playDuplicateChime();
            const disp = data.display_status || (data.status === 'present' ? 'On Time' : 'Late');
            setCheckInAlert({
              type: 'warning',
              message: `You were already checked in today at ${data.time_in} (Marked ${disp}).`
            });
          } else {
            const isLate = data.status === 'late';
            const disp = data.display_status || (isLate ? 'Late' : 'On Time');
            if (isLate) {
              playWarningChime();
              setCheckInAlert({
                type: 'warning',
                message: `⏰ Attendance Recorded: Marked LATE at ${data.time_in}. (Cutoff was ${settings?.late_after || '08:00'}).`
              });
            } else {
              playSuccessChime();
              setCheckInAlert({
                type: 'success',
                message: `🎉 Attendance Recorded: You are ON TIME! Marked at ${data.time_in}.`
              });
            }
          }
          await loadData();
        } else {
          setCheckInAlert({
            type: 'error',
            message: data.error || 'Failed to record attendance.'
          });
        }
      } catch (err) {
        setCheckInAlert({
          type: 'error',
          message: 'Network error checking in.'
        });
      } finally {
        setCheckingIn(false);
      }
    };

    // Check if GPS is required
    try {
      const settingsRes = await apiFetch('/api/settings');
      if (settingsRes.ok) {
        const setConfig = await settingsRes.json();
        if (setConfig.gps_enabled === '1' && setConfig.attendance_mode !== 'flipped') {
          if (!navigator.geolocation) {
            setCheckInAlert({ type: 'error', message: 'Browser does not support GPS geolocation.' });
            setCheckingIn(false);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => submitRecord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => {
              setCheckInAlert({ type: 'error', message: 'Location permission required to verify onsite attendance.' });
              setCheckingIn(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
          );
          return;
        }
      }
    } catch {}

    submitRecord({});
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 8) {
      setPasswordAlert({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordAlert({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setChangingPassword(true);
    setPasswordAlert(null);
    try {
      const response = await apiFetch('/api/student-account/change-password', {
        method: 'POST',
        body: JSON.stringify(passwordData)
      });

      const data = await response.json();
      if (response.ok) {
        setPasswordAlert({ type: 'success', message: 'Password changed successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setIsDefaultPassword(false);
      } else {
        setPasswordAlert({ type: 'error', message: data.error || 'Failed to change password.' });
      }
    } catch (err) {
      setPasswordAlert({ type: 'error', message: 'Network error changing password.' });
    } finally {
      setChangingPassword(false);
    }
  };

  // Filter records for table view
  const filteredRecords = records.filter(r => {
    if (statusFilter === 'ontime' && r.status !== 'ontime' && r.status !== 'present') return false;
    if (statusFilter === 'late' && r.status !== 'late') return false;
    if (statusFilter === 'absent' && r.status !== 'absent' && r.status !== 'am_absent' && r.status !== 'pm_absent') return false;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      const matchDate = (r.date || '').toLowerCase().includes(q);
      const matchStatus = (r.display_status || r.status || '').toLowerCase().includes(q);
      const matchRoom = (r.room || '').toLowerCase().includes(q);
      if (!matchDate && !matchStatus && !matchRoom) return false;
    }
    return true;
  });

  return (
    <div>
      <LiveClock />

      {/* Student Welcome Card */}
      <div className="card" style={{ background: 'var(--surface-gradient)', border: '1px solid var(--primary-border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 6px 16px rgba(136, 14, 79, 0.25)',
              flexShrink: 0
            }}>
              <GraduationCap size={30} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  {profile ? profile.full_name : 'Welcome, Learner!'}
                </h2>
                <span className="badge badge-submitted" style={{ fontSize: '0.74rem' }}>
                  Enrolled Learner
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                LRN: <strong style={{ color: 'var(--primary)' }}>{profile?.lrn || '109489150001'}</strong> • Grade 6 - GREAT GENIUSES • Sta. Rosa ES
              </p>
            </div>
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            title="Refresh dashboard data"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Sync Status</span>
          </button>
        </div>
      </div>

      {/* Default Password Security Warning */}
      {isDefaultPassword && (
        <div className="alert alert-warning" style={{
          marginBottom: '20px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1.5px solid #fde047',
          background: 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert size={28} color="#b45309" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#854d0e' }}>
                Default School Password In Use ('Password')
              </div>
              <div style={{ fontSize: '0.84rem', color: '#713f12', marginTop: '2px' }}>
                Your student account is currently set to the default standardized password (<strong>Password</strong>). We strongly encourage you to update your password now to keep your account secure.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const el = document.getElementById('security-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <KeyRound size={14} />
            <span>Change Password Now</span>
          </button>
        </div>
      )}

      {/* ========================================================
          CORE REQUIREMENT: TODAY'S ATTENDANCE STATUS NOTIFICATION
          Notifies the student whether they are ON TIME, LATE, or ABSENT
          ======================================================== */}
      {today && (
        <div 
          className="card"
          style={{
            marginBottom: '20px',
            border: today.status === 'ontime'
              ? '2px solid #86efac'
              : today.status === 'late'
              ? '2px solid #fcd34d'
              : today.status === 'absent'
              ? '2px solid #fca5a5'
              : '2px solid #7dd3fc',
            background: today.status === 'ontime'
              ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
              : today.status === 'late'
              ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
              : today.status === 'absent'
              ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
              : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            boxShadow: today.status === 'ontime'
              ? '0 10px 25px -4px rgba(22, 163, 74, 0.15)'
              : today.status === 'late'
              ? '0 10px 25px -4px rgba(217, 119, 6, 0.15)'
              : today.status === 'absent'
              ? '0 10px 25px -4px rgba(220, 38, 38, 0.15)'
              : '0 10px 25px -4px rgba(2, 132, 199, 0.12)',
            padding: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              {/* Status Icon */}
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: today.status === 'ontime'
                  ? '#16a34a'
                  : today.status === 'late'
                  ? '#d97706'
                  : today.status === 'absent'
                  ? '#dc2626'
                  : '#0284c7',
                color: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
              }}>
                {today.status === 'ontime' && <CheckCircle2 size={32} />}
                {today.status === 'late' && <Clock size={30} />}
                {today.status === 'absent' && <UserX size={30} />}
                {today.status === 'pending' && <BellRing size={28} />}
              </div>

              {/* Status Content */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    Today's Attendance Status • {today.date}
                  </span>
                  
                  {/* Status Badge */}
                  {today.status === 'ontime' && (
                    <span className="badge badge-present" style={{ fontSize: '0.85rem', padding: '4px 12px', fontWeight: 800 }}>
                      <Check size={14} /> ON TIME
                    </span>
                  )}
                  {today.status === 'late' && (
                    <span className="badge badge-late" style={{ fontSize: '0.85rem', padding: '4px 12px', fontWeight: 800 }}>
                      <Clock size={14} /> LATE
                    </span>
                  )}
                  {today.status === 'absent' && (
                    <span className="badge badge-absent" style={{ fontSize: '0.85rem', padding: '4px 12px', fontWeight: 800 }}>
                      <UserX size={14} /> ABSENT
                    </span>
                  )}
                  {today.status === 'pending' && (
                    <span className="badge badge-pending" style={{ fontSize: '0.85rem', padding: '4px 12px', fontWeight: 800 }}>
                      <Clock size={14} /> PENDING CHECK-IN
                    </span>
                  )}
                </div>

                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  margin: '0 0 6px 0',
                  color: today.status === 'ontime'
                    ? '#15803d'
                    : today.status === 'late'
                    ? '#b45309'
                    : today.status === 'absent'
                    ? '#b91c1c'
                    : '#0369a1'
                }}>
                  {today.title}
                </h3>

                <p style={{
                  fontSize: '0.92rem',
                  margin: 0,
                  lineHeight: 1.5,
                  color: today.status === 'ontime'
                    ? '#166534'
                    : today.status === 'late'
                    ? '#92400e'
                    : today.status === 'absent'
                    ? '#991b1b'
                    : '#075985',
                  maxWidth: '680px'
                }}>
                  {today.message}
                </p>
              </div>
            </div>

            {/* Attendance Details Chips */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.75)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(0,0,0,0.06)',
              minWidth: '200px'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                ATTENDANCE DETAILS
              </div>
              {today.record?.time_in ? (
                <div style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="var(--primary)" />
                  <span>Time In: <strong style={{ fontFamily: 'var(--font-mono)' }}>{today.record.time_in}</strong></span>
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="var(--primary)" />
                  <span>Time In: <strong>No Log Recorded</strong></span>
                </div>
              )}
              <div style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={14} color="var(--primary)" />
                <span>Venue: <strong>{today.room || 'Room 101'}</strong></span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Cutoff: On-Time ≤ {today.late_after} • Deadline: {today.attendance_deadline}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DepEd SF2 Absence Threshold / Drop-Risk Warning */}
      {stats?.at_risk && (
        <div className="alert alert-error" style={{ marginBottom: '20px', padding: '16px' }}>
          <ShieldAlert size={24} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.94rem' }}>
              DepEd Attendance Alert: Consecutive / Cumulative Absence Threshold Reached!
            </div>
            <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
              You have accumulated <strong>{stats.absent_count} absences</strong>, which meets or exceeds the school intervention limit of {stats.absence_threshold} days. Please discuss your attendance with your class adviser immediately.
            </div>
          </div>
        </div>
      )}

      {/* Attendance Stats Overview (4 Cards) */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard
          label="On-Time Days"
          value={stats.on_time_count}
          icon={<CheckCircle size={22} />}
          color="#16a34a"
        />
        <StatCard
          label="Late Days"
          value={stats.late_count}
          icon={<Clock size={22} />}
          color="#d97706"
        />
        <StatCard
          label="Absent Days"
          value={stats.absent_count}
          icon={<UserX size={22} />}
          color="#dc2626"
        />
        <StatCard
          label="Attendance Rate"
          value={`${stats.attendance_rate}%`}
          icon={<TrendingUp size={22} />}
          color="#2563eb"
        />
      </div>

      {/* Daily Attendance Check-In Card */}
      <div className="card" style={{ textAlign: 'center', padding: '30px 20px', marginBottom: '24px' }}>
        <div style={{ maxWidth: '540px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.78rem',
            fontWeight: 700,
            marginBottom: '10px'
          }}>
            <Sparkles size={14} />
            <span>DAILY ATTENDANCE REGISTRATION</span>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>
            Learner Daily Presence Check-In
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
            Register your attendance for today. Your status (On Time, Late, or Absent) will be automatically calculated and displayed on your dashboard.
          </p>

          {checkInAlert && (
            <div className={`alert ${
              checkInAlert.type === 'success' 
                ? 'alert-success' 
                : checkInAlert.type === 'warning' 
                ? 'alert-warning' 
                : 'alert-error'
            }`} style={{ textAlign: 'left', marginBottom: '18px' }}>
              {checkInAlert.type === 'success' && <CheckCircle size={18} />}
              {checkInAlert.type !== 'success' && <AlertCircle size={18} />}
              <span>{checkInAlert.message}</span>
            </div>
          )}

          {/* If already checked in today */}
          {today?.record ? (
            <div style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={22} color="#16a34a" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                  Attendance Verified for Today
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Marked <strong style={{ color: today.status === 'ontime' ? '#16a34a' : '#d97706' }}>{today.badge}</strong> at {today.record.time_in} • Room: {today.room}
                </div>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '14px 36px', fontSize: '1rem', borderRadius: 'var(--radius-lg)' }}
              onClick={handleSelfCheckIn}
              disabled={checkingIn}
            >
              <CheckCircle size={20} />
              <span>{checkingIn ? 'Verifying & Recording Attendance...' : 'I am Present — Check In Today'}</span>
            </button>
          )}
        </div>
      </div>

      {/* History and Change Password Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        
        {/* Attendance History Section */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
            <h3 className="card-title">
              <History size={20} />
              <span>Attendance History</span>
            </h3>
            <span className="badge badge-submitted">{records.length} total days</span>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '4px 10px' }}
            >
              All ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ontime')}
              className={`btn btn-sm ${statusFilter === 'ontime' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '4px 10px', color: statusFilter === 'ontime' ? 'white' : '#16a34a' }}
            >
              On Time ({stats.on_time_count})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('late')}
              className={`btn btn-sm ${statusFilter === 'late' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '4px 10px', color: statusFilter === 'late' ? 'white' : '#d97706' }}
            >
              Late ({stats.late_count})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`btn btn-sm ${statusFilter === 'absent' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '4px 10px', color: statusFilter === 'absent' ? 'white' : '#dc2626' }}
            >
              Absent ({stats.absent_count})
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by date (YYYY-MM-DD)..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.82rem', padding: '8px 12px 8px 34px' }}
            />
          </div>

          <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Status</th>
                  <th>Venue</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No matching attendance records found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {r.date}
                        {r.date === today?.date && (
                          <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 800 }}>
                            (TODAY)
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {r.time_in || '—'}
                      </td>
                      <td>
                        {r.status === 'late' ? (
                          <span className="badge badge-late">
                            <Clock size={12} /> Late
                          </span>
                        ) : r.status === 'absent' || r.status === 'am_absent' || r.status === 'pm_absent' ? (
                          <span className="badge badge-absent">
                            <UserX size={12} /> {r.display_status || 'Absent'}
                          </span>
                        ) : (
                          <span className="badge badge-present">
                            <Check size={12} /> On Time
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {r.room || 'Room 101'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Notices & Security */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Recent Attendance Notices Feed */}
          {notices.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <MessageSquare size={18} />
                  <span>Recent Attendance Notices</span>
                </h3>
                <span className="badge badge-pending">{notices.length} alerts</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notices.map((n, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>SMS / System Notice</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.created_at || 'Recently'}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change Password Card */}
          <div className="card" id="security-section">
            <div className="card-header">
              <h3 className="card-title">
                <KeyRound size={20} />
                <span>Security & Password</span>
              </h3>
            </div>

            {passwordAlert && (
              <div className={`alert ${passwordAlert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                {passwordAlert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                <span>{passwordAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password (min. 8 characters)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Create new secure password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repeat new password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }} disabled={changingPassword}>
                <Lock size={15} />
                <span>{changingPassword ? 'Updating...' : 'Change Password'}</span>
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
