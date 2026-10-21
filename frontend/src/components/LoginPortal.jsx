import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  QrCode,
  Users,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CalendarCheck,
  FileSpreadsheet,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  GraduationCap,
  UserCheck,
  Scan,
  Info
} from 'lucide-react';
import { Input, Button } from './ui';
import TeacherFaceScannerModal from './TeacherFaceScannerModal';
import loginBg from '../assets/login-bg.jpg';

/**
 * Dedicated, role-locked login portals for Sta. Rosa Elementary School.
 * Each portal (Faculty, Administrator, Learner) is accessed strictly by URL path:
 * - Faculty: /login/teacher (or /login)
 * - Admin: /login/admin
 * - Learner: /login/student
 *
 * Each portal has a distinct theme color, eyebrow badge, feature highlights,
 * and security policy notices to completely eliminate user confusion.
 */
const ROLE_CONFIGS = {
  teacher: {
    themeClass: 'sres-theme-teacher',
    apiRole: 'teacher',
    badge: 'Faculty & Class Adviser Portal',
    badgeIcon: GraduationCap,
    title: 'Faculty Sign In',
    subtitle: 'Sign in to manage classroom attendance & SF2 reports.',
    headline1: 'Smarter Attendance.',
    headline2: 'Better Learning.',
    pitch: 'Empowering educators with rapid QR attendance tracking, automated DepEd SF2 calculations, and real-time learner monitoring.',
    features: [
      {
        icon: QrCode,
        title: 'Rapid QR Scanning',
        desc: 'Fast, contact-free attendance in seconds during morning & afternoon sessions.'
      },
      {
        icon: Users,
        title: 'Section & Roster Control',
        desc: 'Multi-adviser class isolation for Grade 6 Great Geniuses sections.'
      },
      {
        icon: BarChart3,
        title: 'DepEd SF2 Analytics',
        desc: 'Official monthly attendance formulas, SARDO alerts, and instant Excel exports.'
      }
    ],
    trustTitle: 'Trusted by Sta. Rosa Elementary School',
    trustSubtitle: 'Safe • Secure • Reliable',
    trustIcon: ShieldCheck,
    usernameLabel: 'DepEd Email or Username',
    usernamePlaceholder: 'name@deped.gov.ph',
    btnText: 'Sign In to Faculty Portal',
    notice: 'For authorized DepEd teaching personnel only.',
    secondaryBtn: {
      text: 'Scan Face to Sign In',
      icon: Scan,
      action: 'faceModal'
    }
  },
  admin: {
    themeClass: 'sres-theme-admin',
    apiRole: 'admin',
    badge: 'Restricted Administration Console',
    badgeIcon: ShieldCheck,
    title: 'Administrator Sign In',
    subtitle: 'School Head & ICT Coordinator system management console.',
    headline1: 'System Integrity.',
    headline2: 'Total Governance.',
    pitch: 'Centralized administrative authority for Sta. Rosa Elementary School. Oversee faculty accounts, section assignments, and school-wide attendance audits.',
    features: [
      {
        icon: Users,
        title: 'Faculty & Section Oversight',
        desc: 'Provision teacher accounts, assign section advisers, and monitor access.'
      },
      {
        icon: KeyRound,
        title: 'Learner Account Provisioning',
        desc: 'Secure LRN credentials management and institutional audit logging.'
      },
      {
        icon: ShieldAlert,
        title: 'Institutional Compliance',
        desc: 'School-wide attendance compliance, DepEd division reporting, and backups.'
      }
    ],
    trustTitle: 'DepEd SRES Administration',
    trustSubtitle: 'Authorized Access Only • RA 10173 Compliant',
    trustIcon: ShieldAlert,
    usernameLabel: 'Administrator Username',
    usernamePlaceholder: 'Enter administrator username',
    btnText: 'Sign In to Admin Console',
    notice: 'Authorized personnel only. Administrative actions are recorded in the security audit log.',
    secondaryBtn: null
  },
  learner: {
    themeClass: 'sres-theme-learner',
    apiRole: 'student',
    badge: 'Learner Self Check-In Portal',
    badgeIcon: UserCheck,
    title: 'Learner Sign In',
    subtitle: 'Check in for class and view your personal attendance record.',
    headline1: 'Every Day Counts.',
    headline2: 'Never Miss Class.',
    pitch: 'Welcome Grade 6 Great Geniuses learners! Sign in to verify your daily attendance record and view your personal attendance QR badge.',
    features: [
      {
        icon: CalendarCheck,
        title: 'Classroom Self Check-In',
        desc: 'Confirm your daily attendance during scheduled class hours.'
      },
      {
        icon: QrCode,
        title: 'Personal QR Badge',
        desc: 'Access your unique learner QR badge for morning and afternoon scanning.'
      },
      {
        icon: FileSpreadsheet,
        title: 'Attendance History',
        desc: 'Check your monthly attendance stats and official records.'
      }
    ],
    trustTitle: 'Grade 6 Great Geniuses',
    trustSubtitle: 'Sta. Rosa Elementary School Learners',
    trustIcon: UserCheck,
    usernameLabel: 'Learner Username or LRN',
    usernamePlaceholder: 'Username given by your adviser',
    btnText: 'Sign In to Learner Portal',
    notice: 'Use the credentials provided by your class adviser. Do not share your password.',
    secondaryBtn: null
  }
};

export default function LoginPortal({ initialRole = 'teacher' }) {
  // Normalize role strictly based on route/prop (zero in-page role switching)
  const roleKey = initialRole === 'admin' ? 'admin' : (initialRole === 'learner' || initialRole === 'student' ? 'learner' : 'teacher');
  const cfg = ROLE_CONFIGS[roleKey];
  const BadgeIcon = cfg.badgeIcon;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isExpired = new URLSearchParams(location.search).get('expired');

  // Load remembered username if present for this role
  useEffect(() => {
    const saved = localStorage.getItem(`sres_remembered_${roleKey}`);
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    }
  }, [roleKey]);

  const redirectFor = (user) => {
    if (user.role === 'admin') return '/admin/dashboard';
    if (user.role === 'student') return '/student/portal';
    return '/teacher/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both your username and password.');
      return;
    }

    if (rememberMe) {
      localStorage.setItem(`sres_remembered_${roleKey}`, username.trim());
    } else {
      localStorage.removeItem(`sres_remembered_${roleKey}`);
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          expectedRole: cfg.apiRole
        })
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
    <div className={`sres-login-shell ${cfg.themeClass}`}>
      {/* ========================================================
          LEFT PANEL: Role-Themed Branding & Pitch
         ======================================================== */}
      <aside className="sres-login-brand">
        {/* School photo with role-specific gradient overlay */}
        <img
          src={loginBg}
          alt="Sta. Rosa Elementary School Campus"
          className="sres-login-brand-bg"
        />
        <div className="sres-login-brand-overlay" />

        {/* Soft decorative waves at bottom-left */}
        <svg
          className="sres-login-brand-waves"
          viewBox="0 0 500 220"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M-40 220 C120 180, 240 240, 520 170 L520 220 Z"
            fill="rgba(255, 255, 255, 0.05)"
          />
          <path
            d="M-20 220 C100 150, 260 210, 520 130 L520 220 Z"
            fill="rgba(255, 255, 255, 0.03)"
          />
        </svg>

        <div className="sres-login-brand-inner">
          {/* Top Logo Tile & School Masthead */}
          <div className="sres-login-brand-top">
            <div className="sres-login-logo-tile">
              <QrCode size={24} strokeWidth={2.4} />
            </div>
            <div>
              <div className="sres-login-brand-title">QR Attendance System</div>
              <div className="sres-login-brand-subtitle">Sta. Rosa Elementary School</div>
            </div>
          </div>

          {/* Center Brand Hero Headline & Pitch */}
          <div className="sres-login-brand-hero">
            <h1 className="sres-login-headline-1">{cfg.headline1}</h1>
            <h2 className="sres-login-headline-2">{cfg.headline2}</h2>
            <p className="sres-login-intro-p">{cfg.pitch}</p>

            {/* 3 Role-Tailored Features */}
            <ul className="sres-login-features">
              {cfg.features.map((feat, idx) => {
                const FeatIcon = feat.icon;
                return (
                  <li key={idx} className="sres-login-feature-item">
                    <div className="sres-login-feature-icon">
                      <FeatIcon size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <div className="sres-login-feature-title">{feat.title}</div>
                      <div className="sres-login-feature-desc">{feat.desc}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          </div>
      </aside>

      {/* ========================================================
          RIGHT PANEL: Role-Themed Login Card (Zero Switcher)
         ======================================================== */}
      <main className="sres-login-form-side">
        <div className="sres-login-card">
          {/* Card Top Logo Tile */}
          <div className="sres-login-card-brand">
            <div className="sres-login-card-logo-tile">
              <QrCode size={20} strokeWidth={2.4} />
            </div>
            <div>
              <div className="sres-login-card-app-name">QR Attendance System</div>
              <div className="sres-login-card-school-name">Sta. Rosa Elementary School</div>
            </div>
          </div>

          {/* Prominent Eyebrow Role Badge */}
          <div className="sres-login-role-badge">
            <BadgeIcon size={15} strokeWidth={2.4} />
            <span>{cfg.badge}</span>
          </div>

          {/* Title & Subtitle */}
          <h2 className="sres-login-card-title">{cfg.title}</h2>
          <p className="sres-login-card-subtitle">{cfg.subtitle}</p>

          {/* Session Expired Alert */}
          {isExpired && (
            <div className="sres-login-alert alert-warning" role="status">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {/* Validation / Authentication Error Alert */}
          {error && (
            <div className="sres-login-alert" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <Input
              id={`sres-${roleKey}-username`}
              label={cfg.usernameLabel}
              type="text"
              icon={User}
              placeholder={cfg.usernamePlaceholder}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />

            <Input
              id={`sres-${roleKey}-password`}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              rightElement={
                <button
                  type="button"
                  className="sres-login-reveal-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {/* Remember Me & Forgot Password Row */}
            <div className="sres-login-options-row">
              <label className="sres-login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="sres-login-forgot-link"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot password?
              </button>
            </div>

            {/* Primary Sign In Button */}
            <button
              id={`sres-${roleKey}-signin-btn`}
              type="submit"
              className="sres-login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <ArrowRight size={18} strokeWidth={2.4} />
                  <span>{cfg.btnText}</span>
                </>
              )}
            </button>

            {/* Secondary Action (Face Scanner Modal for Faculty) */}
            {cfg.secondaryBtn && (
              <>
                <div className="sres-login-divider">
                  <span>OR</span>
                </div>

                <button
                  id={`sres-${roleKey}-secondary-btn`}
                  type="button"
                  className="sres-login-qr-btn"
                  onClick={() => {
                    setError('');
                    setShowFaceModal(true);
                  }}
                >
                  <Scan size={18} strokeWidth={2.4} />
                  <span>{cfg.secondaryBtn.text}</span>
                </button>
              </>
            )}
          </form>

          {/* Footer Notice */}
          <div className="sres-login-footer-lock">
            <Lock size={13} style={{ flexShrink: 0 }} />
            <span>{cfg.notice}</span>
          </div>
        </div>
      </main>

      {/* ========================================================
          MODALS: Biometric Face Scanner & Assistance Dialogs
         ======================================================== */}
      {showFaceModal && roleKey === 'teacher' && (
        <TeacherFaceScannerModal
          isOpen={showFaceModal}
          onClose={() => setShowFaceModal(false)}
          mode="login"
          identifier={username}
          onSuccess={(data) => {
            setShowFaceModal(false);
            login(data.token, data.user);
            navigate(redirectFor(data.user));
          }}
        />
      )}

      {/* Forgot Password Information Modal */}
      {showForgotModal && (
        <div
          className="sres-login-info-modal-backdrop"
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="sres-login-info-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <div className="sres-login-info-modal-header">
              <div className="sres-login-info-modal-icon">
                <Info size={22} />
              </div>
              <h3 id="forgot-modal-title">Password Reset Assistance</h3>
            </div>
            <p>
              {roleKey === 'learner' ? (
                <>
                  Learner accounts are issued and managed by your class adviser.
                  Please ask your <strong>Class Adviser</strong> to check or reset your password.
                </>
              ) : roleKey === 'admin' ? (
                <>
                  Administrative access resets must be performed via the server console or by the
                  designated <strong>School Head / Lead ICT Coordinator</strong>.
                </>
              ) : (
                <>
                  In accordance with DepEd security and data privacy policies,
                  teacher password resets are managed locally.
                  Please contact your <strong>School Head</strong> or{' '}
                  <strong>ICT Coordinator</strong> to have your credentials securely reset.
                </>
              )}
            </p>
            <div className="sres-login-info-modal-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowForgotModal(false)}
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
