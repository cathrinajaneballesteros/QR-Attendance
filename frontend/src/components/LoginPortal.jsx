import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Lock,
  User,
  AlertCircle,
  Loader2,
  ArrowRight,
  Scan,
  Eye,
  EyeOff,
  QrCode,
  FileSpreadsheet,
  BellRing,
  CalendarCheck,
  ShieldAlert,
  KeyRound
} from 'lucide-react';
import TeacherFaceScannerModal from './TeacherFaceScannerModal';

/**
 * Dedicated, role-locked login portal.
 * Each portal (teacher / learner / admin) is rendered on its own route with no
 * ability to switch roles in-page. The backend additionally enforces `expectedRole`.
 */
const PORTALS = {
  teacher: {
    apiRole: 'teacher',
    theme: 'faculty',
    eyebrow: 'Faculty & Class Adviser Portal',
    title: 'Faculty Sign In',
    subtitle: 'Daily QR attendance, DepEd SF2 reporting, and learner monitoring.',
    icon: GraduationCap,
    usernameLabel: 'DepEd Email or Username',
    usernamePlaceholder: 'name@deped.gov.ph',
    btnText: 'Sign In to Faculty Portal',
    notice: 'For authorized DepEd teaching personnel only.',
    features: [
      { icon: QrCode, text: 'Rapid QR code attendance scanning' },
      { icon: FileSpreadsheet, text: 'Official DepEd SF2 monthly reports' },
      { icon: BellRing, text: 'SARDO 5-day absence alerts & SMS' }
    ]
  },
  learner: {
    apiRole: 'student',
    theme: 'learner',
    eyebrow: 'Learner Self Check-In Portal',
    title: 'Learner Sign In',
    subtitle: 'Check in for class and view your personal attendance record.',
    icon: UserCheck,
    usernameLabel: 'Learner Username or LRN',
    usernamePlaceholder: 'Username given by your adviser',
    btnText: 'Sign In to Learner Portal',
    notice: 'Use the account provided by your class adviser. Do not share your password.',
    features: [
      { icon: CalendarCheck, text: 'Self check-in during class hours' },
      { icon: QrCode, text: 'Your personal attendance QR code' },
      { icon: FileSpreadsheet, text: 'Monthly attendance history' }
    ]
  },
  admin: {
    apiRole: 'admin',
    theme: 'admin',
    eyebrow: 'Restricted Administration Console',
    title: 'Administrator Sign In',
    subtitle: 'School Head & ICT Coordinator system management.',
    icon: ShieldCheck,
    usernameLabel: 'Administrator Username',
    usernamePlaceholder: 'Administrator username',
    btnText: 'Sign In to Admin Console',
    notice: 'Authorized personnel only. Administrative sign-ins and actions are recorded in the activity log.',
    features: [
      { icon: UserCheck, text: 'Faculty account & section management' },
      { icon: KeyRound, text: 'Learner account provisioning' },
      { icon: ShieldAlert, text: 'School-wide attendance oversight' }
    ]
  }
};

export default function LoginPortal({ initialRole = 'teacher' }) {
  const role = PORTALS[initialRole] ? initialRole : 'teacher';
  const cfg = PORTALS[role];
  const Icon = cfg.icon;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isExpired = new URLSearchParams(location.search).get('expired');

  const redirectFor = (user) => {
    if (user.role === 'admin') return '/admin';
    if (user.role === 'student') return '/student-portal';
    return '/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter both your username and password.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, expectedRole: cfg.apiRole })
      });
      const data = await response.json();
      if (response.ok && data.token && data.user) {
        login(data.token, data.user);
        navigate(redirectFor(data.user));
      } else {
        setError(data.error || 'Invalid username or password.');
      }
    } catch (err) {
      setError('Cannot connect to the server. Please contact your ICT coordinator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`portal-shell portal-${cfg.theme}`}>
      {/* Institutional side panel */}
      <aside className="portal-brand">
        <div className="portal-brand-inner">
          <div className="deped-masthead">
            <div>
              <div className="deped-masthead-line">Republic of the Philippines</div>
              <div className="deped-masthead-title">Department of Education</div>
              <div className="deped-masthead-line">Region I • Schools Division of Ilocos Sur</div>
            </div>
          </div>

          <div className="portal-brand-hero">
            <span className="portal-eyebrow">{cfg.eyebrow}</span>
            <h2>Sta. Rosa Elementary School</h2>
            <p>Daily QR Attendance &amp; School Form 2 Management System</p>
          </div>

          <ul className="portal-feature-list">
            {cfg.features.map(({ icon: FIcon, text }) => (
              <li key={text}>
                <span className="portal-feature-icon"><FIcon size={16} /></span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="portal-brand-footer">
            DepEd Order No. 8, s. 2015 compliant attendance records • RA 10173 Data Privacy Act
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="portal-form-panel">
        <div className="portal-form-card">


          <div className="portal-form-header">
            <div className="portal-form-icon"><Icon size={26} /></div>
            <h1>{cfg.title}</h1>
            <p>{cfg.subtitle}</p>
          </div>

          {isExpired && (
            <div className="alert alert-warning portal-alert">
              <AlertCircle size={15} />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error portal-alert" role="alert">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group portal-field">
              <label className="form-label" htmlFor={`${role}-username`}>{cfg.usernameLabel}</label>
              <div className="portal-input-wrap">
                <User size={16} className="portal-input-icon" />
                <input
                  id={`${role}-username`}
                  type="text"
                  className="form-input"
                  placeholder={cfg.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group portal-field">
              <label className="form-label" htmlFor={`${role}-password`}>Password</label>
              <div className="portal-input-wrap">
                <Lock size={16} className="portal-input-icon" />
                <input
                  id={`${role}-password`}
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="portal-reveal-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button id={`${role}-signin-btn`} type="submit" className="portal-submit" disabled={loading}>
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>Signing in...</span></>
              ) : (
                <><span>{cfg.btnText}</span><ArrowRight size={16} /></>
              )}
            </button>

            {role === 'teacher' && (
              <>
                <div className="portal-divider"><span>Or use biometric sign-in</span></div>
                <button
                  id="teacher-face-signin-btn"
                  type="button"
                  className="portal-face-btn"
                  onClick={() => { setError(''); setShowFaceModal(true); }}
                >
                  <Scan size={18} />
                  <span>Scan Face to Sign In</span>
                </button>
              </>
            )}
          </form>

          <div className={`portal-notice ${role === 'admin' ? 'portal-notice-warn' : ''}`}>
            {role === 'admin' ? <ShieldAlert size={14} /> : <Lock size={14} />}
            <span>{cfg.notice}</span>
          </div>


        </div>
      </main>

      {showFaceModal && role === 'teacher' && (
        <TeacherFaceScannerModal
          isOpen={showFaceModal}
          onClose={() => setShowFaceModal(false)}
          mode="login"
          identifier={username}
          onSuccess={(data) => {
            setShowFaceModal(false);
            login(data.token, data.user);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}
