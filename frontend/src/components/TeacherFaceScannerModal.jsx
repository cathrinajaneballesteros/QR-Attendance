import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Scan, 
  Sparkles, 
  UserCheck, 
  ShieldCheck, 
  ArrowLeft,
  Eye,
  Check,
  Zap,
  Lock,
  KeyRound
} from 'lucide-react';
import { faceapi, loadFaceApiModels } from '../utils/faceApi';
import { playSuccessChime, playWarningChime } from '../utils/sound';

export default function TeacherFaceScannerModal({
  isOpen,
  onClose,
  mode = 'login', // 'login' | 'register'
  teacher = null, // Used in 'register' mode: { id, full_name, username }
  identifier = '', // Optional pre-filled identifier in 'login' mode
  onSuccess
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isDetectingRef = useRef(false);
  const animFrameRef = useRef(null);
  const consecutiveFramesRef = useRef(0);
  const lastDescriptorRef = useRef(null);

  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [statusMessage, setStatusMessage] = useState('Initializing biometric neural network...');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'searching' | 'scanning' | 'verifying' | 'success' | 'error' | 'enroll_needed'
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [matchedTeacher, setMatchedTeacher] = useState(null);
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100%
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Self-enroll states if face not yet registered
  const [selfEnrollPassword, setSelfEnrollPassword] = useState('');
  const [selfEnrollLoading, setSelfEnrollLoading] = useState(false);
  const [selfEnrollError, setSelfEnrollError] = useState('');

  // Close and cleanup helper
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const stopCamera = () => {
    isDetectingRef.current = false;
    consecutiveFramesRef.current = 0;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    clearCanvas();
    setIsVerifying(false);
    setCameraActive(false);
    setFaceInFrame(false);
    setScanProgress(0);
  };

  // Start camera and load models
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;
    setStatusMessage('Loading biometric neural models...');
    setStatusType('info');
    setCameraError('');
    setCapturedSamples([]);
    setMatchedTeacher(null);
    setIsVerifying(false);
    setScanProgress(0);
    setFaceInFrame(false);
    consecutiveFramesRef.current = 0;
    setSelfEnrollPassword('');
    setSelfEnrollError('');

    const init = async () => {
      try {
        await loadFaceApiModels();
        if (!isMounted) return;
        setLoadingModels(false);
        setStatusMessage('Starting camera stream...');
        startCamera();
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        if (isMounted) {
          setLoadingModels(false);
          setCameraError('Failed to load biometric models. Please ensure model files are present.');
          setStatusType('error');
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      // Ensure previous loop and frames are cancelled
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isDetectingRef.current = false;
      consecutiveFramesRef.current = 0;
      setIsVerifying(false);
      clearCanvas();

      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {}
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        const onStreamReady = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.warn('Play error:', e));
          }
          setCameraActive(true);
          setStatusMessage('Align your face inside the frame...');
          setStatusType('searching');
          isDetectingRef.current = false;
          startDetectionLoop();
        };

        if (videoRef.current.readyState >= 2) {
          onStreamReady();
        } else {
          videoRef.current.onloadeddata = onStreamReady;
          videoRef.current.onloadedmetadata = onStreamReady;
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      let msg = 'Unable to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected on this machine.';
      }
      setCameraError(msg);
      setStatusType('error');
    }
  };

  const resetFeed = async () => {
    setIsResetting(true);
    // 1. Cancel existing detection loop immediately
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    isDetectingRef.current = false;
    consecutiveFramesRef.current = 0;
    lastDescriptorRef.current = null;

    // 2. Clear visual overlay & reset states
    clearCanvas();
    setIsVerifying(false);
    setScanProgress(0);
    setFaceInFrame(false);
    setMatchedTeacher(null);
    setCameraError('');
    setCapturedSamples([]);
    setStatusType('searching');
    setStatusMessage('Re-initializing camera hardware & scanner...');

    // 3. Completely shut down previous tracks
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // 4. Brief cycle delay (120ms) to ensure browser hardware pipeline frees the sensor
    await new Promise(r => setTimeout(r, 120));

    // 5. Reinitialize camera
    await startCamera();
    setIsResetting(false);
  };

  // Safe draw face box and landmarks on canvas overlay
  const drawFaceOverlay = (detection, isVerifyingNow) => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || !video.videoWidth) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!detection || !detection.detection) return;

      const { box } = detection.detection;
      if (!box || typeof box.x !== 'number') return;

      const color = isVerifyingNow ? '#10b981' : '#38bdf8';

      // 1. Draw glowing corner target brackets
      const cornerLength = Math.max(16, Math.min(box.width, box.height) * 0.22);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + cornerLength);
      ctx.lineTo(box.x, box.y);
      ctx.lineTo(box.x + cornerLength, box.y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(box.x + box.width - cornerLength, box.y);
      ctx.lineTo(box.x + box.width, box.y);
      ctx.lineTo(box.x + box.width, box.y + cornerLength);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + box.height - cornerLength);
      ctx.lineTo(box.x, box.y + box.height);
      ctx.lineTo(box.x + cornerLength, box.y + box.height);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(box.x + box.width - cornerLength, box.y + box.height);
      ctx.lineTo(box.x + box.width, box.y + box.height);
      ctx.lineTo(box.x + box.width, box.y + box.height - cornerLength);
      ctx.stroke();

      // 2. Draw subtle biometric landmark dots
      if (detection.landmarks && Array.isArray(detection.landmarks.positions)) {
        const positions = detection.landmarks.positions;
        ctx.fillStyle = isVerifyingNow ? '#34d399' : '#a5f3fc';
        ctx.shadowBlur = 4;
        for (let i = 0; i < positions.length; i += 2) {
          const pt = positions[i];
          if (pt && typeof pt.x === 'number') {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }
    } catch (overlayErr) {
      // Silently catch overlay render error so detection is never blocked
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Main Detection Loop with High-Speed Inference and Visual Scan Timer
  const startDetectionLoop = () => {
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;

    let sampleList = [];
    let lastDetectionTime = 0;
    consecutiveFramesRef.current = 0;

    const detect = async (timestamp) => {
      if (!isDetectingRef.current || !videoRef.current) return;

      // Real-time polling: 60ms throttle (~16 FPS)
      if (timestamp - lastDetectionTime > 60) {
        lastDetectionTime = timestamp;

        try {
          // KEY FIX: Check readyState >= 2 instead of strict 4 (webcam live streams are usually readyState 2 or 3)
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0 && !isVerifying) {
            // Dual detector: fast tiny detector first (inputSize: 320 for balanced distance & speed)
            const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 });
            let result = await faceapi
              .detectSingleFace(video, tinyOptions)
              .withFaceLandmarks()
              .withFaceDescriptor();

            // Fallback to SsdMobilenetv1 if tiny detector misses face
            if (!result && faceapi.nets.ssdMobilenetv1.isLoaded) {
              result = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            }

            if (result && result.descriptor) {
              setFaceInFrame(true);
              drawFaceOverlay(result, consecutiveFramesRef.current >= 2);
              const descriptorArray = Array.from(result.descriptor);
              lastDescriptorRef.current = descriptorArray;

              if (mode === 'login') {
                // Increment consecutive frames to represent scanning progress timer (3 frames needed ~200ms)
                consecutiveFramesRef.current += 1;
                const framesNeeded = 3;
                const progressPct = Math.min(100, Math.round((consecutiveFramesRef.current / framesNeeded) * 100));
                setScanProgress(progressPct);

                if (consecutiveFramesRef.current < framesNeeded) {
                  setStatusType('scanning');
                  setStatusMessage(`Face detected! Scanning features (${progressPct}%)... Hold still`);
                } else {
                  // Reached 100% scanning progress timer -> trigger server verification
                  setIsVerifying(true);
                  isDetectingRef.current = false;
                  setStatusType('verifying');
                  setStatusMessage('âš¡ Verifying biometric identity with DepEd faculty registry...');
                  setScanProgress(100);

                  try {
                    const res = await fetch('/api/auth/teacher-face-login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        faceDescriptor: descriptorArray,
                        identifier: identifier ? identifier.trim() : undefined
                      })
                    });

                    const data = await res.json();
                    if (res.ok && data.token) {
                      setStatusMessage(`âœ… Verified! Welcome, Teacher ${data.user.full_name}!`);
                      setStatusType('success');
                      setMatchedTeacher(data.user);
                      drawFaceOverlay(result, true);
                      playSuccessChime();

                      setTimeout(() => {
                        stopCamera();
                        if (onSuccess) onSuccess(data);
                      }, 1100);
                      return;
                    } else {
                      playWarningChime();

                      // No face profile registered: stop scanning and direct to password sign-in
                      if (res.status === 404 || (data.error && data.error.includes('No teacher account with registered facial biometric data')) || (data.error && data.error.includes('No teachers currently have facial recognition enabled'))) {
                        setStatusType('error');
                        setStatusMessage('No face profile registered. Sign in with your password or ask your administrator to enroll your face.');
                        return;
                      }

                      setStatusMessage(data.error || 'Face does not match registered faculty records.');
                      setStatusType('error');
                      consecutiveFramesRef.current = 0;
                      setScanProgress(0);

                      // Short 1.4s cooldown with visual countdown before auto-resuming
                      setTimeout(() => {
                        setIsVerifying(false);
                        isDetectingRef.current = true;
                        setStatusMessage('Align your face inside the frame to retry...');
                        setStatusType('searching');
                      }, 1600);
                    }
                  } catch (netErr) {
                    playWarningChime();
                    setStatusMessage('Network connection error while verifying face.');
                    setStatusType('error');
                    consecutiveFramesRef.current = 0;
                    setScanProgress(0);
                    setTimeout(() => {
                      setIsVerifying(false);
                      isDetectingRef.current = true;
                      setStatusType('searching');
                    }, 1800);
                  }
                }

              } else if (mode === 'register') {
                // Registration mode: Capture 3 high-quality snapshots
                consecutiveFramesRef.current += 1;
                if (consecutiveFramesRef.current % 2 === 0 && sampleList.length < 3) {
                  sampleList.push(descriptorArray);
                  setCapturedSamples([...sampleList]);
                  setScanProgress(Math.round((sampleList.length / 3) * 100));
                  setStatusType('scanning');
                  setStatusMessage(`Captured sample ${sampleList.length} of 3... Hold still`);

                  if (sampleList.length >= 3) {
                    isDetectingRef.current = false;
                    setIsVerifying(true);
                    setStatusType('verifying');
                    setStatusMessage('⚡ Saving averaged biometric descriptor to database...');

                    // Average 3 samples for peak reliability
                    const avgDescriptor = new Array(128).fill(0);
                    for (const s of sampleList) {
                      for (let i = 0; i < 128; i++) avgDescriptor[i] += s[i];
                    }
                    for (let i = 0; i < 128; i++) avgDescriptor[i] /= sampleList.length;

                    try {
                      const token = localStorage.getItem('token');
                      const res = await fetch('/api/auth/teacher-face-register', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          teacher_id: teacher?.id,
                          username: teacher?.username,
                          face_descriptor: avgDescriptor
                        })
                      });

                      const data = await res.json();
                      if (res.ok) {
                        playSuccessChime();
                        setStatusMessage('✅ Facial recognition profile registered successfully!');
                        setStatusType('success');
                        setTimeout(() => {
                          stopCamera();
                          if (onSuccess) onSuccess(data);
                        }, 1200);
                        return;
                      } else {
                        playWarningChime();
                        setStatusMessage(data.error || 'Failed to save biometric profile.');
                        setStatusType('error');
                        sampleList = [];
                        setCapturedSamples([]);
                        setScanProgress(0);
                        setTimeout(() => {
                          setIsVerifying(false);
                          isDetectingRef.current = true;
                          setStatusMessage('Align your face inside the frame...');
                          setStatusType('searching');
                        }, 2000);
                      }
                    } catch (err) {
                      playWarningChime();
                      setStatusMessage('Network error saving facial descriptor.');
                      setStatusType('error');
                      sampleList = [];
                      setCapturedSamples([]);
                      setScanProgress(0);
                      setTimeout(() => {
                        setIsVerifying(false);
                        isDetectingRef.current = true;
                        setStatusMessage('Align your face inside the frame...');
                        setStatusType('searching');
                      }, 2000);
                    }
                  }
                }
              }
            } else {
              // No face in current frame
              setFaceInFrame(false);
              clearCanvas();
              if (consecutiveFramesRef.current > 0) {
                consecutiveFramesRef.current = Math.max(0, consecutiveFramesRef.current - 1);
                setScanProgress(Math.round((consecutiveFramesRef.current / 3) * 100));
              }
              if (!isVerifying && sampleList.length === 0 && statusType !== 'enroll_needed') {
                setStatusMessage('Align your face inside the frame...');
                setStatusType('searching');
              }
            }
          }
        } catch (detErr) {
          console.warn('Face detection pass notice:', detErr);
        }
      }

      if (isDetectingRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
      }
    };

    animFrameRef.current = requestAnimationFrame(detect);
  };

  // Self-Enroll Face with Password Handler
  const handleSelfEnroll = async (e) => {
    e.preventDefault();
    if (!selfEnrollPassword) {
      setSelfEnrollError('Please enter your account password.');
      return;
    }
    if (!lastDescriptorRef.current) {
      setSelfEnrollError('No face descriptor captured. Please look at the camera.');
      return;
    }

    setSelfEnrollLoading(true);
    setSelfEnrollError('');

    try {
      const res = await fetch('/api/auth/teacher-face-self-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: identifier || 'teacher',
          password: selfEnrollPassword,
          faceDescriptor: lastDescriptorRef.current
        })
      });

      const data = await res.json();
      if (res.ok && data.token) {
        playSuccessChime();
        setStatusType('success');
        setStatusMessage(`âœ… Face enrolled successfully! Welcome, Teacher ${data.user.full_name}!`);
        setTimeout(() => {
          stopCamera();
          if (onSuccess) onSuccess(data);
        }, 1100);
      } else {
        playWarningChime();
        setSelfEnrollError(data.error || 'Password verification failed.');
      }
    } catch (err) {
      setSelfEnrollError('Network error registering face profile.');
    } finally {
      setSelfEnrollLoading(false);
    }
  };

  if (!isOpen) return null;

  const isTeacherLogin = mode === 'login';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(10px)',
      padding: '16px'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '540px',
        backgroundColor: '#0f172a',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        overflow: 'hidden',
        color: '#f8fafc'
      }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #880e4f 0%, #c2185b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(194, 24, 91, 0.35)'
            }}>
              <Scan size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  {isTeacherLogin ? 'Teacher Biometric Face Login' : 'Register Teacher Face Profile'}
                </h3>
                {faceInFrame && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    border: '1px solid rgba(16, 185, 129, 0.4)'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Face Locked
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>
                {isTeacherLogin 
                  ? 'Facial recognition authentication for Class Advisers' 
                  : `Enrolling biometric features for ${teacher?.full_name || 'Teacher'}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '10px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3-Step Live Status Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '8px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '0.72rem',
          fontWeight: 700
        }}>
          {/* Step 1: Detect */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: faceInFrame ? '#34d399' : '#94a3b8'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: faceInFrame ? '#10b981' : 'rgba(255,255,255,0.1)',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.62rem'
            }}>
              {faceInFrame ? <Check size={10} /> : '1'}
            </div>
            <span>1. Detection</span>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>•</span>

          {/* Step 2: Scan */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: scanProgress > 0 ? (statusType === 'verifying' || statusType === 'success' ? '#34d399' : '#38bdf8') : '#64748b'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: scanProgress > 0 ? (statusType === 'verifying' || statusType === 'success' ? '#10b981' : '#38bdf8') : 'rgba(255,255,255,0.1)',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.62rem'
            }}>
              {statusType === 'verifying' || statusType === 'success' ? <Check size={10} /> : '2'}
            </div>
            <span>2. Feature Scan ({scanProgress}%)</span>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>•</span>

          {/* Step 3: Verify */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: statusType === 'success' ? '#34d399' : (statusType === 'verifying' ? '#f59e0b' : '#64748b')
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: statusType === 'success' ? '#10b981' : (statusType === 'verifying' ? '#f59e0b' : 'rgba(255,255,255,0.1)'),
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.62rem'
            }}>
              {statusType === 'success' ? <Check size={10} /> : '3'}
            </div>
            <span>3. Auth Verify</span>
          </div>
        </div>

        {/* Camera / Viewport Area */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '380px',
          backgroundColor: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {/* Live Video Element */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror image
              filter: loadingModels ? 'blur(10px)' : 'none',
              transition: 'filter 0.3s ease'
            }}
          />

          {/* Live Facial Landmark & Box Canvas Overlay */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror to match video
              pointerEvents: 'none'
            }}
          />

          {/* Oval Biometric Guide Frame */}
          <div style={{
            position: 'absolute',
            width: '230px',
            height: '290px',
            borderRadius: '50%',
            border: `3px ${faceInFrame ? 'solid' : 'dashed'} ${
              statusType === 'success' ? '#10b981' : 
              statusType === 'verifying' ? '#f59e0b' :
              faceInFrame ? '#38bdf8' : 
              statusType === 'error' ? '#ef4444' : '#ec4899'
            }`,
            boxShadow: `0 0 30px ${
              statusType === 'success' ? 'rgba(16, 185, 129, 0.5)' : 
              statusType === 'verifying' ? 'rgba(245, 158, 11, 0.5)' :
              faceInFrame ? 'rgba(56, 189, 248, 0.5)' : 
              'rgba(236, 72, 153, 0.25)'
            }`,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s ease'
          }}>
            {/* Animated Laser Scanning Beam */}
            {cameraActive && !matchedTeacher && statusType !== 'enroll_needed' && (
              <div style={{
                position: 'absolute',
                left: '10px',
                right: '10px',
                height: '2px',
                background: statusType === 'error' 
                  ? 'linear-gradient(90deg, transparent, #ef4444, transparent)' 
                  : statusType === 'verifying'
                  ? 'linear-gradient(90deg, transparent, #f59e0b, #fbbf24, transparent)'
                  : faceInFrame 
                  ? 'linear-gradient(90deg, transparent, #38bdf8, #34d399, transparent)'
                  : 'linear-gradient(90deg, transparent, #ec4899, #38bdf8, transparent)',
                boxShadow: faceInFrame ? '0 0 14px #38bdf8' : '0 0 10px #ec4899',
                animation: 'faceLaserScan 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite'
              }} />
            )}

            {/* Corner Alignment Reticles */}
            <div style={{ position: 'absolute', top: '-10px', width: '24px', height: '3px', background: faceInFrame ? '#38bdf8' : '#ec4899' }} />
            <div style={{ position: 'absolute', bottom: '-10px', width: '24px', height: '3px', background: faceInFrame ? '#38bdf8' : '#ec4899' }} />
            <div style={{ position: 'absolute', left: '-10px', height: '24px', width: '3px', background: faceInFrame ? '#38bdf8' : '#ec4899' }} />
            <div style={{ position: 'absolute', right: '-10px', height: '24px', width: '3px', background: faceInFrame ? '#38bdf8' : '#ec4899' }} />
          </div>

          {/* Model Loading State Overlay */}
          {loadingModels && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <RefreshCw size={38} className="animate-spin" style={{ color: '#ec4899' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.96rem' }}>Warming Up Biometric AI</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Pre-compiling neural shaders for ultra-fast face capture...
                </p>
              </div>
            </div>
          )}

          {/* Camera Error Overlay */}
          {cameraError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <AlertTriangle size={36} style={{ color: '#f59e0b' }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#fef08a' }}>Camera Notice</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '340px' }}>
                {cameraError}
              </p>
              <button
                type="button"
                onClick={resetFeed}
                disabled={isResetting}
                className="btn btn-primary"
                style={{
                  marginTop: '10px',
                  background: 'linear-gradient(135deg, #880e4f 0%, #c2185b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  opacity: isResetting ? 0.7 : 1
                }}
              >
                <RefreshCw size={14} className={isResetting ? "animate-spin" : ""} />
                <span>{isResetting ? 'Connecting...' : 'Retry Camera'}</span>
              </button>
            </div>
          )}

          {/* Registration Sample Progress Indicator */}
          {mode === 'register' && (
            <div style={{
              position: 'absolute',
              top: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Enrollment Samples:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map(step => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: capturedSamples.length >= step ? '#10b981' : 'rgba(255, 255, 255, 0.25)',
                      boxShadow: capturedSamples.length >= step ? '0 0 8px #10b981' : 'none',
                      transition: 'all 0.3s ease'
                    }} />
                    <span style={{ fontSize: '0.72rem', color: capturedSamples.length >= step ? '#34d399' : '#cbd5e1' }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-Time Scan Progress Bar Overlay (At Bottom of Camera View) */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '20px',
            right: '20px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            padding: '8px 14px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <span style={{ color: faceInFrame ? '#38bdf8' : '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {statusType === 'verifying' ? (
                  <>
                    <Zap size={13} style={{ color: '#f59e0b' }} />
                    <span>Verifying with Faculty Database...</span>
                  </>
                ) : statusType === 'success' ? (
                  <>
                    <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                    <span>Identity Confirmed</span>
                  </>
                ) : faceInFrame ? (
                  <>
                    <Eye size={13} style={{ color: '#38bdf8' }} />
                    <span>Locking Face Features ({scanProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Scan size={13} style={{ color: '#94a3b8' }} />
                    <span>Waiting for Face Alignment...</span>
                  </>
                )}
              </span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, color: '#f1f5f9' }}>
                {scanProgress}%
              </span>
            </div>

            {/* Linear Progress Fill */}
            <div style={{
              width: '100%',
              height: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${scanProgress}%`,
                background: statusType === 'success' 
                  ? '#10b981' 
                  : statusType === 'verifying' 
                  ? 'linear-gradient(90deg, #f59e0b, #eab308)' 
                  : 'linear-gradient(90deg, #ec4899, #38bdf8)',
                boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)',
                transition: 'width 0.1s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Live Status Bar & Actions */}
        <div style={{
          padding: '16px 22px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#0b1120'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              {statusType === 'success' ? (
                <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
              ) : statusType === 'error' ? (
                <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              ) : statusType === 'verifying' || statusType === 'scanning' ? (
                <RefreshCw size={18} className="animate-spin" style={{ color: statusType === 'verifying' ? '#f59e0b' : '#38bdf8', flexShrink: 0 }} />
              ) : statusType === 'enroll_needed' ? (
                <KeyRound size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
              ) : (
                <Scan size={18} style={{ color: '#ec4899', flexShrink: 0 }} />
              )}
              <span style={{
                fontSize: '0.84rem',
                fontWeight: 600,
                color: statusType === 'success' ? '#34d399' : statusType === 'error' ? '#f87171' : statusType === 'enroll_needed' ? '#fef08a' : '#f1f5f9',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {statusMessage}
              </span>
            </div>

            {/* Offline-First Badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              flexShrink: 0
            }}>
              <ShieldCheck size={11} /> 100% Local AI
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px'
              }}
            >
              <ArrowLeft size={14} />
              <span>{isTeacherLogin ? 'Return to Password Login' : 'Cancel'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {statusType === 'error' && (
                <button
                  onClick={() => {
                    setIsVerifying(false);
                    isDetectingRef.current = true;
                    setScanProgress(0);
                    consecutiveFramesRef.current = 0;
                    setStatusType('searching');
                    setStatusMessage('Align your face inside the frame...');
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px'
                  }}
                >
                  <RefreshCw size={12} /> Scan Again
                </button>
              )}

              {cameraActive && (
                <button
                  type="button"
                  onClick={resetFeed}
                  disabled={isResetting}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#e2e8f0',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: isResetting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    opacity: isResetting ? 0.6 : 1
                  }}
                  title="Restart Camera Feed & Biometric Scanner"
                >
                  <RefreshCw size={12} className={isResetting ? "animate-spin" : ""} />
                  <span>{isResetting ? 'Resetting...' : 'Reset Feed'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CSS Keyframes for Laser Beam Animation */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes faceLaserScan {
            0% { top: 15%; opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { top: 85%; opacity: 0; }
          }
        `}} />
      </div>
    </div>
  );
}
