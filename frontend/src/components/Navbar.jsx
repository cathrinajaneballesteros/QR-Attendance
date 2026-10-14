import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
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
  Palette
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, changeTheme, themes } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';
  const isStudent = user.role === 'student';

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        <div className="navbar-top">
          <Link to={isAdmin ? '/admin' : isStudent ? '/student-portal' : '/dashboard'} className="brand-wrapper">
            <div className="brand-logo">
              <QrCode size={24} />
            </div>
            <div className="brand-info">
              <h1>QR<span className="highlight">Attend</span></h1>
              <p>Sta. Rosa ES • Grade 6 Great Geniuses</p>
            </div>
          </Link>

          <div className="navbar-user-actions" style={{ position: 'relative' }}>
            {/* Theme Switcher Button (Requirement 12) */}
            <div style={{ position: 'relative' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                title="Change Attendance Theme"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '10px'
                }}
              >
                <Palette size={14} />
                <span style={{ fontSize: '0.74rem', textTransform: 'capitalize' }}>{theme}</span>
              </button>

              {showThemeMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                  border: '1px solid var(--border)',
                  padding: '8px',
                  minWidth: '180px',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
                    Select Theme
                  </div>
                  {themes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        changeTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: theme === t.id ? 'var(--primary-light)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                        fontWeight: theme === t.id ? 700 : 500,
                        color: theme === t.id ? 'var(--primary)' : 'var(--text-primary)'
                      }}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.primary, display: 'inline-block' }} />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="user-badge">
              <span className={`role-pill ${user.role}`}>{user.role}</span>
              <span>{user.full_name || user.username}</span>
            </div>

            <button className="btn-logout" onClick={logout} title="Sign Out">
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <nav className="navbar-links" aria-label="Main Navigation">
          {/* Admin Links - Only Admin Dashboard, Manage Teachers, and Historical Data */}
          {isAdmin && (
            <>
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <LayoutDashboard size={15} />
                <span>Admin Dashboard</span>
              </NavLink>
              <NavLink to="/manage-teachers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <UserCheck size={15} />
                <span>Manage Teachers</span>
              </NavLink>
              <NavLink to="/student-accounts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <GraduationCap size={15} />
                <span>Student Accounts</span>
              </NavLink>
              <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <History size={15} />
                <span>Historical Data</span>
              </NavLink>
            </>
          )}

          {/* Teacher Links */}
          {isTeacher && (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/attendance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <QrCode size={15} />
                <span>Attendance</span>
              </NavLink>
              {/* Requirement 9: Historical Data NavLink */}
              <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <History size={15} />
                <span>Historical Data</span>
              </NavLink>
              <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Users size={15} />
                <span>Students</span>
              </NavLink>
              <NavLink to="/sf2-report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FileSpreadsheet size={15} />
                <span>SF2 Report</span>
              </NavLink>
              <NavLink to="/sf2-progress" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <ListTodo size={15} />
                <span>SF2 Progress</span>
              </NavLink>
              <NavLink to="/sms-logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <MessageSquare size={15} />
                <span>SMS Logs</span>
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Sliders size={15} />
                <span>Settings</span>
              </NavLink>
            </>
          )}

          {/* Student Links */}
          {isStudent && (
            <NavLink to="/student-portal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <GraduationCap size={15} />
              <span>Student Portal</span>
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
