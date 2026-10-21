import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  PageTitle, 
  Card, 
  SectionCard, 
  StatCard, 
  DataTable, 
  StatusBadge, 
  Button 
} from '../components/ui';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  UserX, 
  GraduationCap, 
  KeyRound, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Filter, 
  Printer, 
  Copy, 
  Check, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import { showConfirm } from '../utils/dialog';

export default function ManageStudentAccounts() {
  const [loading, setLoading] = useState(true);
  const [teachersSummary, setTeachersSummary] = useState([]);
  const [totals, setTotals] = useState({ total_students: 0, total_registered: 0, total_unregistered: 0 });
  const [unregisteredStudents, setUnregisteredStudents] = useState([]);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('unregistered'); // 'unregistered' | 'teachers' | 'registered'
  const [creatingId, setCreatingId] = useState(null);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [alert, setAlert] = useState(null);
  const [copiedUser, setCopiedUser] = useState(null);
  const [printModal, setPrintModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setAlert(null);
    try {
      const [sumRes, unregRes, regRes] = await Promise.all([
        apiFetch('/api/student-account/teachers-summary'),
        apiFetch(`/api/student-account/unregistered?teacher_id=${selectedTeacher}`),
        apiFetch(`/api/student-account/registered?teacher_id=${selectedTeacher}`)
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setTeachersSummary(sumData.teachers || []);
        if (sumData.totals) setTotals(sumData.totals);
      }

      if (unregRes.ok) {
        const unregData = await unregRes.json();
        setUnregisteredStudents(unregData || []);
      }

      if (regRes.ok) {
        const regData = await regRes.json();
        setRegisteredStudents(regData || []);
      }
    } catch (err) {
      console.error('Failed to load student account data:', err);
      setAlert({ type: 'error', message: 'Failed to connect to student account service.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTeacher]);

  const handleCreateSingle = async (student) => {
    setCreatingId(student.id);
    setAlert(null);
    try {
      const res = await apiFetch('/api/student-account/create-default', {
        method: 'POST',
        body: JSON.stringify({
          student_id: student.id,
          username: student.default_username,
          password: student.default_password || 'Password'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAlert({
          type: 'success',
          message: `Created account for ${data.full_name}! Username: ${data.username} | Password: ${data.password}`
        });
        loadData();
      } else {
        setAlert({ type: 'error', message: data.error || 'Failed to create student account.' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Network error creating student account.' });
    } finally {
      setCreatingId(null);
    }
  };

  const handleBulkCreate = async (teacherId = null) => {
    const target = teacherId || selectedTeacher;
    const targetLabel = teacherId 
      ? teachersSummary.find(t => t.teacher_id === teacherId)?.teacher_name || 'selected teacher'
      : (selectedTeacher === 'all' ? 'ALL unregistered students' : 'selected teacher roster');

    const confirmed = await showConfirm({
      title: 'Generate Student Portal Accounts?',
      text: `Create student credentials for ${targetLabel}? Default credentials will be:\nUsername: LastnameFirstname\nPassword: Password`,
      confirmButtonText: 'Generate Accounts',
      icon: 'question'
    });
    if (!confirmed) {
      return;
    }

    setBulkCreating(true);
    setAlert(null);
    try {
      const res = await apiFetch('/api/student-account/bulk-create', {
        method: 'POST',
        body: JSON.stringify({ teacher_id: target })
      });

      const data = await res.json();
      if (res.ok) {
        setAlert({
          type: 'success',
          message: data.message || `Successfully created ${data.count} student accounts!`
        });
        loadData();
      } else {
        setAlert({ type: 'error', message: data.error || 'Failed to bulk-create accounts.' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Network error bulk-creating student accounts.' });
    } finally {
      setBulkCreating(false);
    }
  };

  const handleResetPassword = async (studentId, studentName) => {
    const confirmed = await showConfirm({
      title: 'Reset Student Password?',
      text: `Reset password for ${studentName} back to the default password ('Password')?`,
      confirmButtonText: 'Reset Password',
      icon: 'question'
    });
    if (!confirmed) {
      return;
    }

    try {
      const res = await apiFetch('/api/student-account/reset-default-password', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId })
      });

      const data = await res.json();
      if (res.ok) {
        setAlert({
          type: 'success',
          message: `Password for ${studentName} has been reset to default: Password`
        });
      } else {
        setAlert({ type: 'error', message: data.error || 'Failed to reset password.' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Network error resetting password.' });
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedUser(key);
    setTimeout(() => setCopiedUser(null), 2000);
  };

  // Filtered lists
  const filteredUnregistered = unregisteredStudents.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) ||
           (s.lrn || '').toLowerCase().includes(q) ||
           (s.default_username || '').toLowerCase().includes(q);
  });

  const filteredRegistered = registeredStudents.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) ||
           (s.lrn || '').toLowerCase().includes(q) ||
           (s.username || '').toLowerCase().includes(q);
  });

  return (
    <div className="sres-student-accounts-page">
      {/* 1. Page Header with Tag and Actions */}
      <PageTitle
        title="Student Account Management"
        emoji="🎓"
        tag="Standardized Student Portal Access & Credentials"
        icon={GraduationCap}
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button 
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button 
              variant="secondary"
              size="sm"
              icon={Printer}
              onClick={() => setPrintModal(true)}
            >
              Print Credentials Slip
            </Button>
            {totals.total_unregistered > 0 && (
              <Button 
                variant="primary"
                size="sm"
                icon={Sparkles}
                onClick={() => handleBulkCreate(null)}
                disabled={bulkCreating}
              >
                {bulkCreating ? 'Creating Accounts...' : `Bulk Create All (${totals.total_unregistered})`}
              </Button>
            )}
          </div>
        }
      />

      {/* Alert Banner */}
      {alert && (
        <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '20px' }}>
          {alert.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <div style={{ flex: 1, fontSize: '0.88rem' }}>{alert.message}</div>
          <button 
            type="button" 
            onClick={() => setAlert(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard
          label="Unregistered Students"
          value={totals.total_unregistered}
          icon={UserX}
          color="#EF4444"
          bgTint="#FEF2F2"
        />
        <StatCard
          label="Registered Student Accounts"
          value={totals.total_registered}
          icon={UserCheck}
          color="#10B981"
          bgTint="#ECFDF5"
        />
        <StatCard
          label="Total Class Learners"
          value={totals.total_students}
          icon={GraduationCap}
          color="#C2185B"
          bgTint="#FDF2F6"
        />
        <StatCard
          label="Advisory Teachers"
          value={teachersSummary.length}
          icon={Building}
          color="#6366F1"
          bgTint="#EEF2FF"
        />
      </div>

      {/* Credentials Policy Notice Card */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
        border: '1.5px solid #bfdbfe',
        padding: '18px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#2563eb',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <KeyRound size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#1e3a8a' }}>
              Standard Student Account Credentials Rule
            </div>
            <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '2px' }}>
              All new accounts are provisioned with: 
              <span style={{ margin: '0 6px', padding: '2px 8px', background: '#dbeafe', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e40af' }}>
                Username: LastnameFirstname
              </span>
              and default 
              <span style={{ margin: '0 6px', padding: '2px 8px', background: '#dbeafe', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1e40af' }}>
                Password: Password
              </span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
          color: '#475569',
          background: 'white',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #cbd5e1'
        }}>
          <ShieldCheck size={16} color="#16a34a" />
          <span>Learners can change their password anytime via the Student Portal.</span>
        </div>
      </div>

      {/* SECTION 1: Teachers with Unregistered Student Accounts */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} />
              <span>Teachers With Unregistered Student Accounts</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Review which teachers' class rosters still have students without portal login credentials.
            </p>
          </div>
          <span className="badge badge-submitted">{teachersSummary.length} Teachers</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {teachersSummary.map((t) => (
            <div 
              key={t.teacher_id} 
              style={{
                background: t.has_unregistered ? '#fff9fb' : '#f8fafc',
                border: t.has_unregistered ? '1.5px solid var(--primary-border)' : '1px solid #e2e8f0',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary)' }}>
                    {t.teacher_name}
                  </div>
                  {t.has_unregistered ? (
                    <span className="badge badge-late" style={{ fontSize: '0.72rem' }}>
                      <AlertTriangle size={12} /> {t.unregistered_count} Unregistered
                    </span>
                  ) : (
                    <span className="badge badge-present" style={{ fontSize: '0.72rem' }}>
                      <CheckCircle2 size={12} /> All Registered
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Username: <strong style={{ color: 'var(--text-primary)' }}>@{t.teacher_username}</strong> • Room: Grade 6 Great Geniuses
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Registered: {t.registered_count} / {t.total_students}</span>
                    <span>{t.total_students > 0 ? Math.round((t.registered_count / t.total_students) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${t.total_students > 0 ? (t.registered_count / t.total_students) * 100 : 0}%`,
                      background: 'var(--accent-gradient)',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, fontSize: '0.76rem' }}
                  onClick={() => {
                    setSelectedTeacher(t.teacher_id);
                    setActiveTab('unregistered');
                  }}
                >
                  <span>Filter Students</span>
                </button>
                {t.has_unregistered && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, fontSize: '0.76rem' }}
                    onClick={() => handleBulkCreate(t.teacher_id)}
                    disabled={bulkCreating}
                  >
                    <span>Create All ({t.unregistered_count})</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Student Account Workspace & Management */}
      <div className="card">
        {/* Workspace Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'unregistered' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('unregistered')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <UserX size={15} />
              <span>Unregistered Students ({unregisteredStudents.length})</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'registered' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('registered')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <UserCheck size={15} />
              <span>Registered Accounts ({registeredStudents.length})</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} color="var(--text-muted)" />
              <select
                className="form-select"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.82rem', width: 'auto' }}
              >
                <option value="all">All Class Advisers</option>
                {teachersSummary.map(t => (
                  <option key={t.teacher_id} value={t.teacher_id}>
                    {t.teacher_name} ({t.unregistered_count} pending)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '30px', padding: '6px 12px 6px 30px', fontSize: '0.82rem', width: '220px' }}
              />
            </div>
          </div>

        </div>

        {/* TAB 1: UNREGISTERED STUDENTS TABLE */}
        {activeTab === 'unregistered' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Showing <strong>{filteredUnregistered.length}</strong> learners who currently do not have a portal login account.
              </div>
              {filteredUnregistered.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleBulkCreate(null)}
                  disabled={bulkCreating}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={14} />
                  <span>{bulkCreating ? 'Processing...' : `Create Accounts for All (${filteredUnregistered.length})`}</span>
                </button>
              )}
            </div>

            <div className="table-responsive" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Learner Full Name</th>
                    <th>LRN</th>
                    <th>Class Adviser</th>
                    <th>Default Username</th>
                    <th>Default Password</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnregistered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        🎉 Great news! All students in this roster have registered accounts.
                      </td>
                    </tr>
                  ) : (
                    filteredUnregistered.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.full_name}</div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID #{s.id} • {s.sex === 'M' ? 'Male' : 'Female'}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                          {s.lrn || '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {s.teacher_name || 'Unassigned'}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'var(--primary)'
                          }}>
                            {s.default_username}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef3c7',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#92400e'
                          }}>
                            Password
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCreateSingle(s)}
                            disabled={creatingId === s.id}
                            style={{ fontSize: '0.76rem', padding: '5px 12px' }}
                          >
                            <UserPlus size={13} />
                            <span>{creatingId === s.id ? 'Creating...' : 'Create Account'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTERED STUDENTS TABLE */}
        {activeTab === 'registered' && (
          <div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Showing <strong>{filteredRegistered.length}</strong> active learner accounts.
            </div>

            <div className="table-responsive" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Learner Full Name</th>
                    <th>LRN</th>
                    <th>Class Adviser</th>
                    <th>Username</th>
                    <th>Account Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No registered student accounts found.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistered.map((s) => (
                      <tr key={s.student_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.full_name}</div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Student ID #{s.student_id}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                          {s.lrn || '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {s.teacher_name || 'Unassigned'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.82rem',
                              fontWeight: 700
                            }}>
                              {s.username}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(s.username, `user_${s.student_id}`)}
                              title="Copy username"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
                            >
                              {copiedUser === `user_${s.student_id}` ? (
                                <Check size={14} color="#16a34a" />
                              ) : (
                                <Copy size={14} color="var(--text-muted)" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Active'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetPassword(s.student_id, s.full_name)}
                            title="Reset password to default 'Password'"
                            style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                          >
                            <KeyRound size={13} />
                            <span>Reset to Default PW</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* PRINT CREDENTIALS MODAL */}
      {printModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Student Login Credentials Slip</h3>
              <button className="modal-close" onClick={() => setPrintModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Below is the printable list of student accounts with standardized default credentials to distribute to learners and parents.
            </p>

            <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <table style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Learner Name</th>
                    <th>LRN</th>
                    <th>Username</th>
                    <th>Default Password</th>
                  </tr>
                </thead>
                <tbody>
                  {[...registeredStudents, ...unregisteredStudents].map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                      <td>{s.lrn || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {s.username || s.default_username}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>Password</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setPrintModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
