import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, downloadWithAuth } from '../utils/api';
import { 
  Users, 
  Check, 
  X, 
  Percent, 
  Scan, 
  Calendar,
  Zap, 
  UserPlus, 
  FileText, 
  Mail, 
  GraduationCap, 
  Download,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import {
  PageTitle,
  Card,
  SectionCard,
  FeatureCard,
  StatCard,
  StepGuide,
  DataTable,
  StatusBadge,
  LivePill,
  EmptyState,
  ActionRow,
  Button
} from '../components/ui';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ 
    total_students: 0, 
    present_today: 0, 
    absent_today: 0, 
    attendance_rate: 0,
    room: 'Room 101',
    attendance_mode: 'onsite'
  });
  const [todayRecords, setTodayRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, recordsRes] = await Promise.all([
        apiFetch('/api/attendance/summary'),
        apiFetch('/api/attendance/today')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setTodayRecords(recordsData);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.full_name || user?.username || 'Ms. Aragon';
  const roomTag = stats.room ? `Grade 6 • ${stats.room.replace(/Room 101.*/, 'Room 101')}` : 'Grade 6 • Room 101';
  const absentCount = stats.absent_today ?? (stats.total_students ? Math.max(0, stats.total_students - (stats.present_today || 0)) : 0);

  return (
    <div className="sres-dashboard-page">
      {/* 1. Page Header with Greeting & Pill Tag */}
      <PageTitle
        title={`${getGreeting()}, ${displayName}`}
        emoji="👋"
        tag={roomTag}
        icon={GraduationCap}
        action={
          <button 
            type="button"
            className="sres-btn sres-btn-secondary sres-btn-sm"
            onClick={loadData}
            disabled={loading}
            title="Refresh Attendance Data"
          >
            <RefreshCw size={13} strokeWidth={1.8} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Fresh Account Onboarding: Prompt to import Excel when roster is empty */}
      {stats.total_students === 0 && !loading && (
        <Card 
          style={{
            background: 'linear-gradient(135deg, #FFF5F8 0%, #FFFFFF 100%)',
            border: '1.5px dashed var(--border-pink)',
            marginBottom: '20px'
          }}
          padding="18px 22px"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '640px' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--primary-gradient)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(107, 15, 58, 0.2)'
              }}>
                <FileSpreadsheet size={22} strokeWidth={1.8} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 3px 0' }}>
                  Setup Your Class Roster: Import from Excel
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  Your account currently has no learners. Import your DepEd SF2 Excel file to register learners and generate QR codes automatically.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to="/teacher/students?import=true" className="sres-btn sres-btn-primary sres-btn-sm">
                <FileSpreadsheet size={14} strokeWidth={1.8} />
                <span>Import Excel Roster</span>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* 2. Top Dashboard Grid: Feature Card (60%) + 2x2 Stat Cards (40%) */}
      <div className="sres-grid-dashboard-top">
        {/* Left: Scan Student QR Code Banner */}
        <FeatureCard
          title="Scan Student QR Code"
          description="Record attendance in seconds."
          buttonText="Open QR Scanner"
          buttonIcon={Scan}
          buttonTo="/teacher/attendance"
        />

        {/* Right: 2x2 Stat Grid */}
        <div className="sres-grid-stats-2x2">
          {/* Total Learners */}
          <StatCard
            label="Total Learners"
            value={stats.total_students || 0}
            icon={Users}
            color="#C2185B"
            bgTint="#FDF2F6"
            to="/teacher/students"
          />

          {/* Present Today */}
          <StatCard
            label="Present Today"
            value={stats.present_today || 0}
            icon={Check}
            color="#10B981"
            bgTint="#ECFDF5"
            to="/teacher/history"
          />

          {/* Absent Today */}
          <StatCard
            label="Absent Today"
            value={absentCount}
            icon={X}
            color="#EF4444"
            bgTint="#FEF2F2"
            to="/teacher/sms-logs"
          />

          {/* Attendance Rate */}
          <StatCard
            label="Attendance Rate"
            value={`${stats.attendance_rate || 0}%`}
            icon={Percent}
            color="#8B5CF6"
            bgTint="#F5F3FF"
            to="/teacher/sf2-report"
          />
        </div>
      </div>

      {/* 3. Middle: Quick Guide / Step Guide */}
      <div style={{ marginTop: '20px' }}>
        <StepGuide
          title="Quick Guide"
          description="Follow these 3 simple steps to record attendance."
          steps={[
            'Open scanner',
            'Scan learner QR',
            'Confirm attendance'
          ]}
        />
      </div>

      {/* 4. Bottom Grid: Today's Attendance (60%) + Quick Access (40%) */}
      <div className="sres-grid-dashboard-bottom">
        {/* Left: Today's Attendance Feed */}
        <SectionCard
          title="Today's Attendance"
          subtitle="Live updates for your class"
          icon={Calendar}
          badge={<LivePill />}
          action={
            todayRecords.length > 0 && (
              <button
                type="button"
                className="sres-btn sres-btn-secondary sres-btn-sm"
                onClick={() => downloadWithAuth(
                  `/api/attendance/export?from=${new Date().toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`, 
                  `attendance_${new Date().toISOString().split('T')[0]}.csv`
                )}
                title="Export today's attendance to CSV"
              >
                <Download size={13} strokeWidth={1.8} />
                <span>Export</span>
              </button>
            )
          }
        >
          {todayRecords.length === 0 ? (
            <EmptyState
              title="No attendance records yet"
              hint="Start by scanning a student QR code to record attendance for your class."
              buttonText="Start by scanning a student QR code"
              buttonIcon={Scan}
              buttonTo="/attendance"
            />
          ) : (
            <DataTable
              columns={[
                { label: 'Learner' },
                { label: 'Time In' },
                { label: 'Status' }
              ]}
            >
              {todayRecords.map((r, i) => (
                <tr key={r.id || i}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)' }}>
                        {r.full_name}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {r.sex === 'M' ? 'Male' : 'Female'} • LRN: {r.lrn || '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: 'var(--text-heading)' }}>
                    {r.time_in || '—'}
                  </td>
                  <td>
                    <StatusBadge
                      variant={r.status === 'late' ? 'warning' : 'success'}
                      label={r.status === 'late' ? 'Late' : 'Present'}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>

        {/* Right: Quick Access */}
        <SectionCard
          title="Quick Access"
          subtitle="Get to the most important tools"
          icon={Zap}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <ActionRow
              title="Import Class List"
              description="Add or update your class roster from a file."
              icon={UserPlus}
              iconColor="#C2185B"
              iconBg="#FDF2F6"
              to="/teacher/students?import=true"
            />

            <ActionRow
              title="View SF2 Report"
              description="Generate and manage your SF2 reports."
              icon={FileText}
              iconColor="#6366F1"
              iconBg="#EEF2FF"
              to="/teacher/sf2-report"
            />

            <ActionRow
              title="Send Absence Alerts"
              description="Notify parents about student absences via SMS."
              icon={Mail}
              iconColor="#C2185B"
              iconBg="#FDF2F6"
              to="/teacher/sms-logs"
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

