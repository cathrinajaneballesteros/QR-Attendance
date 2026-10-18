import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  QrCode, 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  MessageSquare, 
  Sliders, 
  UserCheck, 
  LogOut, 
  GraduationCap,
  ListTodo,
  History,
  Palette,
  Menu,
  X
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, changeTheme, themes } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  const navItems = [];
  if (isAdmin) {
    navItems.push(
      { to: '/admin', label: 'Admin Dashboard', icon: <LayoutDashboard size={17} /> },
      { to: '/manage-teachers', label: 'Manage Teachers', icon: <UserCheck size={17} /> },
      { to: '/student-accounts', label: 'Student Accounts', icon: <GraduationCap size={17} /> },
      { to: '/history', label: 'Historical Data', icon: <History size={17} /> }
    );
  } else if (isTeacher) {
    navItems.push(
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
      { to: '/attendance', label: 'Attendance', icon: <QrCode size={17} /> },
      { to: '/history', label: 'Historical Data', icon: <History size={17} /> },
      { to: '/students', label: 'Students', icon: <Users size={17} /> },
      { to: '/sf2-report', label: 'SF2 Report', icon: <FileSpreadsheet size={17} /> },
      { to: '/sf2-progress', label: 'SF2 Progress', icon: <ListTodo size={17} /> },
      { to: '/sms-logs', label: 'SMS Logs', icon: <MessageSquare size={17} /> },
      { to: '/settings', label: 'Settings', icon: <Sliders size={17} /> }
    );
  } else if (isStudent) {
    navItems.push(
      { to: '/student-portal', label: 'Student Portal', icon: <GraduationCap size={17} /> }
    );
  }

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        <div className="navbar-top">
          <Link 
            to={isAdmin ? '/admin' : isStudent ? '/student-portal' : '/dashboard'} 
            className="brand-wrapper"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="brand-logo">
              <QrCode size={22} />
            </div>
            <div className="brand-info">
              <h1>QR<span className="highlight">Attend</span></h1>
              <p>
                {isAdmin
                  ? 'Sta. Rosa ES • Admin'
                  : isStudent
                    ? 'Sta. Rosa ES • Learner'
                    : 'Sta. Rosa ES • Faculty'}
              </p>
            </div>
          </Link>

          <div className="navbar-user-actions">
            {/* Theme Switcher Button */}
            <div style={{ position: 'relative' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm theme-btn"
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                title="Change Attendance Theme"
              >
                <Palette size={14} />
                <span className="theme-name">{theme}</span>
              </button>

              {showThemeMenu && (
                <div className="theme-dropdown-menu">
                  <div className="theme-dropdown-title">Select Theme</div>
                  {themes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        changeTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`theme-dropdown-item ${theme === t.id ? 'active' : ''}`}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.primary, display: 'inline-block' }} />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop User Info & Logout */}
            <div className="user-badge desktop-only-badge">
              <span className={`role-pill ${user.role}`}>{user.role}</span>
              <span className="user-name-text">{user.full_name || user.username}</span>
            </div>

            <button className="btn-logout desktop-only-logout" onClick={logout} title="Sign Out">
              <LogOut size={14} />
              <span>Logout</span>
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button 
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="navbar-links desktop-nav" aria-label="Main Navigation">
          {navItems.map(item => (
            <NavLink 
              key={item.to} 
              to={item.to} 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {/* Mobile Navigation Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="mobile-nav-panel">
            <div className="mobile-user-card">
              <span className={`role-pill ${user.role}`}>{user.role}</span>
              <span className="user-name-text">{user.full_name || user.username}</span>
            </div>

            <nav className="mobile-nav-list" aria-label="Mobile Navigation">
              {navItems.map(item => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `mobile-nav-btn ${isActive ? 'active' : ''}`}
                >
                  <span className="mobile-btn-icon">{item.icon}</span>
                  <span className="mobile-btn-text">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mobile-panel-footer">
              <button className="btn btn-danger mobile-logout-btn" onClick={logout}>
                <LogOut size={16} />
                <span>Sign Out ({user.username || 'User'})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
