import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Modal from './Modal';
import { Download, Printer, Copy, Check, QrCode as QrIcon, User } from 'lucide-react';

export default function StudentQrModal({ isOpen, onClose, student }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen && student && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        student.qr_code || student.full_name,
        {
          width: 220,
          margin: 1,
          color: {
            dark: '#880e4f',
            light: '#ffffff'
          }
        },
        (error) => {
          if (error) console.error('Error rendering QR code canvas:', error);
        }
      );
    }
  }, [isOpen, student]);

  if (!student) return null;

  const handleCopyCode = async () => {
    if (!student.qr_code) return;
    try {
      await navigator.clipboard.writeText(student.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current || !student) return;
    setDownloading(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = (student.full_name || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${safeName}_QR_Badge.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download QR error:', err);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isEnrolled = student.is_enrolled === 1 || student.enrollment_status === 'officially_enrolled';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Student Attendance QR Badge" maxWidth="440px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Printable ID Card Container */}
        <div 
          className="student-id-card-print"
          style={{
            background: '#ffffff',
            border: '2px solid #880e4f',
            borderRadius: '16px',
            padding: '20px 18px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(136, 14, 79, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          {/* School Header */}
          <div style={{ borderBottom: '1px solid #f1f5f9', width: '100%', paddingBottom: '10px' }}>
            <div style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#880e4f',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Sta. Rosa Elementary School
            </div>
            <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
              Grade 6 - Great Geniuses • Room 101 • S.Y. 2026–2027
            </div>
          </div>

          {/* Scannable High-Res QR Canvas */}
          <div style={{
            background: '#fdf2f8',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #fbcfe8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <canvas 
              ref={canvasRef} 
              style={{ 
                display: 'block', 
                borderRadius: '8px',
                maxWidth: '100%',
                height: 'auto'
              }} 
            />
          </div>

          {/* Student Identity Information */}
          <div style={{ width: '100%' }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 6px 0',
              lineHeight: 1.3
            }}>
              {student.full_name}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                LRN: <strong>{student.lrn || '—'}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                background: student.sex === 'M' ? '#dbeafe' : '#fce7f3',
                color: student.sex === 'M' ? '#1d4ed8' : '#be185d'
              }}>
                {student.sex === 'M' ? 'Male' : 'Female'}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                background: isEnrolled ? '#dcfce7' : '#fee2e2',
                color: isEnrolled ? '#15803d' : '#b91c1c'
              }}>
                {isEnrolled ? 'Enrolled' : 'Not Enrolled'}
              </span>
            </div>

            {/* QR String Pill with Copy Button */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '4px 10px',
              maxWidth: '100%'
            }}>
              <span style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                color: '#880e4f',
                fontWeight: 600,
                wordBreak: 'break-all'
              }}>
                {student.qr_code || 'No QR Code'}
              </span>
              {student.qr_code && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy QR Code String"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: copied ? '#10b981' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} />
            <span>Print Badge</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={downloading || !student.qr_code}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>{downloading ? 'Downloading...' : 'Download QR (PNG)'}</span>
          </button>
        </div>

      </div>
    </Modal>
  );
}
