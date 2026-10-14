import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { playSuccessChime, playDuplicateChime } from '../utils/sound';
import LiveClock from '../components/LiveClock';
import { 
  Camera, 
  CameraOff, 
  SwitchCamera, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Send,
  Building,
  MapPin,
  Laptop,
  History,
  Download,
  ShieldAlert
} from 'lucide-react';

export default function AttendanceScanner() {
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [manualInput, setManualInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Settings & GPS state (Requirement 1, 2, 8)
  const [scannerSettings, setScannerSettings] = useState({
    room_name: 'Room 101 - Grade 6 Great Geniuses',
    attendance_mode: 'onsite',
    gps_enabled: '0'
  });
  const [deviceCoords, setDeviceCoords] = useState({ latitude: null, longitude: null });
  const [gpsStatus, setGpsStatus] = useState('Acquiring location...');

  const scannerRef = useRef(null);

  // Load settings & request GPS location
  useEffect(() => {
    apiFetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setScannerSettings({
            room_name: data.room_name || 'Room 101 - Grade 6 Great Geniuses',
            attendance_mode: data.attendance_mode || 'onsite',
            gps_enabled: data.gps_enabled || '0'
          });
        }
      })
      .catch(() => {});

    // Acquire device GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeviceCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setGpsStatus('GPS Active');
        },
        (err) => {
          setGpsStatus('GPS Unavailable (allow permissions)');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsStatus('Geolocation not supported');
    }
  }, []);

  // Load today's attendance records
  const loadRecords = async () => {
    try {
      const response = await apiFetch('/api/attendance/today');
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (err) {
      console.error('Error fetching today records:', err);
    }
  };

  useEffect(() => {
    loadRecords();
    return () => {
      stopScanner();
    };
  }, []);

  const handleProcessQR = async (qrCode) => {
    if (!qrCode || loading) return;
    setLoading(true);

    const payload = {
      qr_code: qrCode,
      latitude: deviceCoords.latitude,
      longitude: deviceCoords.longitude
    };

    try {
      const response = await apiFetch('/api/attendance/scan', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (data.duplicate) {
          playDuplicateChime();
          setScanResult({
            type: 'duplicate',
            message: `${data.student} — Already recorded today at ${data.time_in} in ${data.room || scannerSettings.room_name}`
          });
        } else {
          playSuccessChime();
          setScanResult({
            type: 'success',
            message: `Recorded: ${data.student} at ${data.time_in} (${data.status === 'late' ? 'Late' : 'Present'}) • ${data.room || scannerSettings.room_name}`
          });
        }
        loadRecords();
      } else {
        // Check if error is due to unenrollment (Requirement 11)
        const isEnrollmentBlocked = data.blocked || (data.error && data.error.includes('not officially enrolled'));
        setScanResult({
          type: isEnrollmentBlocked ? 'enrollment_blocked' : 'error',
          message: data.error || 'Student QR code not found.'
        });
      }
    } catch (err) {
      setScanResult({
        type: 'error',
        message: 'Network error recording attendance.'
      });
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setScanResult(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      await scannerRef.current.start(
        { facingMode: facingMode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleProcessQR(decodedText);
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.error('Camera start failed:', err);
      setScanResult({
        type: 'error',
        message: 'Camera access denied or unavailable. Use manual search below.'
      });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Camera stop error:', err);
      }
    }
    setScanning(false);
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (scanning) {
      await stopScanner();
      setTimeout(startScanner, 200);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleProcessQR(manualInput.trim());
    setManualInput('');
  };

  const filteredRecords = records.filter(r => 
    (r.full_name || '').toLowerCase().includes(searchFilter.toLowerCase().trim())
  );

  return (
    <div>
      <LiveClock />

      {/* Requirement 8 & 2: Room and Attendance Mode Badges */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '12px 18px',
        borderRadius: '16px',
        marginBottom: '20px',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Room Indicator (Req 8) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Designated Room (Indicated)
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--primary)' }}>
              {scannerSettings.room_name}
            </div>
          </div>
        </div>

        {/* Mode & GPS Indicator (Req 1 & 2) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {scannerSettings.attendance_mode === 'flipped' ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              <Laptop size={14} />
              <span>Flipped Classroom Mode (Remote Allowed)</span>
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              <MapPin size={14} />
              <span>Onsite Mode {scannerSettings.gps_enabled === '1' ? '• Geofenced' : '• Open Gate'}</span>
            </span>
          )}

          <Link to="/history" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
            <History size={14} />
            <span>Past History</span>
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Scanner Card */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-header" style={{ justifyContent: 'center' }}>
            <h2 className="card-title">
              <Camera size={22} />
              <span>Gate & Classroom Scanner</span>
            </h2>
          </div>

          {/* Scanner Viewport */}
          <div className="scanner-viewport" id="qr-reader">
            {!scanning && (
              <div style={{
                height: '280px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: '#1e293b'
              }}>
                <Camera size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.88rem', opacity: 0.8 }}>Camera is turned off</p>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>Click Start Camera to begin scanning</p>
              </div>
            )}
          </div>

          {/* Scanner Controls */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
            {!scanning ? (
              <button className="btn btn-primary" onClick={startScanner}>
                <Camera size={16} />
                <span>Start Camera</span>
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopScanner}>
                <CameraOff size={16} />
                <span>Stop Camera</span>
              </button>
            )}

            <button className="btn btn-secondary" onClick={toggleCameraFacing} title="Flip camera">
              <SwitchCamera size={16} />
              <span>Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
            </button>
          </div>

          {/* Feedback Alert */}
          {scanResult && (
            <div className={`alert ${
              scanResult.type === 'success' 
                ? 'alert-success' 
                : scanResult.type === 'duplicate' 
                ? 'alert-warning' 
                : 'alert-error'
            }`} style={{ textAlign: 'left' }}>
              {scanResult.type === 'success' && <CheckCircle size={18} />}
              {scanResult.type === 'duplicate' && <AlertTriangle size={18} />}
              {scanResult.type === 'error' && <XCircle size={18} />}
              {scanResult.type === 'enrollment_blocked' && <ShieldAlert size={20} style={{ color: '#dc2626', flexShrink: 0 }} />}
              <div>
                <div style={{ fontWeight: 700 }}>
                  {scanResult.type === 'enrollment_blocked' ? 'Attendance Denied (Not Enrolled)' : 'Attendance Scan Result'}
                </div>
                <div style={{ fontSize: '0.82rem', marginTop: '2px' }}>{scanResult.message}</div>
              </div>
            </div>
          )}

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <label className="form-label" style={{ textAlign: 'left' }}>Manual Learner Name or QR Input</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter learner name or QR code string..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !manualInput.trim()}>
                <Send size={15} />
                <span>Record</span>
              </button>
            </div>
          </form>
        </div>

        {/* Today's Summary Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Clock size={20} />
                <span>Today's Check-ins ({records.length})</span>
              </h3>
              <p className="card-subtitle">{scannerSettings.room_name} • Real-time stream</p>
            </div>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => window.open(`/api/attendance/export?from=${new Date().toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`, '_blank')}
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '34px' }}
                placeholder="Filter today's attendance..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {searchFilter ? 'No matching check-ins today.' : 'No learners checked in today yet. Ready for scans!'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredRecords.map((r, i) => (
                  <div key={r.id || i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {r.full_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {r.time_in} • {r.room || scannerSettings.room_name}
                      </div>
                    </div>
                    <div>
                      <span className={`pill-badge ${r.status === 'present' ? 'badge-present' : 'badge-late'}`} style={{ fontSize: '0.72rem' }}>
                        {r.status === 'present' ? 'Present' : 'Late'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
