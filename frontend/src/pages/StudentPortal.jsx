import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { playSuccessChime, playWarningChime } from '../utils/sound';
import { StatusBadge, Button } from '../components/ui';
import { 
  GraduationCap, 
  Users,
  CheckCircle2, 
  Clock, 
  UserX, 
  TrendingUp, 
  Calendar, 
  Bell, 
  Building, 
  ShieldAlert, 
  Search, 
  MessageSquare, 
  Check, 
  Zap, 
  BookOpen, 
  FileText, 
  Megaphone, 
  Lock, 
  Shield, 
  ChevronRight, 
  ChevronLeft, 
  KeyRound, 
  X, 
  Eye, 
  EyeOff,
  Sun,
  Moon,
  Info
} from 'lucide-react';
import backpackBanner from '../assets/backpack-banner.png';

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

  // Filter chips for Attendance History: 'ALL' | 'ONTIME' | 'LATE' | 'ABSENT'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 7;

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGradesModal, setShowGradesModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAllNoticesModal, setShowAllNoticesModal] = useState(false);

  // Change Password state
  const [isDefaultPassword, setIsDefaultPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordAlert, setPasswordAlert] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/student-account/me');
      if (response.ok) {
        const data = await response.json();
        setProfile(data.student || null);
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

  // Time of day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: Sun };
    if (hour < 18) return { text: 'Good afternoon', icon: Sun };
    return { text: 'Good evening', icon: Moon };
  }, []);

  // Filtered attendance history records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Status chip filter
      if (statusFilter === 'ONTIME' && r.status !== 'present' && r.display_status !== 'on_time') return false;
      if (statusFilter === 'LATE' && r.status !== 'late') return false;
      if (statusFilter === 'ABSENT' && r.status !== 'absent') return false;

      // Text search query
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchDate = (r.date || '').toLowerCase().includes(q);
        const matchStatus = (r.display_status || r.status || '').toLowerCase().includes(q);
        const matchRoom = (r.room || '').toLowerCase().includes(q);
        if (!matchDate && !matchStatus && !matchRoom) return false;
      }
      return true;
    });
  }, [records, statusFilter, historySearch]);

  // Paginated records
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredRecords.slice(start, start + recordsPerPage);
  }, [filteredRecords, currentPage]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordAlert(null);

    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setPasswordAlert({ type: 'error', message: 'Please enter both your current and new password.' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordAlert({ type: 'error', message: 'New password must be at least 8 characters long.' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordAlert({ type: 'error', message: 'New passwords do not match. Please re-enter.' });
      return;
    }

    setChangingPassword(true);
    try {
      const response = await apiFetch('/api/student-account/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();
      if (response.ok) {
        playSuccessChime();
        setPasswordAlert({ type: 'success', message: 'Password updated successfully! Keep it confidential.' });
        setIsDefaultPassword(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setShowPasswordModal(false), 1800);
      } else {
        playWarningChime();
        setPasswordAlert({ type: 'error', message: data.error || 'Failed to update password.' });
      }
    } catch (err) {
      setPasswordAlert({ type: 'error', message: 'Network error. Please try again later.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const studentName = profile?.full_name || 'Anin, Angelito Lapitan';
  const gradeLevel = profile?.grade_level ? `Grade ${profile.grade_level}` : 'Grade 6';
  const sectionName = profile?.section || 'GREAT GENIUSES';
  const todayDateStr = new Date().toISOString().split('T')[0];

  const GreetingIcon = greeting.icon;

  return (
    <div className="sres-student-portal-root">
      {/* Default Password Notice if active */}
      {isDefaultPassword && (
        <div className="sres-student-notice-alert">
          <div className="sres-student-notice-alert-left">
            <ShieldAlert size={22} className="sres-student-alert-icon" />
            <div>
              <div className="sres-student-alert-title">Default School Password In Use</div>
              <div className="sres-student-alert-sub">
                Your account is currently using the standardized default password. Please update your password to keep your student record secure.
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="sres-student-alert-btn"
            onClick={() => setShowPasswordModal(true)}
          >
            <KeyRound size={14} />
            <span>Change Password</span>
          </button>
        </div>
      )}

      {/* Main Two-Column Layout (Matching student ref.png) */}
      <div className="sres-student-grid">
        {/* ========================================================
            LEFT COLUMN (~2/3 on desktop)
           ======================================================== */}
        <div className="sres-student-col-main">
          {/* 1. Welcome Banner */}
          <div className="sres-student-banner">
            <div className="sres-student-banner-content">
              <span className="sres-student-greeting-line">
                {greeting.text},
              </span>
              <h1 className="sres-student-name-headline">
                <span>{studentName}!</span>
                <GreetingIcon size={24} className="sres-student-sun-icon" />
              </h1>
              <p className="sres-student-sub-quote">
                Keep up the great work! You're one step closer to your goals.
              </p>
              <div className="sres-student-tags-row">
                <span className="sres-student-pill-tag">
                  <GraduationCap size={15} />
                  <span>{gradeLevel}</span>
                </span>
                <span className="sres-student-pill-tag">
                  <Users size={14} />
                  <span>{sectionName}</span>
                </span>
              </div>
            </div>

            {/* Banner Artwork on Right */}
            <div className="sres-student-banner-art">
              <div className="sres-student-calligraphy-quote">
                "Be present<br />for a brighter<br />future."
              </div>
              <img 
                src={backpackBanner} 
                alt="Backpack and books 3D illustration" 
                className="sres-student-banner-img"
              />
            </div>
          </div>

          {/* 2. Today's Attendance Status Card (PURE TRACKING ONLY - NO CHECK-IN BUTTON) */}
          <section id="attendance-section" className={`sres-student-status-card sres-status-${today?.status || 'pending'}`}>
            <div className="sres-student-status-header-wrap">
              <div className="sres-student-status-icon-circle">
                {today?.status === 'ontime' ? (
                  <CheckCircle2 size={28} strokeWidth={2.4} />
                ) : today?.status === 'late' ? (
                  <Clock size={28} strokeWidth={2.4} />
                ) : today?.status === 'absent' ? (
                  <UserX size={28} strokeWidth={2.4} />
                ) : (
                  <Clock size={28} strokeWidth={2.4} />
                )}
              </div>

              <div className="sres-student-status-info">
                <div className="sres-student-status-eyebrow-row">
                  <span className="sres-student-status-label">Today's Attendance Status</span>
                  <span className={`sres-student-status-pill sres-pill-${today?.status || 'pending'}`}>
                    {today?.status === 'ontime' && 'ON TIME'}
                    {today?.status === 'late' && 'LATE'}
                    {today?.status === 'absent' && 'ABSENT'}
                    {(!today || today?.status === 'pending') && 'PENDING'}
                  </span>
                </div>

                <h2 className="sres-student-status-headline">
                  {today?.status === 'ontime' && 'You are On Time Today!'}
                  {today?.status === 'late' && 'You are Late Today'}
                  {today?.status === 'absent' && 'You are Marked Absent Today'}
                  {(!today || today?.status === 'pending') && 'Attendance Check-In Pending'}
                </h2>

                <p className="sres-student-status-message">
                  {today?.status === 'ontime' && (
                    `Checked in on time at ${today?.record?.time_in || '07:52 AM'}. Keep up the stellar punctuality!`
                  )}
                  {today?.status === 'late' && (
                    `You arrived and checked in late today at ${today?.record?.time_in || '10:57 AM'}. On-time cutoff was ${today?.late_after || '08:00 AM'}.`
                  )}
                  {today?.status === 'absent' && (
                    `No classroom attendance was logged for today's session. Please consult your class adviser if this is in error.`
                  )}
                  {(!today || today?.status === 'pending') && (
                    `Class attendance is pending verification by your class adviser during morning roll call.`
                  )}
                </p>
              </div>
            </div>

            {/* Attendance Details Box */}
            <div className="sres-student-details-box">
              <span className="sres-student-details-title">Attendance Details</span>
              <div className="sres-student-detail-row">
                <Clock size={14} className="sres-student-detail-icon" />
                <span>Time In: <strong>{today?.record?.time_in || 'No Log Recorded'}</strong></span>
              </div>
              <div className="sres-student-detail-row">
                <Building size={14} className="sres-student-detail-icon" />
                <span>Venue: <strong>{today?.room || 'Room 101 – Verified Teacher'}</strong></span>
              </div>
              <div className="sres-student-detail-sub">
                Cutoff: On-Time ≤ {today?.late_after || '08:00'} • Deadline: {today?.attendance_deadline || '16:00'}
              </div>
            </div>
          </section>

          {/* 3. Stat Cards Row (4 Cards Matching student ref.png) */}
          <div className="sres-student-stats-row">
            <div className="sres-student-stat-card">
              <div className="sres-student-stat-icon sres-stat-green">
                <CheckCircle2 size={20} strokeWidth={2.4} />
              </div>
              <div className="sres-student-stat-content">
                <span className="sres-student-stat-num">{stats.on_time_count}</span>
                <span className="sres-student-stat-label">On-Time Days</span>
              </div>
              <ChevronRight size={16} className="sres-student-stat-chevron" />
            </div>

            <div className="sres-student-stat-card">
              <div className="sres-student-stat-icon sres-stat-amber">
                <Clock size={20} strokeWidth={2.4} />
              </div>
              <div className="sres-student-stat-content">
                <span className="sres-student-stat-num">{stats.late_count}</span>
                <span className="sres-student-stat-label">Late Days</span>
              </div>
              <ChevronRight size={16} className="sres-student-stat-chevron" />
            </div>

            <div className="sres-student-stat-card">
              <div className="sres-student-stat-icon sres-stat-red">
                <UserX size={20} strokeWidth={2.4} />
              </div>
              <div className="sres-student-stat-content">
                <span className="sres-student-stat-num">{stats.absent_count}</span>
                <span className="sres-student-stat-label">Absent Days</span>
              </div>
              <ChevronRight size={16} className="sres-student-stat-chevron" />
            </div>

            <div className="sres-student-stat-card">
              <div className="sres-student-stat-icon sres-stat-blue">
                <TrendingUp size={20} strokeWidth={2.4} />
              </div>
              <div className="sres-student-stat-content">
                <span className="sres-student-stat-num">{stats.attendance_rate}%</span>
                <span className="sres-student-stat-label">Attendance Rate</span>
              </div>
              <ChevronRight size={16} className="sres-student-stat-chevron" />
            </div>
          </div>

          {/* 4. Attendance History Card */}
          <section id="history-section" className="sres-student-history-card">
            <div className="sres-student-card-header">
              <div className="sres-student-card-header-left">
                <Calendar size={20} className="sres-student-header-icon" />
                <h3 className="sres-student-card-title">Attendance History</h3>
              </div>
              <button 
                type="button" 
                className="sres-student-view-all-pill"
                onClick={() => {
                  setStatusFilter('ALL');
                  setHistorySearch('');
                }}
              >
                <span>View All</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Filter Chips */}
            <div className="sres-student-filter-chips" role="tablist">
              <button
                type="button"
                className={`sres-student-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
              >
                <span>All ({records.length})</span>
              </button>
              <button
                type="button"
                className={`sres-student-chip sres-chip-green ${statusFilter === 'ONTIME' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('ONTIME'); setCurrentPage(1); }}
              >
                <Check size={13} strokeWidth={2.4} />
                <span>On Time ({stats.on_time_count})</span>
              </button>
              <button
                type="button"
                className={`sres-student-chip sres-chip-amber ${statusFilter === 'LATE' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('LATE'); setCurrentPage(1); }}
              >
                <Clock size={13} strokeWidth={2.4} />
                <span>Late ({stats.late_count})</span>
              </button>
              <button
                type="button"
                className={`sres-student-chip sres-chip-red ${statusFilter === 'ABSENT' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('ABSENT'); setCurrentPage(1); }}
              >
                <UserX size={13} strokeWidth={2.4} />
                <span>Absent ({stats.absent_count})</span>
              </button>
            </div>

            {/* History Table */}
            <div className="sres-student-table-container">
              <table className="sres-student-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Status</th>
                    <th>Venue</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="sres-student-table-empty">
                        No attendance records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r, i) => {
                      const isToday = r.date === todayDateStr;
                      return (
                        <tr key={r.date || i}>
                          <td>
                            <span className="sres-student-table-date">{r.date}</span>
                            {isToday && (
                              <span className="sres-student-today-tag">(TODAY)</span>
                            )}
                          </td>
                          <td className="sres-student-table-time">
                            {r.time_in || '—'}
                          </td>
                          <td>
                            <StatusBadge status={r.status} label={r.display_status} />
                          </td>
                          <td className="sres-student-table-venue">
                            {r.room || 'Room 101 – Verified Teacher'}
                          </td>
                          <td className="sres-student-table-chevron">
                            <ChevronRight size={15} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="sres-student-table-footer">
              <span className="sres-student-table-count">
                Showing {paginatedRecords.length} of {filteredRecords.length} records
              </span>

              <div className="sres-student-pagination">
                <button
                  type="button"
                  className="sres-student-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(num => (
                  <button
                    key={num}
                    type="button"
                    className={`sres-student-page-btn ${currentPage === num ? 'active' : ''}`}
                    onClick={() => setCurrentPage(num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  className="sres-student-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ========================================================
            RIGHT COLUMN (~1/3 on desktop)
           ======================================================== */}
        <aside className="sres-student-col-side">
          {/* Card 1: Quick Actions (2x2 Grid matching student ref.png) */}
          <div className="sres-student-side-card">
            <div className="sres-student-card-header">
              <div className="sres-student-card-header-left">
                <Zap size={18} className="sres-student-header-icon" />
                <h3 className="sres-student-card-title">Quick Actions</h3>
              </div>
            </div>

            <div className="sres-student-actions-grid">
              <button
                type="button"
                className="sres-student-action-tile"
                onClick={() => {
                  const el = document.getElementById('history-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="sres-student-action-icon">
                  <Calendar size={18} />
                </div>
                <span className="sres-student-action-label">View Attendance History</span>
                <ChevronRight size={15} className="sres-student-action-chevron" />
              </button>

              <button
                type="button"
                className="sres-student-action-tile"
                onClick={() => setShowScheduleModal(true)}
              >
                <div className="sres-student-action-icon">
                  <BookOpen size={18} />
                </div>
                <span className="sres-student-action-label">My Class Schedule</span>
                <ChevronRight size={15} className="sres-student-action-chevron" />
              </button>

              <button
                type="button"
                className="sres-student-action-tile"
                onClick={() => setShowGradesModal(true)}
              >
                <div className="sres-student-action-icon">
                  <FileText size={18} />
                </div>
                <span className="sres-student-action-label">View Grades</span>
                <ChevronRight size={15} className="sres-student-action-chevron" />
              </button>

              <button
                type="button"
                className="sres-student-action-tile"
                onClick={() => {
                  const el = document.getElementById('notices-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <div className="sres-student-action-icon">
                  <Megaphone size={18} />
                </div>
                <span className="sres-student-action-label">Announcements</span>
                <ChevronRight size={15} className="sres-student-action-chevron" />
              </button>
            </div>
          </div>

          {/* Card 2: Recent Notices */}
          <div id="notices-section" className="sres-student-side-card">
            <div className="sres-student-card-header">
              <div className="sres-student-card-header-left">
                <Megaphone size={18} className="sres-student-header-icon" />
                <h3 className="sres-student-card-title">Recent Notices</h3>
              </div>
              <button
                type="button"
                className="sres-student-view-all-pill"
                onClick={() => setShowAllNoticesModal(true)}
              >
                <span>View All</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="sres-student-notices-list">
              {notices.length === 0 ? (
                <div className="sres-student-notice-empty">
                  No notifications recorded yet.
                </div>
              ) : (
                notices.slice(0, 5).map((n, idx) => (
                  <div key={n.id || idx} className="sres-student-notice-item">
                    <div className="sres-student-notice-icon-circle">
                      {n.type === 'sms' ? <MessageSquare size={16} /> : <Bell size={16} />}
                    </div>
                    <div className="sres-student-notice-body">
                      <div className="sres-student-notice-top">
                        <span className="sres-student-notice-title">
                          {n.title || 'SMS / System Notice'}
                        </span>
                        <div className="sres-student-notice-meta">
                          <span className="sres-student-notice-time">
                            {n.created_at ? n.created_at.slice(0, 19).replace('T', ' ') : '2026-10-20'}
                          </span>
                          {!n.read && <span className="sres-student-notice-dot" />}
                        </div>
                      </div>
                      <p className="sres-student-notice-text">
                        {n.message}
                      </p>
                    </div>
                    <ChevronRight size={15} className="sres-student-notice-chevron" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 3: Security & Password Card */}
          <div 
            id="security-section"
            className="sres-student-side-card sres-student-security-card"
            onClick={() => setShowPasswordModal(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') setShowPasswordModal(true); }}
          >
            <div className="sres-student-security-left">
              <div className="sres-student-security-icon-circle">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="sres-student-security-title">Security &amp; Password</h4>
                <div className="sres-student-security-sub">
                  <Shield size={13} />
                  <span>Keep your account safe.</span>
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="sres-student-security-chevron" />
          </div>
        </aside>
      </div>

      {/* ========================================================
          MODALS: Class Schedule, Grades Info, Change Password
         ======================================================== */}

      {/* Class Schedule Modal */}
      {showScheduleModal && (
        <div className="sres-login-info-modal-backdrop" onClick={() => setShowScheduleModal(false)}>
          <div className="sres-login-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sres-login-info-modal-header">
              <div className="sres-login-info-modal-icon">
                <BookOpen size={22} />
              </div>
              <h3>Class Schedule — Grade 6</h3>
            </div>
            <div style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, marginBottom: '20px' }}>
              <div style={{ padding: '8px 12px', background: '#FDF2F6', borderRadius: '8px', marginBottom: '10px' }}>
                <strong>Section:</strong> GREAT GENIUSES • <strong>Room:</strong> 101<br />
                <strong>Adviser:</strong> Ms. Aragon
              </div>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>07:30 AM – 07:45 AM:</strong> Morning Assembly &amp; Attendance</li>
                <li><strong>07:45 AM – 09:45 AM:</strong> Mathematics &amp; Science</li>
                <li><strong>09:45 AM – 10:05 AM:</strong> Recess Break</li>
                <li><strong>10:05 AM – 11:45 AM:</strong> English &amp; Filipino</li>
                <li><strong>01:00 PM – 03:00 PM:</strong> Araling Panlipunan &amp; MAPEH</li>
                <li><strong>03:00 PM – 04:00 PM:</strong> Homeroom &amp; Remediation</li>
              </ul>
            </div>
            <div className="sres-login-info-modal-actions">
              <Button variant="primary" size="sm" onClick={() => setShowScheduleModal(false)}>
                Close Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grades Disclaimer Modal */}
      {showGradesModal && (
        <div className="sres-login-info-modal-backdrop" onClick={() => setShowGradesModal(false)}>
          <div className="sres-login-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sres-login-info-modal-header">
              <div className="sres-login-info-modal-icon">
                <FileText size={22} />
              </div>
              <h3>Academic Grades &amp; SF9 Report Cards</h3>
            </div>
            <p>
              In accordance with DepEd guidelines, academic grades (Form 137 / 138) are officially processed
              by your class adviser at the end of each grading quarter and distributed during Parent-Teacher Conferences.
              This student portal specializes exclusively in <strong>daily attendance monitoring and SF2 compliance</strong>.
            </p>
            <div className="sres-login-info-modal-actions">
              <Button variant="primary" size="sm" onClick={() => setShowGradesModal(false)}>
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="sres-login-info-modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="sres-login-info-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="sres-login-info-modal-header">
              <div className="sres-login-info-modal-icon">
                <KeyRound size={22} />
              </div>
              <h3>Change Student Password</h3>
            </div>

            {passwordAlert && (
              <div className={`alert alert-${passwordAlert.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '14px', padding: '10px 14px', fontSize: '0.85rem' }}>
                <span>{passwordAlert.message}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    style={{ width: '100%', height: '44px', paddingRight: '40px', borderRadius: '10px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>New Password (min. 8 characters)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Create new secure password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    style={{ width: '100%', height: '44px', paddingRight: '40px', borderRadius: '10px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repeat new password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  style={{ width: '100%', height: '44px', borderRadius: '10px' }}
                  required
                />
              </div>

              <div className="sres-login-info-modal-actions" style={{ gap: '10px' }}>
                <Button variant="secondary" size="sm" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={changingPassword}>
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All Notices Modal */}
      {showAllNoticesModal && (
        <div className="sres-login-info-modal-backdrop" onClick={() => setShowAllNoticesModal(false)}>
          <div className="sres-login-info-modal" style={{ maxWidth: '580px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="sres-login-info-modal-header">
              <div className="sres-login-info-modal-icon">
                <Megaphone size={22} />
              </div>
              <h3>All Attendance Notices &amp; Alerts</h3>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '16px', paddingRight: '6px' }}>
              {notices.map((n, idx) => (
                <div key={n.id || idx} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FDF2F6', color: '#6B0F3A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {n.type === 'sms' ? <MessageSquare size={15} /> : <Bell size={15} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{n.title || 'Notice'}</strong>
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{n.created_at ? n.created_at.slice(0, 19).replace('T', ' ') : ''}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.45 }}>{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="sres-login-info-modal-actions">
              <Button variant="primary" size="sm" onClick={() => setShowAllNoticesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 
