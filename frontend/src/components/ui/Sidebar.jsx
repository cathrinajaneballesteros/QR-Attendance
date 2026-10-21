import React from 'react';
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
  X
} from 'lucide-react';
import backpackCard from '../../assets/backpack-card.png';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

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

  // Student Navigation strictly matching student ref.png
  const studentNavItems = [
    { to: '/student/portal', label: 'Home', icon: LayoutDashboard, exact: true },
    { to: '/student/portal#attendance', label: 'My Attendance', icon: Clock, hash: '#attendance' },
    { to: '/student/portal#history', label: 'Attendance History', icon: Calendar, hash: '#history' },
    { to: '/student/portal#notices', label: 'Notifications', icon: Bell, badge: 5, hash: '#notices' },
    { to: '/student/portal#security', label: 'Settings', icon: SettingsIcon, hash: '#security' },
  ];

  const navItems = isStudent ? studentNavItems : (isAdmin ? adminNavItems : teacherNavItems);

  const handleItemClick = (item) => {
    if (isOpen && onClose) onClose();
    if (item.hash) {
      const targetId = item.hash.replace('#', '') + '-section';
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact 
              ? location.pathname === item.to && !location.hash
              : (item.hash ? location.hash === item.hash : (location.pathname === item.to || location.pathname.startsWith(item.to + '/')));

            return (
              <NavLink
                key={item.label}
                to={item.to}
                onClick={() => handleItemClick(item)}
                className={`sres-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={19} strokeWidth={1.8} className="sres-nav-icon" />
                <span className="sres-nav-label">{item.label}</span>
                {item.badge && (
                  <span className="sres-nav-badge">{item.badge}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Student Sidebar: Motivational Card with 3D Backpack Graphic (from student ref.png) */}
        {isStudent && (
          <div className="sres-sidebar-motivate-card">
            <img 
              src={backpackCard} 
              alt="Backpack and books" 
              className="sres-sidebar-motivate-img"
            />
            <p className="sres-sidebar-motivate-quote">
              Small steps every day, big dreams tomorrow!
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
