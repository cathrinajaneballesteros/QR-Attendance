import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import StatCard from '../components/StatCard';
import { 
  MessageSquare, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  PhoneOff, 
  Clock 
} from 'lucide-react';

export default function SMSLogs() {
  const [logs, setLogs] = useState([]);
  const [students, setStudents] = useState([]);
  const [smsStatus, setSmsStatus] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [msgType, setMsgType] = useState('arrived');
  const [customMsg, setCustomMsg] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [alert, setAlert] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, studentsRes, statusRes] = await Promise.all([
        apiFetch('/api/sms/logs'),
        apiFetch('/api/students'),
        apiFetch('/api/sms/status')
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData);
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSmsStatus(statusData);
      }
    } catch (err) {
      console.error('Failed to load SMS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSendSMS = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      showAlert('Please select a learner.', 'error');
      return;
    }

    const studentObj = students.find(s => String(s.id) === selectedStudent);
    const studentName = studentObj ? studentObj.full_name : 'Student';

    let message = '';
    if (msgType === 'arrived') {
      message = `Good day! ${studentName} has arrived at school. - QRAttend, Sta. Rosa ES`;
    } else if (msgType === 'absent') {
      message = `Good day! ${studentName} is absent today. Please inform the school if there is an excused reason. - QRAttend, Sta. Rosa ES`;
    } else if (msgType === 'late') {
      message = `Good day! ${studentName} arrived late at school today. - QRAttend, Sta. Rosa ES`;
    } else if (msgType === 'dismissed') {
      message = `Good day! ${studentName} has been dismissed early from school today. - QRAttend, Sta. Rosa ES`;
    } else if (msgType === 'meeting') {
      message = `Good day! This is a reminder for the upcoming Parent-Teacher Conference. Please attend. - QRAttend, Sta. Rosa ES`;
    } else if (msgType === 'custom') {
      if (!customMsg.trim()) {
        showAlert('Please write a custom SMS message.', 'error');
        return;
      }
      message = customMsg.trim();
    }

    setSending(true);
    try {
      const response = await apiFetch('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({
          student_id: parseInt(selectedStudent, 10),
          message
        })
      });

      const data = await response.json();
      if (response.ok) {
        if (data.isMock) {
          showAlert(`Simulated SMS logged for ${studentName} (${data.contact}). Note: To receive SMS on actual phones, enable Live Gateway in Settings.`, 'warning');
        } else {
          showAlert(`Real SMS notification sent to ${data.contact} for ${studentName} via ${data.provider === 'android' ? 'Android Phone SIM' : (data.provider || 'gateway').toUpperCase()}!`, 'success');
        }
        setCustomMsg('');
        loadData();
      } else {
        showAlert(data.error || 'Failed to send SMS.', 'error');
      }
    } catch (err) {
      showAlert('Network error sending SMS.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Stats calculation
  const totalSMS = logs.length;
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const mockCount = logs.filter(l => l.status === 'mock_sent').length;
  const noContactCount = logs.filter(l => l.status === 'no_contact').length;
  const todayKey = new Date().toISOString().split('T')[0];
  const todayCount = logs.filter(l => (l.created_at || '').includes(todayKey)).length;

  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      (l.full_name || '').toLowerCase().includes(search.toLowerCase().trim()) ||
      (l.guardian_contact || '').includes(search.trim()) ||
      (l.message || '').toLowerCase().includes(search.toLowerCase().trim());

    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Simulation / Not Configured Notice */}
      {smsStatus && (!smsStatus.has_api_key || smsStatus.provider === 'mock') && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={22} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.86rem', color: '#166534' }}>
                SMS Gateway is in Simulation (Mock) Mode
              </strong>
              <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '2px' }}>
                Messages are simulated locally. To send 100% free real SMS to actual mobile phones without paying any fees, connect your Android Phone in Settings.
              </div>
            </div>
          </div>
          <Link to="/settings" className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap', borderColor: '#16a34a', color: '#166534', background: '#fff' }}>
            Configure Android Phone (Free)
          </Link>
        </div>
      )}

      {/* Stats Counter */}
      <div className="stats-grid">
        <StatCard
          label="Total SMS Logs"
          value={totalSMS}
          icon={<MessageSquare size={24} />}
          color="#880e4f"
        />
        <StatCard
          label="Live Delivered"
          value={sentCount}
          icon={<CheckCircle size={24} />}
          color="#16a34a"
        />
        <StatCard
          label="Simulated (Mock)"
          value={mockCount}
          icon={<Clock size={24} />}
          color="#64748b"
        />
        <StatCard
          label="Missing Mobile"
          value={noContactCount}
          icon={<PhoneOff size={24} />}
          color="#d97706"
        />
      </div>

      {/* Dispatch SMS Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Send size={20} />
            <span>Send Parent SMS Alert</span>
          </h2>
          <p className="card-subtitle">Dispatch instant arrival, absence, or advisory notices</p>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type === 'error' ? 'danger' : alert.type === 'warning' ? 'warning' : 'success'}`} style={{ marginBottom: '16px' }}>
            {alert.type === 'error' ? <AlertCircle size={18} /> : alert.type === 'warning' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <div>{alert.message}</div>
          </div>
        )}

        <form onSubmit={handleSendSMS}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Select Student</label>
              <select
                className="form-select"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                required
              >
                <option value="">-- Choose a Learner --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.sex}) — {s.student_phone || s.guardian_contact || 'No Phone'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notification Type</label>
              <select
                className="form-select"
                value={msgType}
                onChange={(e) => setMsgType(e.target.value)}
              >
                <option value="arrived">Arrival Confirmation</option>
                <option value="absent">Absence Advisory</option>
                <option value="late">Tardy / Late Warning</option>
                <option value="dismissed">Early Dismissal Notification</option>
                <option value="meeting">Parent-Teacher Meeting Notice</option>
                <option value="custom">Custom Message</option>
              </select>
            </div>
          </div>

          {msgType === 'custom' && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Custom Message Content</label>
              <textarea
                className="form-input"
                rows="3"
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                placeholder="Type your custom SMS alert to the guardian..."
              />
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Send size={16} />
              <span>{sending ? 'Sending SMS...' : 'Send SMS Notification'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SMS Logs Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="card-title">
              <MessageSquare size={20} />
              <span>SMS Notification Logs</span>
            </h3>
            <p className="card-subtitle">Complete history of text notifications</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh Logs</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by student name, mobile, or message text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '150px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Delivery Statuses</option>
            <option value="sent">Live Sent</option>
            <option value="mock_sent">Simulated (Mock)</option>
            <option value="no_contact">No Contact</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '45px' }}>No.</th>
                <th>Learner</th>
                <th style={{ width: '130px' }}>Contact</th>
                <th>Message Content</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ width: '150px' }}>Date / Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No SMS logs found. Logs will appear automatically when attendance is scanned.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => (
                  <tr key={log.id || index}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 700 }}>{log.full_name || 'System / Batch'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {log.guardian_contact || 'N/A'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {log.message}
                    </td>
                    <td>
                      <span 
                        className={`badge ${
                          log.status === 'sent' 
                            ? 'badge-submitted' 
                            : log.status === 'mock_sent'
                            ? 'badge-pending'
                            : log.status === 'no_contact' 
                            ? 'badge-pending' 
                            : 'badge-rejected'
                        }`}
                        style={log.status === 'mock_sent' ? { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' } : {}}
                      >
                        {log.status === 'sent' ? 'Live Sent' : log.status === 'mock_sent' ? 'Simulated' : log.status === 'no_contact' ? 'No Mobile' : 'Failed'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {log.created_at || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
