import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { apiFetch, downloadWithAuth } from '../utils/api';
import { playSuccessChime, playDuplicateChime, playWarningChime } from '../utils/sound';
import { faceapi, loadFaceApiModels } from '../utils/faceApi';
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
  ShieldAlert,
  ShieldCheck,
  QrCode,
  UserCheck,
  Scan,
  Sparkles,
  RefreshCw,
  FlipHorizontal
} from 'lucide-react';
import {
  PageTitle,
  Card,
  SectionCard,
  StatusBadge,
  Button
} from '../components/ui';

function computeEuclideanDistance(descA, descB) {
  if (!descA || !descB || descA.length !== descB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < descA.length; i++) {
    const d = descA[i] - descB[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function drawFaceBox(canvas, video, box, label, isMatched) {
  if (!canvas || !video || !video.videoWidth) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!box || typeof box.x !== 'number') return;

  const color = isMatched ? '#10b981' : '#f59e0b';
  const cornerLength = Math.max(16, Math.min(box.width, box.height) * 0.22);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  const corners = [
    [[box.x, box.y + cornerLength], [box.x, box.y], [box.x + cornerLength, box.y]],
    [[box.x + box.width - cornerLength, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + cornerLength]],
    [[box.x, box.y + box.height - cornerLength], [box.x, box.y + box.height], [box.x + cornerLength, box.y + box.height]],
    [[box.x + box.width - cornerLength, box.y + box.height], [box.x + box.width, box.y + box.height], [box.x + box.width, box.y + box.height - cornerLength]]
  ];

  corners.forEach(pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.stroke();
  });

  if (label) {
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const padding = 10;
    const tagX = Math.max(8, box.x + (box.width - textWidth) / 2);
    const tagY = Math.max(26, box.y - 12);

    ctx.shadowBlur = 4;
    ctx.fillStyle = isMatched ? 'rgba(16, 185, 129, 0.95)' : 'rgba(245, 158, 11, 0.95)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(tagX - padding, tagY - 20, textWidth + padding * 2, 26, 8);
    } else {
      ctx.rect(tagX - padding, tagY - 20, textWidth + padding * 2, 26);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, tagX, tagY - 2);
  }
}

export default function AttendanceScanner() {
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [verificationMode, setVerificationMode] = useState('both'); // 'both' | 'face' | 'qr'
  const [manualInput, setManualInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceStatusText, setFaceStatusText] = useState('Scanning for student face...');
  const [faceRosterCount, setFaceRosterCount] = useState(0);

  // States for Two-Step Both Mode
  const [bothFaceDetected, setBothFaceDetected] = useState(false);
  const [bothStatusText, setBothStatusText] = useState('Step 1: Align your face with the camera');

  // Camera Visual Invert / Mirror State
  const [isMirrored, setIsMirrored] = useState(false);

  // Settings & GPS state
  const [scannerSettings, setScannerSettings] = useState({
    room_name: 'Room 101 - Grade 6 Great Geniuses',
    attendance_mode: 'onsite',
    gps_enabled: '0',
    scanner_verification_mode: 'both'
  });
  const [deviceCoords, setDeviceCoords] = useState({ latitude: null, longitude: null });
  const [gpsStatus, setGpsStatus] = useState('Acquiring location...');

  const scannerRef = useRef(null);
  const faceVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceStreamRef = useRef(null);
  const faceAnimFrameRef = useRef(null);
  const isDetectingRef = useRef(false);

  // Refs for Both Mode continuous live tracking
  const bothCanvasRef = useRef(null);
  const bothAnimFrameRef = useRef(null);
  const isBothDetectingRef = useRef(false);
  const lastDetectedFaceRef = useRef(null);

  const faceRosterRef = useRef([]);
  const cooldownMapRef = useRef({});
  const loadingRef = useRef(false);

  // Keep loadingRef in sync with loading state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Load registered student face biometric profiles for client-side matching
  const loadFaceRoster = async () => {
    try {
      const res = await apiFetch('/api/attendance/face-roster');
      if (res.ok) {
        const data = await res.json();
        const list = (data || []).map(st => {
          try {
            return {
              ...st,
              descriptorArray: typeof st.face_descriptor === 'string'
                ? JSON.parse(st.face_descriptor)
                : st.face_descriptor
            };
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        faceRosterRef.current = list;
        setFaceRosterCount(list.length);
        return list;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('Face roster load notice:', errData.error || res.statusText);
      }
    } catch (err) {
      console.warn('Face roster load notice:', err.message);
    }
    return [];
  };

  // Load settings & GPS location
  useEffect(() => {
    apiFetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const mode = data.scanner_verification_mode || 'both';
          setScannerSettings({
            room_name: data.room_name || 'Room 101 - Grade 6 Great Geniuses',
            attendance_mode: data.attendance_mode || 'onsite',
            gps_enabled: data.gps_enabled || '0',
            scanner_verification_mode: mode
          });
          setVerificationMode(mode);
        }
      })
      .catch(() => {});

    // Preload biometric models
    loadFaceApiModels().catch(err => {
      console.warn('Face models preload notice:', err.message);
    });

    loadFaceRoster();

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

  // Handle Face-Only Recognition Check-in
  const handleProcessFace = async (student, faceDescriptor) => {
    if (!student || loadingRef.current) return;
    setLoading(true);
    loadingRef.current = true;

    try {
      const payload = {
        student_id: student.id,
        faceDescriptor: faceDescriptor,
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude
      };

      const res = await apiFetch('/api/attendance/face-scan', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        if (data.duplicate) {
          playDuplicateChime();
          setScanResult({
            type: 'duplicate',
            message: `${data.student} — Already recorded today at ${data.time_in} in ${data.room || scannerSettings.room_name}`
          });
        } else {
          playSuccessChime();
          const confBadge = data.match_confidence ? ` (${data.match_confidence} match)` : '';
          setScanResult({
            type: 'success',
            message: `Recorded: ${data.student} at ${data.time_in} (${data.status === 'late' ? 'Late' : 'Present'}) • [Face Recognized ✓${confBadge}] • ${data.room || scannerSettings.room_name}`
          });
        }
        loadRecords();
      } else {
        playWarningChime();
        const isEnrollmentBlocked = data.blocked || (data.error && data.error.includes('not officially enrolled'));
        setScanResult({
          type: isEnrollmentBlocked ? 'enrollment_blocked' : 'error',
          message: data.error || 'Face recognition check-in was rejected.'
        });
      }
    } catch (err) {
      setScanResult({
        type: 'error',
        message: 'Network error recording biometric face attendance.'
      });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Handle QR Code Scan (Supports QR Only and Both QR+Face 2FA)
  const handleProcessQR = async (qrCode) => {
    if (!qrCode || loadingRef.current) return;
    setLoading(true);
    loadingRef.current = true;

    let faceDescriptor = null;
    if (verificationMode === 'both') {
      const now = Date.now();
      const lastFace = lastDetectedFaceRef.current;
      // Check if we have a fresh face descriptor from live detection buffer (last 3.0s)
      if (lastFace && (now - lastFace.timestamp < 3000) && lastFace.descriptor) {
        faceDescriptor = lastFace.descriptor;
      } else {
        // Fallback: immediate single-frame capture
        try {
          const videoEl = document.querySelector('#qr-reader video');
          if (videoEl && videoEl.videoWidth > 0 && faceapi.nets.tinyFaceDetector.isLoaded) {
            const detection = await faceapi
              .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 }))
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (detection && detection.descriptor) {
              faceDescriptor = Array.from(detection.descriptor);
              lastDetectedFaceRef.current = {
                descriptor: faceDescriptor,
                timestamp: Date.now()
              };
            }
          }
        } catch (faceErr) {
          // Non-blocking face capture
        }
      }

      if (!faceDescriptor) {
        playWarningChime();
        setScanResult({
          type: 'face_required',
          message: 'Face not detected yet! Please look at the camera until "Face Detected ✓" appears, then present your QR badge.'
        });
        setLoading(false);
        loadingRef.current = false;
        return;
      }
    }

    const payload = {
      qr_code: qrCode,
      verification_mode: verificationMode,
      latitude: deviceCoords.latitude,
      longitude: deviceCoords.longitude,
      faceDescriptor
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
          let methodNotice = '';
          if (verificationMode === 'both') {
            methodNotice = data.face_verified ? ' • [QR + Face 2FA ✓]' : (data.face_not_enrolled ? ' • [No Face Registered]' : '');
          } else {
            methodNotice = ' • [QR Scan]';
          }

          setScanResult({
            type: 'success',
            message: `Recorded: ${data.student} at ${data.time_in} (${data.status === 'late' ? 'Late' : 'Present'})${methodNotice} • ${data.room || scannerSettings.room_name}`
          });
        }
        loadRecords();
      } else {
        if (data.face_mismatch) {
          playWarningChime();
          setScanResult({
            type: 'face_mismatch',
            student: data.student,
            confidence: data.confidence,
            message: data.error || 'Biometric Security Mismatch: Face in view does not match student profile.'
          });
        } else if (data.face_required) {
          playWarningChime();
          setScanResult({
            type: 'face_required',
            message: data.error
          });
        } else {
          const isEnrollmentBlocked = data.blocked || (data.error && data.error.includes('not officially enrolled'));
          setScanResult({
            type: isEnrollmentBlocked ? 'enrollment_blocked' : 'error',
            message: data.error || 'Student QR code not found.'
          });
        }
      }
    } catch (err) {
      setScanResult({
        type: 'error',
        message: 'Network error recording attendance.'
      });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Continuous Face Tracking Loop for Both Mode (over #qr-reader video)
  const startBothModeFaceTracking = () => {
    if (isBothDetectingRef.current) return;
    isBothDetectingRef.current = true;
    let lastDetectTime = 0;

    const checkAndLoop = () => {
      if (!isBothDetectingRef.current) return;
      const video = document.querySelector('#qr-reader video');

      if (!video || video.readyState < 2 || !video.videoWidth) {
        bothAnimFrameRef.current = requestAnimationFrame(checkAndLoop);
        return;
      }

      const loop = async (timestamp) => {
        if (!isBothDetectingRef.current) return;
        const v = document.querySelector('#qr-reader video');
        if (!v || v.readyState < 2) {
          bothAnimFrameRef.current = requestAnimationFrame(loop);
          return;
        }

        if (timestamp - lastDetectTime > 120) {
          lastDetectTime = timestamp;
          try {
            if (faceapi.nets.tinyFaceDetector.isLoaded && !loadingRef.current) {
              const detection = await faceapi
                .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (detection && detection.detection && detection.descriptor) {
                const box = detection.detection.box;
                const desc = Array.from(detection.descriptor);
                lastDetectedFaceRef.current = {
                  descriptor: desc,
                  timestamp: Date.now(),
                  box
                };
                setBothFaceDetected(true);
                setBothStatusText('Face Detected ✓ — Now present your QR Code!');
                drawFaceBox(bothCanvasRef.current, v, box, '✓ Face Detected (Show QR)', true);
              } else {
                const now = Date.now();
                const lastTime = lastDetectedFaceRef.current?.timestamp || 0;
                if (now - lastTime > 2500) {
                  setBothFaceDetected(false);
                  setBothStatusText('Step 1: Align your face with the camera');
                  if (bothCanvasRef.current) {
                    const ctx = bothCanvasRef.current.getContext('2d');
                    ctx.clearRect(0, 0, bothCanvasRef.current.width, bothCanvasRef.current.height);
                  }
                }
              }
            }
          } catch (e) {
            // Non-blocking frame error
          }
        }
        bothAnimFrameRef.current = requestAnimationFrame(loop);
      };

      bothAnimFrameRef.current = requestAnimationFrame(loop);
    };

    bothAnimFrameRef.current = requestAnimationFrame(checkAndLoop);
  };

  const stopBothModeFaceTracking = () => {
    isBothDetectingRef.current = false;
    if (bothAnimFrameRef.current) {
      cancelAnimationFrame(bothAnimFrameRef.current);
      bothAnimFrameRef.current = null;
    }
    if (bothCanvasRef.current) {
      const ctx = bothCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, bothCanvasRef.current.width, bothCanvasRef.current.height);
    }
    lastDetectedFaceRef.current = null;
    setBothFaceDetected(false);
    setBothStatusText('Step 1: Align your face with the camera');
  };

  // Dedicated Face Recognition Loop for Face-Only Mode
  const startFaceRecognitionLoop = () => {
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;
    let lastDetectTime = 0;

    const loop = async (timestamp) => {
      if (!isDetectingRef.current || !faceVideoRef.current) return;
      if (timestamp - lastDetectTime > 120) {
        lastDetectTime = timestamp;
        try {
          const video = faceVideoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0 && !loadingRef.current) {
            const detection = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection && detection.detection && detection.descriptor) {
              const box = detection.detection.box;
              const liveDesc = Array.from(detection.descriptor);

              let bestMatch = null;
              let bestDist = Infinity;
              const roster = faceRosterRef.current || [];
              for (const s of roster) {
                const dist = computeEuclideanDistance(liveDesc, s.descriptorArray);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestMatch = s;
                }
              }

              if (bestMatch && bestDist <= 0.52) {
                const confidencePercent = (Math.max(0, 1 - bestDist) * 100).toFixed(0);
                const label = `✓ ${bestMatch.full_name} (${confidencePercent}%)`;
                drawFaceBox(faceCanvasRef.current, video, box, label, true);
                setFaceStatusText(`Recognized: ${bestMatch.full_name} (${confidencePercent}%)`);

                // Check 4-second cooldown per student
                const nowMs = Date.now();
                const lastScanned = cooldownMapRef.current[bestMatch.id] || 0;
                if (nowMs - lastScanned > 4000) {
                  cooldownMapRef.current[bestMatch.id] = nowMs;
                  handleProcessFace(bestMatch, liveDesc);
                }
              } else {
                if (!roster || roster.length === 0) {
                  drawFaceBox(faceCanvasRef.current, video, box, 'No Faces Enrolled In Roster', false);
                  setFaceStatusText('Face detected • No face profiles registered in roster (0 enrolled)');
                } else {
                  drawFaceBox(faceCanvasRef.current, video, box, 'Face Detected • Unrecognized', false);
                  setFaceStatusText(`Face detected • Not recognized in class roster (${roster.length} enrolled)`);
                }
              }
            } else {
              if (faceCanvasRef.current) {
                const c = faceCanvasRef.current;
                const ctx = c.getContext('2d');
                ctx.clearRect(0, 0, c.width, c.height);
              }
              setFaceStatusText('Scanning for student face...');
            }
          }
        } catch (e) {
          // Non-blocking frame detection error
        }
      }
      faceAnimFrameRef.current = requestAnimationFrame(loop);
    };

    faceAnimFrameRef.current = requestAnimationFrame(loop);
  };

  const stopFaceCamera = () => {
    isDetectingRef.current = false;
    if (faceAnimFrameRef.current) {
      cancelAnimationFrame(faceAnimFrameRef.current);
      faceAnimFrameRef.current = null;
    }
    if (faceStreamRef.current) {
      try {
        faceStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) {
      faceVideoRef.current.srcObject = null;
    }
    if (faceCanvasRef.current) {
      const c = faceCanvasRef.current;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
    }
  };

  const startScanner = async (overrideMode) => {
    const targetMode = overrideMode || verificationMode;
    setScanResult(null);

    try {
      if (targetMode === 'face') {
        // Stop QR scanner if running
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
          } catch (e) {}
        }
        stopFaceCamera();
        stopBothModeFaceTracking();

        await loadFaceApiModels();
        await loadFaceRoster();

        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        faceStreamRef.current = stream;

        if (faceVideoRef.current) {
          faceVideoRef.current.srcObject = stream;
          const onReady = () => {
            if (faceVideoRef.current) {
              faceVideoRef.current.play().catch(() => {});
              startFaceRecognitionLoop();
            }
          };
          if (faceVideoRef.current.readyState >= 2) onReady();
          else {
            faceVideoRef.current.onloadedmetadata = onReady;
            faceVideoRef.current.onloadeddata = onReady;
          }
        }
        setScanning(true);
      } else {
        // QR or Both mode: use Html5Qrcode
        stopFaceCamera();
        stopBothModeFaceTracking();

        if (targetMode === 'both') {
          await loadFaceApiModels();
        }

        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
          } catch (e) {}
        } else {
          scannerRef.current = new Html5Qrcode('qr-reader');
        }

        await scannerRef.current.start(
          { facingMode: facingMode },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Generous 88% scanning zone so both face and QR card fit comfortably
              const w = Math.floor(viewfinderWidth * 0.88);
              const h = Math.floor(viewfinderHeight * 0.88);
              return { width: Math.max(280, w), height: Math.max(280, h) };
            },
            aspectRatio: 1.333333 // 4:3 natural aspect ratio
          },
          (decodedText) => {
            handleProcessQR(decodedText);
          },
          () => {}
        );
        setScanning(true);

        if (targetMode === 'both') {
          startBothModeFaceTracking();
        }
      }
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
    stopFaceCamera();
    stopBothModeFaceTracking();
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Camera stop error:', err);
      }
    }
    setScanning(false);
  };

  const switchVerificationMode = async (newMode) => {
    if (newMode === verificationMode) return;
    const wasScanning = scanning;
    await stopScanner();
    setVerificationMode(newMode);
    setScanResult(null);
    if (wasScanning) {
      setTimeout(() => {
        startScanner(newMode);
      }, 250);
    }
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (scanning) {
      await stopScanner();
      setTimeout(() => {
        startScanner(verificationMode);
      }, 250);
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
    <div className="sres-scanner-page">
      {/* 1. Page Title with Mode Tag and Past History link */}
      <PageTitle
        title="Scan Attendance"
        emoji="📷"
        tag={`${scannerSettings.room_name} • ${scannerSettings.attendance_mode === 'flipped' ? 'Online Mode' : 'Onsite Mode'}`}
        icon={Building}
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link to="/history" className="sres-btn sres-btn-secondary sres-btn-sm">
              <History size={14} strokeWidth={1.8} />
              <span>Past History</span>
            </Link>
          </div>
        }
      />

      <div className="responsive-two-col" style={{ marginBottom: '24px' }}>
        {/* Scanner Card */}
        <Card style={{ textAlign: 'center' }} padding="22px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Camera size={19} strokeWidth={1.8} />
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
              Gate & Classroom Scanner
            </h2>
          </div>

          {/* Verification Mode Selector */}
          <div className="scanner-mode-bar">
            <button
              type="button"
              className={`scanner-mode-btn ${verificationMode === 'both' ? 'active mode-both' : ''}`}
              onClick={() => switchVerificationMode('both')}
              title="Both: QR Code + Face Biometric 2FA (Anti-Proxy)"
            >
              <ShieldCheck size={16} />
              <span>Both: QR + Face (2FA)</span>
            </button>
            <button
              type="button"
              className={`scanner-mode-btn ${verificationMode === 'face' ? 'active mode-face' : ''}`}
              onClick={() => switchVerificationMode('face')}
              title="Face Recognition Only (Touchless Check-in)"
            >
              <UserCheck size={16} />
              <span>Face Recognition Only</span>
            </button>
            <button
              type="button"
              className={`scanner-mode-btn ${verificationMode === 'qr' ? 'active mode-qr' : ''}`}
              onClick={() => switchVerificationMode('qr')}
              title="QR Code Only (Barcode Scanning)"
            >
              <QrCode size={16} />
              <span>QR Code Only</span>
            </button>
          </div>

          {/* Two-Step Verification HUD for Both Mode */}
          {verificationMode === 'both' && (
            <div className="two-step-hud">
              <span className={`step-badge ${bothFaceDetected ? 'step-done' : 'step-active'}`}>
                {bothFaceDetected ? <CheckCircle size={14} /> : <Scan size={14} />}
                <span>{bothFaceDetected ? 'Step 1: Face Detected ✓' : 'Step 1: Face Camera'}</span>
              </span>
              <span className="step-arrow">➜</span>
              <span className={`step-badge ${bothFaceDetected ? 'step-active-pulse' : 'step-waiting'}`}>
                <QrCode size={14} />
                <span>{bothFaceDetected ? 'Step 2: Show QR Badge Now' : 'Step 2: Show QR Code'}</span>
              </span>
            </div>
          )}

          {/* Active Mode Notice Banner (For Face and QR modes) */}
          {verificationMode !== 'both' && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginBottom: '14px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <Sparkles size={14} style={{ color: verificationMode === 'face' ? '#0284c7' : '#059669' }} />
              <span>
                {verificationMode === 'face' && (
                  faceRosterCount > 0
                    ? `Contactless Mode: Stand in front of camera (${faceRosterCount} student face profiles loaded).`
                    : `⚠️ Notice: 0 student face profiles enrolled in this roster. Please enroll student faces in Students page first.`
                )}
                {verificationMode === 'qr' && 'Fast Scan Mode: Only student QR code is required. Face verification is off.'}
              </span>
            </div>
          )}

          {/* Warning Banner if Face Recognition Mode has 0 enrolled students */}
          {verificationMode === 'face' && faceRosterCount === 0 && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#B45309',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} style={{ color: '#D97706', flexShrink: 0 }} />
              <div>
                <strong>No Enrolled Faces in this Roster:</strong> Attendance cannot recognize any faces because 0 students have a registered face biometric profile. Go to <strong>Students</strong> &rarr; click <strong>"Register Face"</strong> for learners to enable face check-in.
              </div>
            </div>
          )}

          {/* Scanner Viewport */}
          <div 
            className={`scanner-viewport ${isMirrored ? 'camera-mirrored' : ''}`} 
            style={{ position: 'relative', overflow: 'hidden', minHeight: '380px', background: '#0f172a', borderRadius: '12px' }}
          >
            {/* Dedicated container for Html5Qrcode in QR and Both modes */}
            <div 
              id="qr-reader" 
              style={{ 
                width: '100%', 
                minHeight: '380px', 
                display: verificationMode === 'face' ? 'none' : 'block' 
              }}
            ></div>

            {/* Live Face Tracking Canvas Overlay for Both Mode */}
            {verificationMode === 'both' && (
              <canvas
                ref={bothCanvasRef}
                className="scanner-face-overlay"
                style={{ display: scanning ? 'block' : 'none' }}
              />
            )}

            {/* Floating Live Status Pill for Both Mode */}
            {scanning && verificationMode === 'both' && (
              <div className="scanner-hud-status" style={{
                background: bothFaceDetected ? 'rgba(16, 185, 129, 0.9)' : 'rgba(15, 23, 42, 0.85)',
                borderColor: bothFaceDetected ? '#34d399' : 'rgba(255, 255, 255, 0.15)'
              }}>
                <div className="scanner-hud-pulse" style={{
                  background: bothFaceDetected ? '#ffffff' : '#f59e0b',
                  boxShadow: bothFaceDetected ? '0 0 10px #ffffff' : '0 0 10px #f59e0b'
                }}></div>
                <span>{bothStatusText}</span>
              </div>
            )}

            {/* Dedicated video + HUD canvas overlay for Face Recognition mode */}
            {verificationMode === 'face' && (
              <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video
                  ref={faceVideoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width: '100%', height: '100%', minHeight: '380px', maxHeight: '480px', objectFit: 'contain', display: scanning ? 'block' : 'none' }}
                />
                <canvas
                  ref={faceCanvasRef}
                  className="scanner-face-overlay"
                  style={{ display: scanning ? 'block' : 'none' }}
                />
                {scanning && (
                  <div className="scanner-hud-status">
                    <div className="scanner-hud-pulse"></div>
                    <span>{faceStatusText}</span>
                  </div>
                )}
              </div>
            )}

            {/* Sibling overlay for when camera is off */}
            {!scanning && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                background: '#0f172a',
                zIndex: 2
              }}>
                <Camera size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.88rem', opacity: 0.8 }}>Camera is turned off</p>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>Click Start Camera to begin scanning</p>
              </div>
            )}
          </div>

          {/* Scanner Controls */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
            {!scanning ? (
              <button className="btn btn-primary btn-sm" onClick={() => startScanner()}>
                <Camera size={15} />
                <span>Start Camera</span>
              </button>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={stopScanner}>
                <CameraOff size={15} />
                <span>Stop Camera</span>
              </button>
            )}

            <button className="btn btn-secondary btn-sm" onClick={toggleCameraFacing} title="Flip rear / front camera">
              <SwitchCamera size={15} />
              <span>Camera ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
            </button>

            {/* Invert / Mirror Horizontal Toggle */}
            <button 
              type="button"
              className={`btn btn-sm ${isMirrored ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsMirrored(!isMirrored)}
              title="Mirror / Invert camera view horizontally"
            >
              <FlipHorizontal size={15} />
              <span>{isMirrored ? 'Invert Camera (Mirror): ON' : 'Invert Camera (Mirror)'}</span>
            </button>
          </div>

          {/* Feedback Alert */}
          {scanResult && (
            <div className={`alert ${
              scanResult.type === 'success' 
                ? 'alert-success' 
                : scanResult.type === 'duplicate' 
                ? 'alert-warning' 
                : (scanResult.type === 'face_mismatch' || scanResult.type === 'face_required')
                ? 'alert-error'
                : 'alert-error'
            }`} style={{
              textAlign: 'left',
              border: (scanResult.type === 'face_mismatch' || scanResult.type === 'face_required') ? '2px solid #ef4444' : undefined,
              backgroundColor: (scanResult.type === 'face_mismatch' || scanResult.type === 'face_required') ? 'rgba(239, 68, 68, 0.15)' : undefined
            }}>
              {scanResult.type === 'success' && <CheckCircle size={18} />}
              {scanResult.type === 'duplicate' && <AlertTriangle size={18} />}
              {scanResult.type === 'error' && <XCircle size={18} />}
              {scanResult.type === 'enrollment_blocked' && <ShieldAlert size={20} style={{ color: '#dc2626', flexShrink: 0 }} />}
              {(scanResult.type === 'face_mismatch' || scanResult.type === 'face_required') && (
                <ShieldAlert size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
              )}
              <div>
                <div style={{
                  fontWeight: 800,
                  color: (scanResult.type === 'face_mismatch' || scanResult.type === 'face_required') ? '#ef4444' : undefined
                }}>
                  {scanResult.type === 'enrollment_blocked'
                    ? 'Attendance Denied (Not Enrolled)'
                    : scanResult.type === 'face_mismatch'
                    ? '⚠️ PROXY ATTENDANCE BLOCKED (Face Mismatch)'
                    : scanResult.type === 'face_required'
                    ? '⚠️ Biometric Face Verification Required'
                    : 'Attendance Scan Result'}
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
        </Card>

        {/* Today's Summary Card */}
        <SectionCard
          title={`Today's Check-ins (${records.length})`}
          subtitle={`${scannerSettings.room_name} • Real-time stream`}
          icon={Clock}
          action={
            <button 
              type="button"
              className="sres-btn sres-btn-secondary sres-btn-sm"
              onClick={() => downloadWithAuth(`/api/attendance/export?from=${new Date().toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`, `attendance_${new Date().toISOString().split('T')[0]}.csv`)}
            >
              <Download size={13} strokeWidth={1.8} />
              <span>CSV</span>
            </button>
          }
        >

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {r.face_verified === 1 && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.68rem',
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontWeight: 700
                        }} title="Biometrically Verified: Live Face Matched Profile">
                          <ShieldCheck size={11} />
                          <span>Face ✓</span>
                        </span>
                      )}
                      <span className={`pill-badge ${r.status === 'present' ? 'badge-present' : 'badge-late'}`} style={{ fontSize: '0.72rem' }}>
                        {r.status === 'present' ? 'Present' : 'Late'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
