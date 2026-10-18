import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
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
  Wifi
} from 'lucide-react';

export default function Settings() {
  const { theme, changeTheme, themes } = useTheme();

  const [activeTab, setActiveTab] = useState('classroom'); // classroom | schedule | geofence | notifications | appearance | student_portal

  const [settings, setSettings] = useState({
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
    sms_provider: 'philsms',
    philsms_api_token: '',
    philsms_sender_id: 'PhilSMS',
    android_gateway_url: '',
    android_gateway_key: '',
    semaphore_api_key: '',
    sms_sender_name: '',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    student_face_verification: '1'
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showPhilSmsToken, setShowPhilSmsToken] = useState(false);

  const handleTestSMS = async () => {
    if (!testPhone.trim()) {
      setTestResult({ error: 'Please enter a mobile phone number to test.' });
      return;
    }
    setTestingSms(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/sms/test', {
        method: 'POST',
        body: JSON.stringify({
          phone: testPhone,
          provider: settings.sms_provider || 'philsms',
          philsmsApiToken: settings.philsms_api_token || '',
          philsmsSenderId: settings.philsms_sender_id || '',
          androidGatewayUrl: settings.android_gateway_url || '',
          androidGatewayKey: settings.android_gateway_key || '',
          apiKey: settings.semaphore_api_key || '',
          senderName: settings.sms_sender_name || '',
          twilioAccountSid: settings.twilio_account_sid || '',
          twilioAuthToken: settings.twilio_auth_token || '',
          twilioPhoneNumber: settings.twilio_phone_number || ''
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: data.message, isMock: data.isMock, contact: data.contact, provider: data.provider });
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
        setSettings(prev => ({ ...prev, ...data }));
        setInitialSettings(data);
      }
      if (stRes.ok) {
        const studentsList = await stRes.json();
        setStudents(studentsList);
        if (studentsList.length > 0) {
          setAccountData(prev => ({ ...prev, student_id: String(studentsList[0].id) }));
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isDirty = initialSettings && JSON.stringify(settings) !== JSON.stringify({ ...settings, ...initialSettings });

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        showAlert('Attendance policies and classroom settings saved successfully!');
        setInitialSettings({ ...settings });
        if (settings.attendance_theme && settings.attendance_theme !== theme) {
          changeTheme(settings.attendance_theme);
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
    <div>
      {/* Top Classroom Policy Status HUD */}
      <div className="settings-hud">
        <div>
          <div style={{ fontSize: '0.74rem', opacity: 0.9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Classroom Attendance Policy
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px' }}>
            {settings.room_name || 'Room 101 - Grade 6 Great Geniuses'}
          </div>
        </div>

        <div className="hud-chips">
          <span className={`hud-chip ${settings.attendance_mode === 'flipped' ? 'active-flipped' : 'active-onsite'}`}>
            {settings.attendance_mode === 'flipped' ? <Laptop size={13} /> : <MapPin size={13} />}
            <span>{settings.attendance_mode === 'flipped' ? 'Online Mode (Remote)' : 'Onsite Mode'}</span>
          </span>

          <span className="hud-chip">
            <Clock size={13} />
            <span>Bell: {formatTime12(settings.school_start)}</span>
          </span>

          <span className="hud-chip">
            <Clock size={13} />
            <span>Late after: {formatTime12(settings.late_after)}</span>
          </span>

          {settings.sms_enabled === '1' && (
            <span className="hud-chip" style={{ background: 'rgba(233, 30, 99, 0.25)', borderColor: 'rgba(244, 114, 182, 0.4)' }}>
              <MessageSquare size={13} />
              <span>SMS Alerts Active</span>
            </span>
          )}
        </div>
      </div>

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
          onClick={() => setActiveTab('classroom')}
        >
          <Building size={16} />
          <span>Classroom & Mode</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Clock size={16} />
          <span>Daily Bell Schedule</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'geofence' ? 'active' : ''}`}
          onClick={() => setActiveTab('geofence')}
        >
          <MapPin size={16} />
          <span>Campus Geofence</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} />
          <span>Scanner & SMS</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <Palette size={16} />
          <span>Theme & Appearance</span>
        </button>

        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'student_portal' ? 'active' : ''}`}
          onClick={() => setActiveTab('student_portal')}
        >
          <UserPlus size={16} />
          <span>Student Logins</span>
        </button>
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

          {/* Automated SMS Alerts Card */}
          <div className="settings-option-card">
            <div className="settings-option-info">
              <div className="settings-option-icon" style={{ background: '#fce4ec', color: '#c2185b' }}>
                <MessageSquare size={20} />
              </div>
              <div>
                <div className="settings-option-title">Automated Parent SMS Alerts</div>
                <div className="settings-option-desc">
                  Automatically dispatches SMS notifications to the guardian's contact number when a student is recorded Late, Absent, or reaches 5 consecutive absences (SARDO alert).
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.sms_enabled === '1'}
              onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked ? '1' : '0' })}
              style={{ width: '22px', height: '22px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

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

      {/* Floating / Sticky Universal Save Action Bar */}
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
    </div>
  );
}
