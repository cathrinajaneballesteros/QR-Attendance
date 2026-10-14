import React, { useState, useEffect } from 'react';
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
  ShieldAlert
} from 'lucide-react';

export default function Settings() {
  const { theme, changeTheme, themes } = useTheme();

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
    sms_enabled: '0'
  });

  const [students, setStudents] = useState([]);
  const [accountData, setAccountData] = useState({ student_id: '', username: '', password: '' });
  const [alert, setAlert] = useState(null);
  const [accountAlert, setAccountAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const loadData = async () => {
    try {
      const [setRes, stRes] = await Promise.all([
        apiFetch('/api/settings'),
        apiFetch('/api/students')
      ]);

      if (setRes.ok) {
        const data = await setRes.json();
        setSettings(prev => ({ ...prev, ...data }));
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

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        showAlert('Attendance policies, room, theme, and geofencing settings saved!');
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
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings(prev => ({
          ...prev,
          school_latitude: String(pos.coords.latitude),
          school_longitude: String(pos.coords.longitude)
        }));
        showAlert('Updated with current GPS coordinates!');
      },
      () => {
        alert('Could not access current location. Please allow location permissions in your browser.');
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
          message: `Student account for "${accountData.username}" created! Learner can now login to the Student Portal.`, 
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

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Sliders size={22} />
              <span>Attendance Policies & System Settings</span>
            </h2>
            <p className="card-subtitle">Configure room assignment, attendance modes, themes, geofencing, and cutoffs</p>
          </div>
        </div>

        {alert && (
          <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
            {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{alert.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings}>
          {/* Requirement 12: Theme Picker Section */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={18} />
              <span>Attendance Theme & Visual Styling (Requirement 12)</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Select a color palette for the application, scanner HUD, badges, and dashboard headers:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
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
                      border: isSelected ? `2px solid ${t.primary}` : '1px solid var(--border)',
                      borderRadius: '14px',
                      padding: '12px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0,0,0,0.02)' : '#fff',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? `0 4px 12px ${t.primary}25` : 'none',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.primary }} />
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.accent }} />
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e293b' }}>{t.name}</div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.desc}</div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '18px',
                        height: '18px',
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

          {/* Requirement 8 & 2: Room and Attendance Mode */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} />
              <span>Room Assignment & Learning Mode (Requirements 8 & 2)</span>
            </h3>

            <div className="form-grid">
              {/* Room name */}
              <div className="form-group">
                <label className="form-label">Indicate Classroom / Designated Room *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Room 101 - Grade 6 Great Geniuses"
                  value={settings.room_name || ''}
                  onChange={(e) => setSettings({ ...settings, room_name: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  This room is displayed on the scanner header, teacher dashboard, and recorded with every attendance entry.
                </span>
              </div>

              {/* Attendance Mode */}
              <div className="form-group">
                <label className="form-label">Attendance Setup Mode</label>
                <select
                  className="form-select"
                  value={settings.attendance_mode || 'onsite'}
                  onChange={(e) => setSettings({ ...settings, attendance_mode: e.target.value })}
                >
                  <option value="onsite">Onsite Classroom (GPS Geofencing Active)</option>
                  <option value="flipped">Flipped Classroom (Remote Attendance Allowed - GPS Bypassed)</option>
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  In "Flipped Classroom" mode, learners can mark attendance from home/remote without GPS errors.
                </span>
              </div>
            </div>

            {/* Requirement 13 & 11 Toggles */}
            <div className="form-grid" style={{ marginTop: '14px' }}>
              <div className="form-group">
                <label className="form-label">QR Code Type (Requirement 13)</label>
                <select
                  className="form-select"
                  value={settings.qr_code_type || 'fixed'}
                  onChange={(e) => setSettings({ ...settings, qr_code_type: e.target.value })}
                >
                  <option value="fixed">Fixed QR Code (Permanent Learner ID Badges)</option>
                  <option value="dynamic">Dynamic QR Code (Periodically refreshed codes)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Enrollment Eligibility Policy (Requirement 11)</label>
                <div style={{ marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={settings.block_unenrolled !== '0'}
                      onChange={(e) => setSettings({ ...settings, block_unenrolled: e.target.checked ? '1' : '0' })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    />
                    <span>Only Officially Enrolled learners can record attendance (Reject unenrolled)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Geofencing Section */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} />
              <span>GPS Geofencing (Onsite Location Boundaries)</span>
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={settings.gps_enabled === '1'}
                  onChange={(e) => setSettings({ ...settings, gps_enabled: e.target.checked ? '1' : '0' })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                <span>Enable GPS Geofencing (Enforce physical presence on school grounds during Onsite mode)</span>
              </label>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">School Latitude</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 15.987654"
                  value={settings.school_latitude || ''}
                  onChange={(e) => setSettings({ ...settings, school_latitude: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">School Longitude</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 120.543210"
                  value={settings.school_longitude || ''}
                  onChange={(e) => setSettings({ ...settings, school_longitude: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Allowed Radius (Meters)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="100"
                  value={settings.geofence_radius_m || '100'}
                  onChange={(e) => setSettings({ ...settings, geofence_radius_m: e.target.value })}
                />
              </div>
            </div>

            <button type="button" className="btn btn-secondary btn-sm" onClick={useCurrentLocation} style={{ marginTop: '4px' }}>
              <Navigation size={14} />
              <span>Use My Current Device Coordinates as School Center</span>
            </button>
          </div>

          {/* Schedule & Timing Cutoffs */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} />
              <span>Class Schedule & Attendance Cutoffs</span>
            </h3>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Class Start Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.school_start || '08:00'}
                  onChange={(e) => setSettings({ ...settings, school_start: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mark "Late" After</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.late_after || '08:00'}
                  onChange={(e) => setSettings({ ...settings, late_after: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Absence Cutoff Deadline</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.attendance_deadline || '16:00'}
                  onChange={(e) => setSettings({ ...settings, attendance_deadline: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Absence Drop-Risk Threshold (Days) (Req 6)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="30"
                  value={settings.absence_threshold || '5'}
                  onChange={(e) => setSettings({ ...settings, absence_threshold: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* QR Scan Windows & SMS Triggers */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} />
              <span>QR Validity Period & Automated SMS</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={settings.qr_enabled !== '0'}
                  onChange={(e) => setSettings({ ...settings, qr_enabled: e.target.checked ? '1' : '0' })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                <span>QR Scanner Active (Allows scanning at gate)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={settings.sms_enabled === '1'}
                  onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked ? '1' : '0' })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                <span>Automatic Parent SMS Alerts (Dispatches late & absence notices automatically)</span>
              </label>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">QR Validity Starts</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={settings.qr_start || ''}
                  onChange={(e) => setSettings({ ...settings, qr_start: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">QR Validity Expires</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={settings.qr_end || ''}
                  onChange={(e) => setSettings({ ...settings, qr_end: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Policy Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Student Account Portal Creator */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <UserPlus size={20} />
              <span>Create Student Portal Login</span>
            </h3>
            <p className="card-subtitle">Generate login credentials for learners to access their attendance records</p>
          </div>
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
              <label className="form-label">Select Learner *</label>
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
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={accountData.password}
                onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button type="submit" className="btn btn-secondary" disabled={creatingAccount}>
              <UserPlus size={16} />
              <span>{creatingAccount ? 'Creating...' : 'Create Learner Login'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
