import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Scan, 
  Users, 
  History, 
  FileSpreadsheet, 
  Mail, 
  Settings as SettingsIcon,
  UserCheck,
  GraduationCap,
  Clock,
  Calendar,
  Bell,
  X,
  Sparkles
} from 'lucide-react';
import backpackCard from '../../assets/backpack-card.jpg';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const [activeStudentSection, setActiveStudentSection] = useState('home');
  const clickLockRef = useRef(false);
  const lockTimerRef = useRef(null);

  useEffect(() => {
    if (!isStudent) return;
    const handleActiveChanged = (e) => {
      // Do not allow scroll-spy to override active section while scrolling to target
      if (clickLockRef.current) return;
      if (e.detail?.sectionId) {
        setActiveStudentSection(e.detail.sectionId);
      }
    };
    window.addEventListener('sres-active-section-changed', handleActiveChanged);
    return () => {
      window.removeEventListener('sres-active-section-changed', handleActiveChanged);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [isStudent]);

  // Navigation Links strictly matching user role
  const teacherNavItems = [
    { to: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/teacher/attendance', label: 'Scan Attendance', icon: Scan },
    { to: '/teacher/students', label: 'Class Roster', icon: Users },
    { to: '/teacher/history', label: 'Attendance History', icon: History },
    { to: '/teacher/sf2-report', label: 'SF2 Reports', icon: FileSpreadsheet },
    { to: '/teacher/sms-logs', label: 'SMS Alerts', icon: Mail },
    { to: '/teacher/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
    { to: '/admin/teachers', label: 'Manage Teachers', icon: UserCheck },
    { to: '/admin/student-accounts', label: 'Student Accounts', icon: GraduationCap },
    { to: '/admin/history', label: 'Historical Data', icon: History },
    { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ];

  // Student Navigation strictly matching student sections
  const studentNavItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'attendance', label: 'My Attendance', icon: Clock },
    { id: 'history', label: 'Attendance History', icon: Calendar },
    { id: 'notices', label: 'Notifications', icon: Bell, badge: 5 },
    { id: 'security', label: 'Settings', icon: SettingsIcon },
  ];

  const handleStudentItemClick = (item) => {
    if (isOpen && onClose) onClose();
    setActiveStudentSection(item.id);
    clickLockRef.current = true;
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      clickLockRef.current = false;
    }, 950);
    window.dispatchEvent(new CustomEvent('sres-jump-section', { detail: { sectionId: item.id } }));
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div 
          className="sres-sidebar-backdrop" 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sres-sidebar ${isStudent ? 'sres-sidebar-student' : ''} ${isOpen ? 'open' : ''}`}>
        {/* Mobile Header in Drawer */}
        <div className="sres-sidebar-mobile-header">
          <span className="sres-sidebar-mobile-title">Menu Navigation</span>
          <button 
            type="button" 
            className="sres-sidebar-close" 
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="sres-nav-menu">
          {isStudent ? (
            studentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeStudentSection === item.id;
              return (
                <a
                  href={`#${item.id}`}
                  key={item.id}
                  onClick={(e) => {
                    e.preventDefault();
                    handleStudentItemClick(item);
                  }}
                  role="button"
                  tabIndex={0}
                  className={`sres-nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={19} strokeWidth={1.8} className="sres-nav-icon" />
                  <span className="sres-nav-label">{item.label}</span>
                  {item.badge && (
                    <span className="sres-nav-badge">{item.badge}</span>
                  )}
                </a>
              );
            })
          ) : (
            (isAdmin ? adminNavItems : teacherNavItems).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={() => { if (isOpen && onClose) onClose(); }}
                  className={({ isActive }) => `sres-nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={19} strokeWidth={1.8} className="sres-nav-icon" />
                  <span className="sres-nav-label">{item.label}</span>
                  {item.badge && (
                    <span className="sres-nav-badge">{item.badge}</span>
                  )}
                </NavLink>
              );
            })
          )}
        </nav>

        {/* Student Sidebar: Motivational Card with 3D Backpack Graphic */}
        {isStudent && (
          <div className="sres-sidebar-motivate-card">
            <div className="sres-sidebar-motivate-img-wrap">
              <img 
                src={backpackCard} 
                alt="Student backpack" 
                className="sres-sidebar-motivate-img"
              />
            </div>
            <p className="sres-sidebar-motivate-quote">
              Small steps every day, big dreams tomorrow!
            </p>
            <div className="sres-sidebar-motivate-stars" aria-hidden="true">
              <Sparkles size={13} style={{ color: '#FBBF24', display: 'inline-block' }} />
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
