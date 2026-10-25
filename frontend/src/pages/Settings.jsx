import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Sliders, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  UserPlus, 
  Save, 
  CheckCircle, 
  AlertCircle,
  Navigation,
  Building,
  Palette,
  Laptop,
  QrCode,
  ShieldAlert,
  Bell,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Info,
  Calendar,
  Check,
  Eye,
  EyeOff,
  Send,
  Smartphone,
  Wifi,
  Scan,
  UserCheck,
  KeyRound,
  Lock
} from 'lucide-react';
import {
  PageTitle,
  Card,
  SectionCard,
  Button,
  StatusBadge
} from '../components/ui';

const HARDCODED_TEXTBEE_API_KEY = 'txb_qQDnUgyok84rrtJJ1kG8qkZMwWGt0wNT';
const HARDCODED_TEXTBEE_DEVICE_ID = '6ad7fcb9ab534081692d485f';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { theme, changeTheme, themes } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'admin_credentials' || tabParam === 'security' || tabParam === 'credentials') {
      return 'admin_credentials';
    }
    return 'classroom';
  });

  const [adminCreds, setAdminCreds] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminAlert, setAdminAlert] = useState(null);

  const [settings, setSettings] = useState(() => {
    let initial = {
      gps_enabled: '0',
      attendance_mode: 'onsite',
      room_name: 'Room 101 - Grade 6 Great Geniuses',
      qr_code_type: 'fixed',
      attendance_theme: 'rose',
      block_unenrolled: '1',
      geofence_radius_m: '100',
      school_latitude: '',
      school_longitude: '',
      school_start: '08:00',
      late_after: '08:00',
      attendance_deadline: '16:00',
      absence_threshold: '5',
      qr_enabled: '1',
      qr_start: '',
      qr_end: '',
      sms_enabled: '0',
      sms_notify_present: '1',
      sms_provider: 'textbee',
      textbee_api_key: HARDCODED_TEXTBEE_API_KEY,
      textbee_device_id: HARDCODED_TEXTBEE_DEVICE_ID,
      philsms_api_token: '',
      philsms_sender_id: 'PhilSMS',
      android_gateway_url: '',
      android_gateway_key: '',
      semaphore_api_key: '',
      sms_sender_name: '',
      twilio_account_sid: '',
      twilio_auth_token: '',
      twilio_phone_number: '',
      student_face_verification: '1',
      scanner_verification_mode: 'both'
    };
    try {
      const cached = localStorage.getItem('sres_saved_settings');
      if (cached) {
        initial = { ...initial, ...JSON.parse(cached) };
      }
    } catch (e) {}
    return initial;
  });

  const [initialSettings, setInitialSettings] = useState(null);
  const [students, setStudents] = useState([]);
  const [accountData, setAccountData] = useState({ student_id: '', username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [accountAlert, setAccountAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testingSms, setTestingSms] = useState(false);
  const [showTextbeeKey, setShowTextbeeKey] = useState(false);

  const handleTestSMS = async () => {
    if (!testPhone.trim()) {
      setTestResult({ error: 'Please enter a Philippine mobile phone number to test (e.g. 09171234567).' });
      return;
    }
    setTestingSms(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/sms/test', {
        method: 'POST',
        body: JSON.stringify({
          phone: testPhone.trim(),
          provider: 'textbee',
          textbeeApiKey: settings.textbee_api_key || HARDCODED_TEXTBEE_API_KEY,
          textbeeDeviceId: settings.textbee_device_id || HARDCODED_TEXTBEE_DEVICE_ID
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: data.message, contact: data.contact, provider: 'textbee' });
      } else {
        setTestResult({ error: data.error || 'Failed to send test SMS.' });
      }
    } catch (err) {
      setTestResult({ error: 'Network error connecting to SMS test endpoint.' });
    } finally {
      setTestingSms(false);
    }
  };

  const loadData = async () => {
    try {
      const [setRes, stRes] = await Promise.all([
        apiFetch('/api/settings'),
        apiFetch('/api/students')
      ]);

      if (setRes.ok) {
        const data = await setRes.json();
        const merged = {
          ...data,
          textbee_api_key: data.textbee_api_key || HARDCODED_TEXTBEE_API_KEY,
          textbee_device_id: data.textbee_device_id || HARDCODED_TEXTBEE_DEVICE_ID
        };
        setSettings(prev => ({ ...prev, ...merged }));
        setInitialSettings(merged);
        try {
          localStorage.setItem('sres_saved_settings', JSON.stringify(merged));
          if (merged.attendance_theme) {
            localStorage.setItem('attendance_theme', merged.attendance_theme);
          }
        } catch (e) {}
      } else {
        try {
          const cached = localStorage.getItem('sres_saved_settings');
          if (cached) {
            const parsed = JSON.parse(cached);
            setSettings(prev => ({ ...prev, ...parsed }));
            setInitialSettings(parsed);
          }
        } catch (e) {}
      }
      if (stRes.ok) {
        const studentsList = await stRes.json();
        setStudents(studentsList);
        if (studentsList.length > 0) {
          setAccountData(prev => ({ ...prev, student_id: String(studentsList[0].id) }));
        }
      }

      if (isAdmin) {
        try {
          const meRes = await apiFetch('/api/auth/me');
          if (meRes.ok) {
            const meData = await meRes.json();
            setAdminCreds(prev => ({
              ...prev,
              full_name: meData.full_name || prev.full_name,
              username: meData.username || prev.username,
              email: meData.email || prev.email
            }));
          }
        } catch (meErr) {
          console.warn('Notice loading current user profile in settings:', meErr);
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'admin_credentials' || tabParam === 'security' || tabParam === 'credentials') {
      setActiveTab('admin_credentials');
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'admin_credentials') {
      setSearchParams({ tab: 'admin_credentials' });
    } else {
      setSearchParams({});
    }
  };

  const isDirty = initialSettings && JSON.stringify(settings) !== JSON.stringify({ ...settings, ...initialSettings });

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...settings,
        textbee_api_key: settings.textbee_api_key || HARDCODED_TEXTBEE_API_KEY,
        textbee_device_id: settings.textbee_device_id || HARDCODED_TEXTBEE_DEVICE_ID
      };

      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const finalData = {
          ...data,
          textbee_api_key: data.textbee_api_key || HARDCODED_TEXTBEE_API_KEY,
          textbee_device_id: data.textbee_device_id || HARDCODED_TEXTBEE_DEVICE_ID
        };
        showAlert('Attendance policies and classroom settings saved permanently!');
        setSettings(prev => ({ ...prev, ...finalData }));
        setInitialSettings({ ...finalData });

        // Permanently persist to localStorage so settings are retained even after logging out
        try {
          localStorage.setItem('sres_saved_settings', JSON.stringify(finalData));
          if (finalData.attendance_theme) {
            localStorage.setItem('attendance_theme', finalData.attendance_theme);
          }
        } catch (storageErr) {}

        if (finalData.attendance_theme && finalData.attendance_theme !== theme) {
          changeTheme(finalData.attendance_theme);
        }
      } else {
        const err = await response.json();
        showAlert(err.error || 'Failed to save settings.', 'error');
      }
    } catch (err) {
      showAlert('Network error saving settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      showAlert('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings(prev => ({
          ...prev,
          school_latitude: String(pos.coords.latitude.toFixed(6)),
          school_longitude: String(pos.coords.longitude.toFixed(6))
        }));
        showAlert(`Location acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setGpsLoading(false);
      },
      () => {
        showAlert('Could not access current location. Please allow GPS permissions in your browser.', 'error');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleCreateStudentAccount = async (e) => {
    e.preventDefault();
    if (!accountData.student_id || !accountData.username || !accountData.password) {
      setAccountAlert({ message: 'All student account fields are required.', type: 'error' });
      return;
    }

    setCreatingAccount(true);
    setAccountAlert(null);
    try {
      const response = await apiFetch('/api/student-account/create', {
        method: 'POST',
        body: JSON.stringify({
          student_id: parseInt(accountData.student_id, 10),
          username: accountData.username.trim(),
          password: accountData.password
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAccountAlert({ 
          message: `Student portal credentials created for "${accountData.username}"! Learner can now sign in at the Student Portal.`, 
          type: 'success' 
        });
        setAccountData(prev => ({ ...prev, username: '', password: '' }));
      } else {
        setAccountAlert({ message: data.error || 'Failed to create student account.', type: 'error' });
      }
    } catch (err) {
      setAccountAlert({ message: 'Network error creating student account.', type: 'error' });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleUpdateAdminCredentials = async (e) => {
    e.preventDefault();
    setAdminAlert(null);

    if (!adminCreds.current_password) {
      setAdminAlert({ message: 'Current master password is required to verify your authorization.', type: 'error' });
      return;
    }

    if (!adminCreds.username.trim()) {
      setAdminAlert({ message: 'Administrator username cannot be blank.', type: 'error' });
      return;
    }

    if (!adminCreds.full_name.trim()) {
      setAdminAlert({ message: 'Administrator full name / display title cannot be blank.', type: 'error' });
      return;
    }

    if (adminCreds.new_password) {
      if (adminCreds.new_password.length < 6) {
        setAdminAlert({ message: 'New master password must be at least 6 characters long.', type: 'error' });
        return;
      }
      if (adminCreds.new_password !== adminCreds.confirm_password) {
        setAdminAlert({ message: 'New master password and confirmation password do not match.', type: 'error' });
        return;
      }
    }

    setAdminSaving(true);
    try {
      const response = await apiFetch('/api/auth/admin-credentials', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: adminCreds.current_password,
          username: adminCreds.username.trim(),
          full_name: adminCreds.full_name.trim(),
          email: adminCreds.email ? adminCreds.email.trim() : null,
          new_password: adminCreds.new_password || undefined,
          confirm_password: adminCreds.confirm_password || undefined
        })
      });

      const data = await response.json();
      if (response.ok) {
        if (updateUser) {
          updateUser(data.token, data.user);
        }

        setAdminAlert({
          message: data.message || 'Administrator log in credentials updated successfully!',
          type: 'success'
        });

        setAdminCreds(prev => ({
          ...prev,
          full_name: data.user?.full_name || prev.full_name,
          username: data.user?.username || prev.username,
          email: data.user?.email || '',
          current_password: '',
          new_password: '',
          confirm_password: ''
        }));
      } else {
        setAdminAlert({
          message: data.error || 'Failed to update administrator credentials.',
          type: 'error'
        });
      }
    } catch (err) {
      setAdminAlert({
        message: 'Network error connecting to credentials service.',
        type: 'error'
      });
    } finally {
      setAdminSaving(false);
    }
  };

  // Helper format time for timeline preview
  const formatTime12 = (time24) => {
    if (!time24) return '--:--';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  return (
    <div className="sres-settings-page">
      {/* 1. Page Header with Tag and Status chips */}
      <PageTitle
        title="Settings & Policies"
        emoji="⚙️"
        tag={settings.room_name || 'Room 101 - Grade 6 Great Geniuses'}
        icon={Sliders}
        action={
          <div className="hud-chips" style={{ margin: 0 }}>
            <span className={`hud-chip ${settings.attendance_mode === 'flipped' ? 'active-flipped' : 'active-onsite'}`}>
              {settings.attendance_mode === 'flipped' ? <Laptop size={13} strokeWidth={2} /> : <MapPin size={13} strokeWidth={2} />}
              <span>{settings.attendance_mode === 'flipped' ? 'Online Mode' : 'Onsite Mode'}</span>
            </span>

            <span className="hud-chip">
              <Clock size={13} strokeWidth={2} />
              <span>Bell: {formatTime12(settings.school_start)}</span>
            </span>

            {settings.late_after && settings.late_after !== settings.school_start ? (
              <span className="hud-chip" style={{ color: '#d97706', borderColor: '#fef3c7', background: '#fffbeb' }}>
                <Clock size={13} strokeWidth={2} />
                <span>Late After: {formatTime12(settings.late_after)}</span>
              </span>
            ) : (
              <span className="hud-chip">
                <Clock size={13} strokeWidth={2} />
                <span>Cutoff: {formatTime12(settings.attendance_deadline || '16:00')}</span>
              </span>
            )}
          </div>
        }
      />

      {alert && (
        <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Human-Centered Category Tabs */}
      <nav className="settings-tab-bar" aria-label="Settings Categories">
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'classroom' ? 'active' : ''}`}
          onClick={() => handleTabChange('classroom')}
        >
          <Building size={16} />
          <span>Classroom & Mode</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => handleTabChange('schedule')}
        >
          <Clock size={16} />
          <span>Daily Bell Schedule</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'geofence' ? 'active' : ''}`}
          onClick={() => handleTabChange('geofence')}
        >
          <MapPin size={16} />
          <span>Campus Geofence</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => handleTabChange('notifications')}
        >
          <Bell size={16} />
          <span>Scanner & SMS</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => handleTabChange('appearance')}
        >
          <Palette size={16} />
          <span>Theme & Appearance</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'student_portal' ? 'active' : ''}`}
          onClick={() => handleTabChange('student_portal')}
        >
          <UserPlus size={16} />
          <span>Student Logins</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'admin_credentials' ? 'active' : ''}`}
            onClick={() => handleTabChange('admin_credentials')}
          >
            <ShieldCheck size={16} />
            <span>Admin Credentials</span>
          </button>
        )}
      </nav>

      {/* ========================================================
          TAB 1: CLASSROOM & LEARNING MODE
          ======================================================== */}
      {activeTab === 'classroom' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Building size={20} />
                <span>Classroom Assignment & Learning Mode</span>
              </h2>
              <p className="card-subtitle">
                Specify your designated room and choose between Onsite or Online Mode attendance policies.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Designated Room & Section Name *
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Room 101 - Grade 6 Great Geniuses"
              value={settings.room_name || ''}
              onChange={(e) => setSettings({ ...settings, room_name: e.target.value })}
              required
            />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Displayed on the QR scanner banner, live teacher dashboard, and recorded with every attendance mark.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {/* Onsite Mode Card */}
            <div
              onClick={() => setSettings({ ...settings, attendance_mode: 'onsite' })}
              style={{
                border: settings.attendance_mode === 'onsite' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: settings.attendance_mode === 'onsite' ? 'var(--primary-light)' : '#ffffff',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#1e293b' }}>Onsite Classroom Mode</div>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>Standard School Grounds</div>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Learners are required to be physically present at school. If GPS geofencing is enabled, location coordinates are strictly verified.
              </p>
              {settings.attendance_mode === 'onsite' && (
                <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                  ✓
                </div>
              )}
            </div>

            {/* Online Mode Card */}
            <div
              onClick={() => setSettings({ ...settings, attendance_mode: 'flipped' })}
              style={{
                border: settings.attendance_mode === 'flipped' ? '2px solid #0284c7' : '1px solid var(--border)',
                background: settings.attendance_mode === 'flipped' ? '#e0f2fe' : '#ffffff',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Laptop size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#1e293b' }}>Online Mode</div>
                  <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700 }}>Remote / Home Learning</div>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Allows learners to mark attendance remotely from home via self-check in. GPS geofence checks are automatically waived.
              </p>
              {settings.attendance_mode === 'flipped' && (
                <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                  ✓
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Enrollment & Security Safeguards
            </h3>

            {/* Enrollment Gating Toggle Card */}
            <div className="settings-option-card">
              <div className="settings-option-info">
                <div className="settings-option-icon">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <div className="settings-option-title">Strict Enrollment Gating</div>
                  <div className="settings-option-desc">
                    Only learners marked as "Officially Enrolled" may record attendance. Unenrolled, transferred-out, or dropped learners are automatically blocked.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.block_unenrolled !== '0'}
                onChange={(e) => setSettings({ ...settings, block_unenrolled: e.target.checked ? '1' : '0' })}
                style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            </div>

            {/* QR Code Architecture Card */}
            <div className="settings-option-card">
              <div className="settings-option-info">
                <div className="settings-option-icon">
                  <QrCode size={20} />
                </div>
                <div>
                  <div className="settings-option-title">QR Code Token Policy</div>
                  <div className="settings-option-desc">
                    Choose how QR codes are assigned to students for physical ID cards or mobile check-in.
                  </div>
                </div>
              </div>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '220px', fontSize: '0.84rem' }}
                value={settings.qr_code_type || 'fixed'}
                onChange={(e) => setSettings({ ...settings, qr_code_type: e.target.value })}
              >
                <option value="fixed">Fixed Permanent ID (Standard Badges)</option>
                <option value="dynamic">Dynamic QR (Daily Rolling Tokens)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: DAILY BELL SCHEDULE & CUTOFFS
          ======================================================== */}
      {activeTab === 'schedule' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Clock size={20} />
                <span>Daily Attendance Timeline & Cutoffs</span>
              </h2>
              <p className="card-subtitle">
                Configure your school's daily schedule. The visual flowchart below represents how attendance statuses transition throughout the day.
              </p>
            </div>
          </div>

          {/* Visual Daily Timeline Flowchart */}
          <div className="timeline-strip">
            {/* Step 1: Morning Bell */}
            <div className="timeline-step-card">
              <div>
                <div className="timeline-step-header">
                  <span className="timeline-step-badge start">Step 1 • On-Time</span>
                  <Clock size={16} style={{ color: '#16a34a' }} />
                </div>
                <div className="timeline-step-title">Morning Bell / Class Starts</div>
                <div className="timeline-step-desc">
                  Learners scanning before or at this time are marked <strong>Present (Green)</strong>.
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Start Time</label>
                <input
                  type="time"
                  className="form-input"
                  style={{ fontWeight: 700, fontSize: '1rem' }}
                  value={settings.school_start || '08:00'}
                  onChange={(e) => setSettings({ ...settings, school_start: e.target.value })}
                />
              </div>
            </div>

            {/* Step 2: Late Cutoff */}
            <div className="timeline-step-card">
              <div>
                <div className="timeline-step-header">
                  <span className="timeline-step-badge late">Step 2 • Late</span>
                  <Clock size={16} style={{ color: '#d97706' }} />
                </div>
                <div className="timeline-step-title">Mark Late After</div>
                <div className="timeline-step-desc">
                  Scans after this cutoff are flagged as <strong>Late (Yellow)</strong> on SF2.
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Late Threshold</label>
                <input
                  type="time"
                  className="form-input"
                  style={{ fontWeight: 700, fontSize: '1rem' }}
                  value={settings.late_after || '08:00'}
                  onChange={(e) => setSettings({ ...settings, late_after: e.target.value })}
                />
              </div>
            </div>

            {/* Step 3: Daily Cutoff */}
            <div className="timeline-step-card">
              <div>
                <div className="timeline-step-header">
                  <span className="timeline-step-badge cutoff">Step 3 • Absent</span>
                  <Clock size={16} style={{ color: '#dc2626' }} />
                </div>
                <div className="timeline-step-title">Daily Absence Deadline</div>
                <div className="timeline-step-desc">
                  Attendance closes. Unrecorded learners are marked <strong>Absent (Red)</strong>.
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Closing Time</label>
                <input
                  type="time"
                  className="form-input"
                  style={{ fontWeight: 700, fontSize: '1rem' }}
                  value={settings.attendance_deadline || '16:00'}
                  onChange={(e) => setSettings({ ...settings, attendance_deadline: e.target.value })}
                />
              </div>
            </div>

            {/* Step 4: SARDO Drop-Risk */}
            <div className="timeline-step-card">
              <div>
                <div className="timeline-step-header">
                  <span className="timeline-step-badge sardo">SARDO Alert</span>
                  <ShieldAlert size={16} style={{ color: '#9333ea' }} />
                </div>
                <div className="timeline-step-title">Consecutive Absence Alert</div>
                <div className="timeline-step-desc">
                  Students at Risk of Dropping Out (SARDO) alert dispatched to parents.
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Threshold (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="form-input"
                  style={{ fontWeight: 700, fontSize: '1rem' }}
                  value={settings.absence_threshold || '5'}
                  onChange={(e) => setSettings({ ...settings, absence_threshold: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface-gradient, #f8fafc)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong>DepEd SF2 Rule:</strong> Learners arriving between <strong>{formatTime12(settings.school_start)}</strong> and <strong>{formatTime12(settings.attendance_deadline)}</strong> receive an official Late record. Unscanned learners by <strong>{formatTime12(settings.attendance_deadline)}</strong> receive a Full-Day Absent (X) mark.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: CAMPUS GPS GEOFENCING
          ======================================================== */}
      {activeTab === 'geofence' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <MapPin size={20} />
                <span>Campus GPS Geofencing</span>
              </h2>
              <p className="card-subtitle">
                Ensure learners are physically within school grounds when scanning attendance in Onsite mode.
              </p>
            </div>
          </div>

          {/* Smart Flipped Mode Alert */}
          {settings.attendance_mode === 'flipped' && (
            <div className="alert alert-info" style={{ marginBottom: '18px' }}>
              <Laptop size={18} />
              <div>
                <strong>Online Mode is currently active!</strong>
                <div style={{ fontSize: '0.74rem', marginTop: '2px' }}>
                  Learners are allowed to mark attendance remotely. GPS geofence restrictions are temporarily waived to prevent location errors for students at home.
                </div>
              </div>
            </div>
          )}

          {/* Master GPS Toggle */}
          <div className="settings-option-card">
            <div className="settings-option-info">
              <div className="settings-option-icon">
                <Navigation size={20} />
              </div>
              <div>
                <div className="settings-option-title">Enforce Campus Geofence</div>
                <div className="settings-option-desc">
                  Rejects scans if the student's device coordinates are outside the allowed campus radius.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.gps_enabled === '1'}
              onChange={(e) => setSettings({ ...settings, gps_enabled: e.target.checked ? '1' : '0' })}
              style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {settings.gps_enabled === '1' ? (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">School Latitude</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 16.041797"
                    value={settings.school_latitude || ''}
                    onChange={(e) => setSettings({ ...settings, school_latitude: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">School Longitude</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 120.752017"
                    value={settings.school_longitude || ''}
                    onChange={(e) => setSettings({ ...settings, school_longitude: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Allowed Perimeter Radius (Meters)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="100"
                    value={settings.geofence_radius_m || '100'}
                    onChange={(e) => setSettings({ ...settings, geofence_radius_m: e.target.value })}
                  />

                  {/* Radius Preset Chips */}
                  <div className="radius-chip-row">
                    <button
                      type="button"
                      className={`radius-chip ${settings.geofence_radius_m === '50' ? 'active' : ''}`}
                      onClick={() => setSettings({ ...settings, geofence_radius_m: '50' })}
                    >
                      50m (Classroom only)
                    </button>
                    <button
                      type="button"
                      className={`radius-chip ${settings.geofence_radius_m === '100' ? 'active' : ''}`}
                      onClick={() => setSettings({ ...settings, geofence_radius_m: '100' })}
                    >
                      100m (Standard Grounds)
                    </button>
                    <button
                      type="button"
                      className={`radius-chip ${settings.geofence_radius_m === '250' ? 'active' : ''}`}
                      onClick={() => setSettings({ ...settings, geofence_radius_m: '250' })}
                    >
                      250m (Wide Campus)
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={useCurrentLocation}
                disabled={gpsLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Navigation size={14} className={gpsLoading ? 'animate-spin' : ''} />
                <span>{gpsLoading ? 'Acquiring GPS...' : 'Set Coordinates to My Current Device Location'}</span>
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              GPS boundary checks are currently disabled. Gate cameras and student PIN entries will record attendance without distance checks.
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: SCANNER & SMS AUTOMATION
          ======================================================== */}
      {activeTab === 'notifications' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Bell size={20} />
                <span>Scanner HUD & Parent SMS Notifications</span>
              </h2>
              <p className="card-subtitle">
                Manage automated SMS dispatching to guardians and configure gate scanner validity windows.
              </p>
            </div>
          </div>

          {/* Gate Scanner Active Card */}
          <div className="settings-option-card">
            <div className="settings-option-info">
              <div className="settings-option-icon">
                <QrCode size={20} />
              </div>
              <div>
                <div className="settings-option-title">Gate Camera Scanner Active</div>
                <div className="settings-option-desc">
                  Enables camera-based QR code scanning at the gate or classroom entrance.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.qr_enabled !== '0'}
              onChange={(e) => setSettings({ ...settings, qr_enabled: e.target.checked ? '1' : '0' })}
              style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Scanner Verification Mode Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="var(--primary)" />
                  <span>Default Scanner Verification Mode</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Select the default verification workflow when opening the attendance scanner. You can also toggle this live on the scanner.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {/* Option 1: Both (QR + Face 2FA) */}
              <div 
                onClick={() => setSettings({ ...settings, scanner_verification_mode: 'both' })}
                style={{
                  border: (settings.scanner_verification_mode || 'both') === 'both' ? '2px solid #7c3aed' : '1.5px solid var(--border)',
                  background: (settings.scanner_verification_mode || 'both') === 'both' ? 'rgba(124, 58, 237, 0.06)' : 'var(--bg-card-subtle)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldCheck size={18} color="#7c3aed" />
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>Both: QR + Face (2FA)</strong>
                  <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 6px', marginLeft: 'auto' }}>Recommended</span>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Requires scanning student QR code <strong>and</strong> matching their face via camera. Completely prevents proxy attendance.
                </p>
              </div>

              {/* Option 2: Face Recognition Only */}
              <div 
                onClick={() => setSettings({ ...settings, scanner_verification_mode: 'face' })}
                style={{
                  border: settings.scanner_verification_mode === 'face' ? '2px solid #0284c7' : '1.5px solid var(--border)',
                  background: settings.scanner_verification_mode === 'face' ? 'rgba(2, 132, 199, 0.06)' : 'var(--bg-card-subtle)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <UserCheck size={18} color="#0284c7" />
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>Face Recognition Only</strong>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Touchless & contactless. Camera detects and recognizes students directly by face. No printed QR card needed.
                </p>
              </div>

              {/* Option 3: QR Code Only */}
              <div 
                onClick={() => setSettings({ ...settings, scanner_verification_mode: 'qr' })}
                style={{
                  border: settings.scanner_verification_mode === 'qr' ? '2px solid #059669' : '1.5px solid var(--border)',
                  background: settings.scanner_verification_mode === 'qr' ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-card-subtle)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <QrCode size={18} color="#059669" />
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>QR Code Only</strong>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                  Fast barcode-only scanning. Face recognition is completely disabled. Suitable for dim lighting or low-power devices.
                </p>
              </div>
            </div>
          </div>

          {/* Automated SMS Alerts Card */}
          <div className="settings-option-card">
            <div className="settings-option-info">
              <div className="settings-option-icon" style={{ background: '#fce4ec', color: '#c2185b' }}>
                <MessageSquare size={20} />
              </div>
              <div>
                <div className="settings-option-title">Automated Parent SMS Alerts</div>
                <div className="settings-option-desc">
                  Automatically dispatches SMS notifications to the guardian's contact number when a student is recorded Present, Late, Absent, or reaches 5 consecutive absences (SARDO alert).
                </div>
              </div>
            </div>
            {isAdmin ? (
              <input
                type="checkbox"
                checked={settings.sms_enabled === '1'}
                onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked ? '1' : '0' })}
                style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            ) : (
              <span className={`badge ${settings.sms_enabled === '1' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                {settings.sms_enabled === '1' ? '✓ Active (Admin Configured)' : 'Disabled by Admin'}
              </span>
            )}
          </div>

          {/* TEACHER VIEW: Read-Only Info Card (No configuration options) */}
          {!isAdmin && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#fce4ec', color: '#c2185b', padding: '10px', borderRadius: '10px', display: 'flex' }}>
                  <Smartphone size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    TextBee SMS Gateway (Managed by School Administrator)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Automated guardian notifications for late arrivals, absences, and drop risks are sent through the school's central <strong>TextBee Android Gateway</strong>.
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px dashed var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${settings.textbee_api_key ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.74rem' }}>
                    {settings.textbee_api_key ? '✓ Gateway Configured & Active' : '⚠ Gateway Awaiting Administrator Setup'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Provider: <strong>TextBee (Free Android SIM Gateway)</strong>
                  </span>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  SMS gateway credentials and phone linking are managed exclusively in the Administrator portal.
                </span>
              </div>
            </div>
          )}

          {/* ADMINISTRATOR VIEW: Full TextBee Gateway Setup & Live Tester (Visible when SMS alerts are enabled) */}
          {isAdmin && settings.sms_enabled === '1' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Smartphone size={18} color="var(--primary)" />
                        <span>TextBee SMS Gateway Configuration</span>
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', marginBottom: 0 }}>
                        Central school SMS gateway. Uses an Android smartphone with a Philippine SIM (unli-text promo) to send free parent alerts.
                      </p>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                      100% Free • Unlimited SIM SMS
                    </span>
                  </div>

                  {/* TextBee Setup Guide Box */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '18px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={16} color="var(--primary)" />
                        <span>How to Connect TextBee (3 Steps)</span>
                      </strong>
                      <a 
                        href="https://textbee.dev" 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      >
                        <span>textbee.dev</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '0.78rem', color: '#475569', lineHeight: 1.6 }}>
                      <li>Sign up for a free account at <a href="https://textbee.dev" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700 }}>textbee.dev</a>.</li>
                      <li>Install the free TextBee app on an Android phone loaded with a Philippine SIM (Globe, TM, Smart, TNT, or DITO with an unli-text promo).</li>
                      <li>Scan the QR code in the app to link your phone, then copy your <strong>API Key</strong> and paste it below.</li>
                    </ol>
                  </div>

                  {/* Form Grid for TextBee Credentials */}
                  <div className="form-grid" style={{ marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">
                        <span>TextBee API Key *</span>
                        <span className="badge badge-success" style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '1px 6px' }}>Hardcoded Default</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showTextbeeKey ? 'text' : 'password'}
                          className="form-input"
                          placeholder={`Hardcoded: ${HARDCODED_TEXTBEE_API_KEY}`}
                          value={settings.textbee_api_key || ''}
                          onChange={(e) => setSettings({ ...settings, textbee_api_key: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowTextbeeKey(!showTextbeeKey)}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          {showTextbeeKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default: <code style={{ fontSize: '0.72rem' }}>txb_qQDn...0wNT</code> (hardcoded for administrator)
                      </small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <span>Device ID (Optional)</span>
                        <span className="badge badge-success" style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '1px 6px' }}>Hardcoded Default</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`Hardcoded: ${HARDCODED_TEXTBEE_DEVICE_ID}`}
                        value={settings.textbee_device_id || ''}
                        onChange={(e) => setSettings({ ...settings, textbee_device_id: e.target.value })}
                      />
                      <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Default: <code style={{ fontSize: '0.72rem' }}>6ad7fcb9ab534081692d485f</code>
                      </small>
                    </div>
                  </div>

                  {/* Administrator Live Test SMS Console */}
                  <div style={{
                    background: '#ffffff',
                    border: '1.5px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Send size={16} color="var(--primary)" />
                        <span>Administrator Live Test SMS Console</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Verify TextBee SIM dispatching before sending to parents
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 240px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter PH Mobile (e.g. 09171234567)"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleTestSMS}
                        disabled={testingSms || !testPhone.trim()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        <Send size={14} className={testingSms ? 'animate-spin' : ''} />
                        <span>{testingSms ? 'Dispatching Live SMS...' : 'Send Live Test SMS'}</span>
                      </button>
                    </div>

                    {/* Test Feedback Box */}
                    {testResult && (
                      <div style={{ marginTop: '12px' }}>
                        {testResult.success ? (
                          <div className="alert alert-success" style={{ fontSize: '0.8rem', padding: '10px 14px' }}>
                            <CheckCircle size={16} />
                            <div>
                              <strong>Test SMS Dispatched Successfully!</strong>
                              <div style={{ fontSize: '0.74rem', marginTop: '2px' }}>
                                {testResult.message} • Recipient: <code>{testResult.contact}</code> • Provider: <strong>TextBee</strong>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="alert alert-error" style={{ fontSize: '0.8rem', padding: '10px 14px' }}>
                            <AlertCircle size={16} />
                            <div>
                              <strong>Failed to Dispatch Test SMS:</strong>
                              <div style={{ fontSize: '0.74rem', marginTop: '2px' }}>{testResult.error}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Optional Schedule Scan Window */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px', marginTop: '14px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Optional Scanner Operating Window
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Leave blank to keep gate scanning available at all times, or specify date/time constraints:
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Scanner Opening DateTime</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={settings.qr_start || ''}
                  onChange={(e) => setSettings({ ...settings, qr_start: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Scanner Closing DateTime</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={settings.qr_end || ''}
                  onChange={(e) => setSettings({ ...settings, qr_end: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 5: THEME & APPEARANCE
          ======================================================== */}
      {activeTab === 'appearance' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Palette size={20} />
                <span>Application Theme & Color Palette</span>
              </h2>
              <p className="card-subtitle">
                Select a visual theme tailored to your classroom or school identity. Changes apply immediately across all pages.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            {themes.map((t) => {
              const isSelected = (settings.attendance_theme || 'rose') === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSettings(prev => ({ ...prev, attendance_theme: t.id }));
                    changeTheme(t.id);
                  }}
                  style={{
                    border: isSelected ? `2.5px solid ${t.primary}` : '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-light)' : '#ffffff',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isSelected ? `0 6px 18px ${t.primary}30` : 'var(--shadow-sm)',
                    position: 'relative',
                    transform: isSelected ? 'translateY(-2px)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.primary, display: 'inline-block', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: t.accent, display: 'inline-block' }} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e293b' }}>{t.name}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>{t.desc}</div>
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: t.primary,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 900
                    }}>
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 6: STUDENT PORTAL QUICK PROVISIONING
          ======================================================== */}
      {activeTab === 'student_portal' && (
        <div>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <UserPlus size={20} />
                  <span>Student Portal Account Access</span>
                </h2>
                <p className="card-subtitle">
                  Provision student login credentials so learners can check in remotely and view their attendance records.
                </p>
              </div>

              <Link to="/student-accounts" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ExternalLink size={14} />
                <span>Open Full Student Accounts Hub</span>
              </Link>
            </div>

            {accountAlert && (
              <div className={`alert ${accountAlert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                {accountAlert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                <span>{accountAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleCreateStudentAccount}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Select Student *</label>
                  <select
                    className="form-select"
                    value={accountData.student_id}
                    onChange={(e) => setAccountData({ ...accountData, student_id: e.target.value })}
                    required
                  >
                    <option value="">Choose a student...</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.sex})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Portal Username *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. juan.delacruz"
                    value={accountData.username}
                    onChange={(e) => setAccountData({ ...accountData, username: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Temporary Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter temporary password"
                      value={accountData.password}
                      onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="submit" className="btn btn-secondary" disabled={creatingAccount}>
                  <UserPlus size={16} />
                  <span>{creatingAccount ? 'Creating Account...' : 'Create Student Login'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 7: ADMINISTRATOR LOGIN CREDENTIALS
          ======================================================== */}
      {activeTab === 'admin_credentials' && isAdmin && (
        <div className="card" style={{ maxWidth: '840px', margin: '0 auto 30px' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(30, 27, 75, 0.25)'
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 className="card-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1e1b4b' }}>
                  Administrator Log In Credentials
                </h2>
                <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
                  Manage and update your master administrative login username, display name, official DepEd email, and login password.
                </p>
              </div>
            </div>
          </div>

          {/* Current Master Account Summary Card */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            border: '1.5px solid #c7d2fe',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.15rem'
              }}>
                {(adminCreds.full_name || user?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.02rem', color: '#1e1b4b' }}>
                    {adminCreds.full_name || user?.full_name || 'System Administrator'}
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: '#312e81',
                    color: '#ffffff'
                  }}>
                    Master Admin
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '3px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span>Username: <strong style={{ color: '#1e293b', fontFamily: 'var(--font-mono)' }}>@{adminCreds.username || user?.username || 'admin'}</strong></span>
                  {adminCreds.email && <span>Email: <strong style={{ color: '#1e293b' }}>{adminCreds.email}</strong></span>}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#4f46e5', fontWeight: 700, background: '#ffffff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
              Sta. Rosa ES • Administrative Authority
            </div>
          </div>

          {adminAlert && (
            <div className={`alert ${adminAlert.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '22px' }}>
              {adminAlert.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              <span style={{ fontWeight: 600 }}>{adminAlert.message}</span>
            </div>
          )}

          <form onSubmit={handleUpdateAdminCredentials}>
            {/* Section 1: Administrator Profile Details */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <UserCheck size={18} style={{ color: '#312e81' }} />
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                  1. Administrator Profile Details
                </h3>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Full Name / Display Title *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Principal Juan Dela Cruz"
                    value={adminCreds.full_name}
                    onChange={(e) => setAdminCreds({ ...adminCreds, full_name: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Shown on the top navigation bar, compliance approval stamps, and system activity logs.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Admin Login Username *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. admin or sres.principal"
                    value={adminCreds.username}
                    onChange={(e) => setAdminCreds({ ...adminCreds, username: e.target.value })}
                    required
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    The primary handle used to sign into the School Administrator console.
                  </span>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Official DepEd / School Email (Optional)
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. principal.starosa@deped.gov.ph"
                    value={adminCreds.email || ''}
                    onChange={(e) => setAdminCreds({ ...adminCreds, email: e.target.value })}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Can also be used as your login identifier in place of username on the Admin Login portal.
                  </span>
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)', margin: '24px 0' }} />

            {/* Section 2: Security & Password Management */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <KeyRound size={18} style={{ color: '#312e81' }} />
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                  2. Security &amp; Password Management
                </h3>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                To authorize credential changes or update your password, your current master password is required.
              </p>

              <div className="form-grid">
                {/* Current Password (Required) */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ fontWeight: 700, color: '#1e1b4b' }}>
                    Current Master Password * (Required for Verification)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter your current admin password"
                      value={adminCreds.current_password}
                      onChange={(e) => setAdminCreds({ ...adminCreds, current_password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title={showCurrentPass ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Security verification: Required to authorize any updates to admin credentials.
                  </span>
                </div>

                {/* New Password (Optional) */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    New Master Password (Leave blank to keep current)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Minimum 6 characters"
                      value={adminCreds.new_password}
                      onChange={(e) => setAdminCreds({ ...adminCreds, new_password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title={showNewPass ? 'Hide password' : 'Show password'}
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    {adminCreds.new_password ? (
                      adminCreds.new_password.length >= 6 ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Password meets 6-character length</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ Minimum 6 characters required ({adminCreds.new_password.length}/6)</span>
                      )
                    ) : 'Leave blank if you only want to change username or full name.'}
                  </span>
                </div>

                {/* Confirm New Password */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Confirm New Master Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Re-type new password"
                      value={adminCreds.confirm_password}
                      onChange={(e) => setAdminCreds({ ...adminCreds, confirm_password: e.target.value })}
                      disabled={!adminCreds.new_password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      title={showConfirmPass ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    {adminCreds.new_password && adminCreds.confirm_password ? (
                      adminCreds.new_password === adminCreds.confirm_password ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Passwords match</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ Passwords do not match</span>
                      )
                    ) : 'Confirm your new master password.'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)'
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAdminCreds({
                    full_name: user?.full_name || '',
                    username: user?.username || '',
                    email: user?.email || '',
                    current_password: '',
                    new_password: '',
                    confirm_password: ''
                  });
                  setAdminAlert(null);
                }}
                disabled={adminSaving}
              >
                Reset Changes
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={adminSaving}
                style={{
                  background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                  borderColor: '#1E1B4B',
                  boxShadow: '0 4px 14px rgba(30, 27, 75, 0.3)'
                }}
              >
                <Save size={16} />
                <span>{adminSaving ? 'Saving Credentials...' : 'Save Admin Credentials'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating / Sticky Universal Save Action Bar */}
      {activeTab !== 'admin_credentials' && activeTab !== 'student_portal' && (
        <div className="settings-floating-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isDirty ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#b45309', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                You have unsaved policy modifications
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
                <Check size={14} style={{ color: '#16a34a' }} />
                All classroom policy settings are synchronized
              </span>
            )}
          </div>

          <button 
            type="button"
            className="btn btn-primary" 
            onClick={handleSaveSettings}
            disabled={saving}
            style={{ minWidth: '180px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving Policies...' : 'Save Policy Settings'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
