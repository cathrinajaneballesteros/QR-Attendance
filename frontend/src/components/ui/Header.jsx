import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  QrCode, 
  Bell, 
  User as UserIcon, 
  ChevronDown, 
  LogOut, 
  Settings as SettingsIcon, 
  Menu,
  ShieldCheck,
  GraduationCap,
  Search,
  KeyRound
} from 'lucide-react';

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    if (isStudent) {
      navigate('/login/student');
    } else if (isAdmin) {
      navigate('/login/admin');
    } else {
      navigate('/login/teacher');
    }
  };

  const displayName = user?.full_name || (isAdmin ? 'Administrator' : isStudent ? 'Learner' : 'Ms. Aragon');
  const roleSubtitle = isStudent
    ? 'Grade 6 • GREAT GENIUSES'
    : isAdmin
    ? 'System Administrator'
    : 'Class Adviser • Grade 6';

  const homeLink = isAdmin ? '/admin/dashboard' : isStudent ? '/student/portal' : '/teacher/dashboard';

  return (
    <header className={`sres-header ${isStudent ? 'sres-header-student' : ''}`}>
      {/* Left: Mobile Menu Toggle & Brand Logo */}
      <div className="sres-header-left">
        <button 
          type="button"
          className="sres-menu-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>

        <Link to={homeLink} className="sres-brand">
          <div className="sres-brand-logo-tile">
            <QrCode size={22} color="#ffffff" strokeWidth={2.2} />
          </div>
          <div className="sres-brand-text">
            <span className="sres-brand-name">QR Attend</span>
            <span className="sres-brand-sub">Sta. Rosa ES</span>
          </div>
        </Link>

        {/* Student Top Bar: Search Input (shown on desktop per student ref.png) */}
        {isStudent && (
          <div className="sres-student-search-bar" role="search">
            <Search size={16} className="sres-student-search-icon" aria-hidden="true" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="sres-student-search-input"
              aria-label="Search portal contents"
            />
          </div>
        )}
      </div>

      {/* Right Controls: Notification Bell, User Menu */}
      <div className="sres-header-right">

        {/* Notification Bell with unread dot */}
        <button 
          type="button" 
          className="sres-notif-btn" 
          title="Notifications"
          onClick={() => {
            if (isStudent) {
              const el = document.getElementById('notices-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            } else {
              navigate(isAdmin ? '/admin/sms-logs' : '/teacher/sms-logs');
            }
          }}
        >
          <Bell size={19} strokeWidth={1.8} />
          <span className="sres-notif-dot" />
        </button>

        {/* User Profile Pill & Dropdown */}
        <div className="sres-user-menu" ref={dropdownRef}>
          <button 
            type="button" 
            className="sres-user-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
          >
            <div className="sres-user-avatar">
              <UserIcon size={18} strokeWidth={1.8} />
            </div>
            <div className="sres-user-meta">
              <span className="sres-user-name">{displayName}</span>
              <span className="sres-user-role">{roleSubtitle}</span>
            </div>
            <ChevronDown 
              size={14} 
              strokeWidth={1.8} 
              className={`sres-user-chevron ${dropdownOpen ? 'open' : ''}`}
            />
          </button>

          {/* Profile Dropdown */}
          {dropdownOpen && (
            <div className="sres-dropdown-panel">
              <div className="sres-dropdown-header">
                <p className="sres-dropdown-name">{displayName}</p>
                <p className="sres-dropdown-sub">{user?.username || (isStudent ? 'Learner LRN' : 'Faculty ID')}</p>
                <span className="sres-dropdown-badge">
                  {isAdmin ? (
                    <ShieldCheck size={12} strokeWidth={2} />
                  ) : isStudent ? (
                    <UserIcon size={12} strokeWidth={2} />
                  ) : (
                    <GraduationCap size={12} strokeWidth={2} />
                  )}
                  <span>{roleSubtitle}</span>
                </span>
              </div>

              <div className="sres-dropdown-divider" />

              <div className="sres-dropdown-actions">
                {!isStudent && (
                  <Link 
                    to={isAdmin ? '/admin/settings' : '/teacher/settings'} 
                    className="sres-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <SettingsIcon size={16} strokeWidth={1.8} />
                    <span>{isAdmin ? 'System Settings' : 'Classroom Settings'}</span>
                  </Link>
                )}

                {isAdmin && (
                  <Link 
                    to="/admin/settings?tab=admin_credentials" 
                    className="sres-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <KeyRound size={16} strokeWidth={1.8} />
                    <span>Admin Credentials</span>
                  </Link>
                )}

                {isStudent && (
                  <button
                    type="button"
                    className="sres-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      const el = document.getElementById('security-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <KeyRound size={16} strokeWidth={1.8} />
                    <span>Security &amp; Password</span>
                  </button>
                )}

                <button 
                  type="button" 
                  className="sres-dropdown-item sres-dropdown-item-danger"
                  onClick={handleLogout}
                >
                  <LogOut size={16} strokeWidth={1.8} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
