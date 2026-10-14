import React, { useState, useEffect } from 'react';
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
  ArrowRight 
} from 'lucide-react';

export default function LoginPortal({ initialRole = 'teacher' }) {
  const [role, setRole] = useState(initialRole); // 'teacher' | 'learner' | 'admin'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isExpired = new URLSearchParams(location.search).get('expired');

  // Sync role if props change
  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);

  // Reset error when switching role
  const handleRoleChange = (newRole) => {
    if (newRole === role) return;
    setRole(newRole);
    setError('');
  };

  const portalConfig = {
    teacher: {
      title: 'Teacher Login',
      subtitle: 'Daily Attendance & Student Records',
      color: 'var(--primary, #880e4f)',
      gradient: 'linear-gradient(135deg, #880e4f 0%, #c2185b 100%)',
      btnBg: 'linear-gradient(135deg, #880e4f 0%, #c2185b 100%)',
      badgeBg: '#fce4ec',
      badgeColor: '#880e4f',
      bgGradient: 'linear-gradient(135deg, #2a0818 0%, #4a0e2e 50%, #880e4f 100%)',
      icon: <GraduationCap size={28} />,
      usernamePlaceholder: 'Enter teacher username',
      btnText: 'Sign In as Teacher',
      defaultCreds: 'teacher / teacher123'
    },
    learner: {
      title: 'Learner Login',
      subtitle: 'Self Check-In & Personal Records',
      color: '#0284c7',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)',
      btnBg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      badgeBg: '#e0f2fe',
      badgeColor: '#0369a1',
      bgGradient: 'linear-gradient(135deg, #02203c 0%, #034870 50%, #0284c7 100%)',
      icon: <UserCheck size={28} />,
      usernamePlaceholder: 'Enter learner username',
      btnText: 'Sign In as Learner',
      defaultCreds: 'student / student123'
    },
    admin: {
      title: 'Administrator Login',
      subtitle: 'System Settings & User Management',
      color: '#311042',
      gradient: 'linear-gradient(135deg, #311042 0%, #4338ca 100%)',
      btnBg: 'linear-gradient(135deg, #311042 0%, #4338ca 100%)',
      badgeBg: '#f3e8ff',
      badgeColor: '#581c87',
      bgGradient: 'linear-gradient(135deg, #130924 0%, #250b38 50%, #4338ca 100%)',
      icon: <ShieldCheck size={28} />,
      usernamePlaceholder: 'Enter admin username',
      btnText: 'Sign In as Admin',
      defaultCreds: 'admin / admin123'
    }
  };

  const current = portalConfig[role] || portalConfig.teacher;

  // Tab sliding pill position
  const getPillTransform = () => {
    if (role === 'teacher') return 'translateX(0%)';
    if (role === 'learner') return 'translateX(100%)';
    return 'translateX(200%)';
  };

  const getPillBg = () => {
    if (role === 'teacher') return 'var(--primary, #880e4f)';
    if (role === 'learner') return '#0284c7';
    return '#311042';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (response.ok && data.token && data.user) {
        // Enforce role validation if user logged in via specific portal
        if (role === 'admin' && data.user.role !== 'admin') {
          setError('Access restricted: This portal is for Administrators only. Please select the Teacher or Learner portal.');
          setLoading(false);
          return;
        }

        login(data.token, data.user);

        // Redirect based on actual authenticated role
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else if (data.user.role === 'student') {
          navigate('/student-portal');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(data.error || 'Invalid username or password.');
      }
    } catch (err) {
      setError('Cannot connect to the server. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="login-card-container"
      style={{ background: current.bgGradient }}
    >
      <div className="login-auth-card">
        {/* Top 3-Way Tab Switcher */}
        <div>
          <div className="login-tab-switcher">
            {/* Sliding Pill Indicator */}
            <div 
              className="login-tab-pill" 
              style={{ 
                transform: getPillTransform(),
                background: getPillBg()
              }} 
            />

            <button
              type="button"
              className="login-tab-btn"
              onClick={() => handleRoleChange('teacher')}
              style={{ color: role === 'teacher' ? '#ffffff' : '#64748b' }}
            >
              <GraduationCap size={15} />
              <span>Teacher</span>
            </button>

            <button
              type="button"
              className="login-tab-btn"
              onClick={() => handleRoleChange('learner')}
              style={{ color: role === 'learner' ? '#ffffff' : '#64748b' }}
            >
              <UserCheck size={15} />
              <span>Learner</span>
            </button>

            <button
              type="button"
              className="login-tab-btn"
              onClick={() => handleRoleChange('admin')}
              style={{ color: role === 'admin' ? '#ffffff' : '#64748b' }}
            >
              <ShieldCheck size={15} />
              <span>Admin</span>
            </button>
          </div>

          {/* Animated Header Section (Exact same height across all 3 portals) */}
          <div key={role} className="login-animated-content" style={{ textAlign: 'center', minHeight: '142px' }}>
            {/* Icon Avatar */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: current.gradient,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
              marginBottom: '10px',
              transition: 'all 0.3s ease'
            }}>
              {current.icon}
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#1e293b',
              letterSpacing: '-0.02em',
              margin: '0 0 2px 0'
            }}>
              {current.title}
            </h1>

            {/* Subtitle */}
            <p style={{
              color: '#64748b',
              fontSize: '0.78rem',
              fontWeight: 500,
              margin: '0 0 6px 0',
              height: '18px'
            }}>
              {current.subtitle}
            </p>

            {/* Section Pill (Identical height for all 3 portals) */}
            <div style={{
              padding: '3px 10px',
              background: current.badgeBg,
              color: current.badgeColor,
              borderRadius: '10px',
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: 700
            }}>
              Sta. Rosa ES • Grade 6 Great Geniuses
            </div>
          </div>
        </div>

        {/* Form Body Area */}
        <div style={{ marginTop: '12px' }}>
          {isExpired && (
            <div className="alert alert-warning" style={{ fontSize: '0.78rem', marginBottom: '14px', padding: '8px 12px' }}>
              <AlertCircle size={15} />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ fontSize: '0.78rem', marginBottom: '14px', padding: '8px 12px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" htmlFor="portal-username" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {role === 'learner' ? 'Learner Username or Email' : role === 'admin' ? 'Admin Username or Email' : 'Teacher Username or Email'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="portal-username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', height: '44px', fontSize: '0.88rem' }}
                  placeholder={current.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="portal-password" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="portal-password"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '36px', height: '44px', fontSize: '0.88rem' }}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <button
              type="submit"
              className="btn"
              style={{
                width: '100%',
                height: '46px',
                fontSize: '0.92rem',
                fontWeight: 700,
                background: current.btnBg,
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.2s ease'
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>{current.btnText}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Area with Consistent Fixed Height */}
        <div style={{
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: '0.76rem',
          color: '#64748b',
          minHeight: '38px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div>
            Default Credentials: <strong style={{ color: current.color }}>{current.defaultCreds}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
