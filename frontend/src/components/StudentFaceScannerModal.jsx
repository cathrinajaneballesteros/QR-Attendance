import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, RefreshCw, Scan, ShieldCheck, Check } from 'lucide-react';
import { faceapi, loadFaceApiModels } from '../utils/faceApi';
import { playSuccessChime, playWarningChime } from '../utils/sound';
import { apiFetch } from '../utils/api';

/**
 * StudentFaceScannerModal
 * Allows teachers/admins to enroll or update a student's facial biometric profile.
 * Props: isOpen, onClose, student { id, full_name }, onSuccess
 */
export default function StudentFaceScannerModal({ isOpen, onClose, student, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isDetectingRef = useRef(false);
  const animFrameRef = useRef(null);
  const consecutiveRef = useRef(0);

  const [loadingModels, setLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [statusMessage, setStatusMessage] = useState('Initializing biometric neural network...');
  const [statusType, setStatusType] = useState('info');
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const clearCanvas = () => {
    try {
      const c = canvasRef.current;
      if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    } catch (e) {}
  };

  const stopCamera = () => {
    isDetectingRef.current = false;
    consecutiveRef.current = 0;
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    clearCanvas();
    setCameraActive(false);
    setFaceInFrame(false);
    setScanProgress(0);
    setIsVerifying(false);
  };

  const handleClose = () => { stopCamera(); onClose(); };

  useEffect(() => {
    if (!isOpen) { stopCamera(); return; }
    let mounted = true;
    setLoadingModels(true);
    setStatusMessage('Loading biometric neural models...');
    setStatusType('info');
    setCameraError('');
    setCapturedSamples([]);
    setIsVerifying(false);
    setScanProgress(0);
    setFaceInFrame(false);
    consecutiveRef.current = 0;

    (async () => {
      try {
        await loadFaceApiModels();
        if (!mounted) return;
        setLoadingModels(false);
        startCamera();
      } catch (err) {
        if (mounted) {
          setLoadingModels(false);
          setCameraError('Failed to load biometric models. Ensure /public/models files are present.');
          setStatusType('error');
        }
      }
    })();

    return () => { mounted = false; stopCamera(); };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
      isDetectingRef.current = false;
      consecutiveRef.current = 0;
      clearCanvas();

      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const onReady = () => {
          if (videoRef.current) videoRef.current.play().catch(() => {});
          setCameraActive(true);
          setStatusMessage("Align the student's face inside the frame...");
          setStatusType('searching');
          isDetectingRef.current = false;
          startDetectionLoop();
        };
        if (videoRef.current.readyState >= 2) onReady();
        else { videoRef.current.onloadeddata = onReady; videoRef.current.onloadedmetadata = onReady; }
      }
    } catch (err) {
      let msg = 'Unable to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') msg = 'Camera permission denied. Please allow camera access.';
      else if (err.name === 'NotFoundError') msg = 'No camera device detected.';
      setCameraError(msg);
      setStatusType('error');
    }
  };

  const resetFeed = async () => {
    if (isResetting) return;
    setIsResetting(true);
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    isDetectingRef.current = false;
    consecutiveRef.current = 0;
    clearCanvas();
    setIsVerifying(false); setScanProgress(0); setFaceInFrame(false);
    setCapturedSamples([]); setCameraError('');
    setStatusType('searching'); setStatusMessage('Re-initializing camera...');
    if (streamRef.current) { try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {} streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    await new Promise(r => setTimeout(r, 120));
    await startCamera();
    setIsResetting(false);
  };

  const drawFaceOverlay = (detection, isGreen) => {
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || !video.videoWidth) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!detection || !detection.detection) return;
      const { box } = detection.detection;
      if (!box || typeof box.x !== 'number') return;
      const color = isGreen ? '#10b981' : '#38bdf8';
      const cl = Math.max(16, Math.min(box.width, box.height) * 0.22);
      ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      [
        [[box.x, box.y + cl], [box.x, box.y], [box.x + cl, box.y]],
        [[box.x + box.width - cl, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + cl]],
        [[box.x, box.y + box.height - cl], [box.x, box.y + box.height], [box.x + cl, box.y + box.height]],
        [[box.x + box.width - cl, box.y + box.height], [box.x + box.width, box.y + box.height], [box.x + box.width, box.y + box.height - cl]]
      ].forEach(pts => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
      });
      if (detection.landmarks && Array.isArray(detection.landmarks.positions)) {
        ctx.fillStyle = isGreen ? '#34d399' : '#a5f3fc'; ctx.shadowBlur = 4;
        for (let i = 0; i < detection.landmarks.positions.length; i += 2) {
          const pt = detection.landmarks.positions[i];
          if (pt && typeof pt.x === 'number') { ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI); ctx.fill(); }
        }
      }
    } catch (e) {}
  };

  const startDetectionLoop = () => {
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;
    let sampleList = [];
    let lastTime = 0;
    consecutiveRef.current = 0;

    const detect = async (timestamp) => {
      if (!isDetectingRef.current || !videoRef.current) return;
      if (timestamp - lastTime > 60) {
        lastTime = timestamp;
        try {
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0 && !isVerifying) {
            let result = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 }))
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (!result && faceapi.nets.ssdMobilenetv1.isLoaded) {
              result = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            }

            if (result && result.descriptor) {
              setFaceInFrame(true);
              drawFaceOverlay(result, consecutiveRef.current >= 2);
              const desc = Array.from(result.descriptor);
              consecutiveRef.current += 1;

              if (consecutiveRef.current % 2 === 0 && sampleList.length < 3) {
                sampleList.push(desc);
                setCapturedSamples([...sampleList]);
                setScanProgress(Math.round((sampleList.length / 3) * 100));
                setStatusType('scanning');
                setStatusMessage(`Captured sample ${sampleList.length} of 3... Hold still`);

                if (sampleList.length >= 3) {
                  isDetectingRef.current = false;
                  setIsVerifying(true);
                  setStatusType('verifying');
                  setStatusMessage('Computing averaged biometric descriptor...');

                  // Average the 3 sample vectors
                  const avg = new Array(128).fill(0);
                  for (const s of sampleList) for (let i = 0; i < 128; i++) avg[i] += s[i];
                  for (let i = 0; i < 128; i++) avg[i] /= sampleList.length;

                  try {
                    const res = await apiFetch(`/api/students/${student.id}/face`, {
                      method: 'POST',
                      body: JSON.stringify({ face_descriptor: avg })
                    });
                    const data = await res.json();
                    if (res.ok) {
                      playSuccessChime();
                      setStatusMessage(`Face profile enrolled for ${student.full_name}!`);
                      setStatusType('success');
                      setTimeout(() => { stopCamera(); if (onSuccess) onSuccess(data); }, 1400);
                    } else {
                      playWarningChime();
                      setStatusMessage(data.error || 'Failed to save biometric profile.');
                      setStatusType('error');
                      sampleList = []; setCapturedSamples([]); setScanProgress(0);
                      setTimeout(() => {
                        setIsVerifying(false); isDetectingRef.current = true;
                        setStatusMessage("Align the student's face inside the frame...");
                        setStatusType('searching');
                      }, 2200);
                    }
                  } catch (netErr) {
                    playWarningChime();
                    setStatusMessage('Network error saving facial descriptor.');
                    setStatusType('error');
                    sampleList = []; setCapturedSamples([]); setScanProgress(0);
                    setTimeout(() => {
                      setIsVerifying(false); isDetectingRef.current = true;
                      setStatusMessage("Align the student's face inside the frame...");
                      setStatusType('searching');
                    }, 2200);
                  }
                  return;
                }
              }
            } else {
              setFaceInFrame(false);
              clearCanvas();
              if (consecutiveRef.current > 0) consecutiveRef.current = Math.max(0, consecutiveRef.current - 1);
              if (!isVerifying && sampleList.length === 0) {
                setStatusMessage("Align the student's face inside the frame...");
                setStatusType('searching');
              }
            }
          }
        } catch (e) {}
      }
      if (isDetectingRef.current) animFrameRef.current = requestAnimationFrame(detect);
    };
    animFrameRef.current = requestAnimationFrame(detect);
  };

  if (!isOpen) return null;

  const STATUS_COLORS = {
    info: '#94a3b8', searching: '#38bdf8', scanning: '#a78bfa',
    verifying: '#f59e0b', success: '#10b981', error: '#ef4444'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '510px', backgroundColor: '#0f172a', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', overflow: 'hidden', color: '#f8fafc' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '0.97rem', fontWeight: 800 }}>Enroll Student Face Profile</h3>
                {faceInFrame && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.18)', color: '#34d399', fontSize: '0.63rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.35)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Face Detected
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                Biometric ID for: <strong style={{ color: '#e2e8f0' }}>{student?.full_name}</strong>
              </p>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '9px', padding: '6px', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
            <X size={17} />
          </button>
        </div>

        {/* Step Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '7px 16px', background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.71rem', fontWeight: 700 }}>
          {[
            { label: '1. Detect', active: faceInFrame },
            { label: `2. Sample (${scanProgress}%)`, active: statusType === 'verifying' || statusType === 'success' },
            { label: '3. Save', active: statusType === 'success' }
          ].map((step, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: 'rgba(255,255,255,0.18)' }}>•</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: step.active ? '#34d399' : '#64748b' }}>
                <div style={{ width: 15, height: 15, borderRadius: '50%', background: step.active ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                  {step.active ? <Check size={9} /> : i + 1}
                </div>
                {step.label}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Camera */}
        <div style={{ position: 'relative', width: '100%', height: '320px', backgroundColor: '#020617', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: loadingModels ? 'blur(10px)' : 'none', transition: 'filter 0.3s ease' }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />

          {(loadingModels || !cameraActive) && !cameraError && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ animation: 'sfm-spin 1.2s linear infinite' }}><Scan size={36} color="#38bdf8" /></div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>{statusMessage}</p>
            </div>
          )}

          {cameraError && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#f59e0b" />
              <p style={{ color: '#fbbf24', fontSize: '0.83rem', margin: 0 }}>{cameraError}</p>
              <button onClick={resetFeed} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '9px', padding: '7px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                <RefreshCw size={13} /> Retry Camera
              </button>
            </div>
          )}

          {capturedSamples.length > 0 && (
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: capturedSamples[i] ? '#10b981' : 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.3)', transition: 'background 0.3s', boxShadow: capturedSamples[i] ? '0 0 7px rgba(16,185,129,0.6)' : 'none' }} />
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div style={{ padding: '9px 18px', background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[statusType] || '#94a3b8', flexShrink: 0 }} />
            <span style={{ color: STATUS_COLORS[statusType] || '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>{statusMessage}</span>
          </div>
          {cameraActive && !isVerifying && statusType !== 'success' && (
            <button onClick={resetFeed} disabled={isResetting} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '3px 9px', color: '#94a3b8', cursor: isResetting ? 'not-allowed' : 'pointer', fontSize: '0.71rem', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <RefreshCw size={11} /> Reset
            </button>
          )}
        </div>

        {/* Instructions */}
        <div style={{ padding: '9px 20px 13px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.5 }}>
            <strong style={{ color: '#94a3b8' }}>Instructions:</strong> Have the student face the camera in good lighting.
            3 face samples are captured and averaged automatically. This biometric data prevents proxy QR attendance.
          </p>
        </div>
      </div>
      <style>{`@keyframes sfm-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
