import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { apiFetch } from '../utils/api';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

function StudentIDCard({ student }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        student.qr_code || student.full_name,
        {
          width: 130,
          margin: 1,
          color: {
            dark: '#880e4f',
            light: '#ffffff'
          }
        },
        (error) => {
          if (error) console.error(error);
        }
      );
    }
  }, [student]);

  return (
    <div style={{
      border: '2px solid #880e4f',
      borderRadius: '14px',
      padding: '16px',
      textAlign: 'center',
      background: 'white',
      pageBreakInside: 'avoid',
      boxShadow: '0 4px 12px rgba(136, 14, 79, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: '270px'
    }}>
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#880e4f', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Sta. Rosa Elementary School
        </div>
        <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
          Grade 6 - Great Geniuses • Room 101 • S.Y. 2026–2027
        </div>
      </div>

      <div style={{ margin: '10px 0' }}>
        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto', borderRadius: '8px' }} />
      </div>

      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
          {student.full_name}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
          LRN: {student.lrn || 'N/A'} • {student.sex === 'M' ? 'Male' : 'Female'}
        </div>
        <div style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: '#880e4f', marginTop: '2px' }}>
          {student.qr_code}
        </div>
      </div>
    </div>
  );
}

export default function PrintQR() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await apiFetch('/api/students');
        if (response.ok) {
          const data = await response.json();
          setStudents(data);
        }
      } catch (err) {
        console.error('Error fetching students:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--primary)' }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 600 }}>Generating QR Code ID Badges...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        background: 'white',
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/teacher/students" className="btn btn-secondary btn-sm">
            <ArrowLeft size={15} />
            <span>Back to Students</span>
          </Link>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
            Batch QR ID Cards ({students.length} Learners)
          </span>
        </div>

        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} />
          <span>Print All ID Badges</span>
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        {students.map((student) => (
          <StudentIDCard key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
}
