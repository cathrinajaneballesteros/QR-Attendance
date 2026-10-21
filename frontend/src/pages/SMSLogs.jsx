import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  MessageSquare, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  PhoneOff, 
  Clock,
  Calendar,
  Trash2,
  X 
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
  const [dateFilter, setDateFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async (targetDate = dateFilter) => {
    setLoading(true);
    try {
      const logsUrl = targetDate ? `/api/sms/logs?date=${encodeURIComponent(targetDate)}` : '/api/sms/logs';
      const [logsRes, studentsRes, statusRes] = await Promise.all([
        apiFetch(logsUrl),
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

  const handleDateChange = (newDate) => {
    setDateFilter(newDate);
    setSelectedIds([]);
    loadData(newDate);
  };

  const handleClearDate = () => {
    setDateFilter('');
    setSelectedIds([]);
    loadData('');
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredLogs.map(l => l.id).filter(Boolean);
    if (visibleIds.length === 0) return;
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      showAlert('Please select at least one SMS log to delete.', 'warning');
      return;
    }
    const count = selectedIds.length;
    if (!window.confirm(`Are you sure you want to delete ${count} selected SMS log${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await apiFetch('/api/sms/logs', {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(`Successfully deleted ${count} SMS log${count > 1 ? 's' : ''}.`, 'success');
        setSelectedIds([]);
        loadData();
      } else {
        showAlert(data.error || 'Failed to delete selected SMS logs.', 'error');
      }
    } catch (err) {
      showAlert('Network error deleting SMS logs.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this SMS log?')) return;
    try {
      const res = await apiFetch(`/api/sms/logs/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('SMS log deleted.', 'success');
        setSelectedIds(prev => prev.filter(x => x !== id));
        loadData();
      } else {
        showAlert(data.error || 'Failed to delete SMS log.', 'error');
      }
    } catch (err) {
      showAlert('Network error deleting SMS log.', 'error');
    }
  };

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
        if (data.status === 'sent') {
          const provName = data.provider === 'textbee' ? 'TextBee (Android SIM)' : (data.provider === 'android' ? 'Local Android Phone SIM' : (data.provider || 'Gateway').toUpperCase());
          showAlert(`SMS notification dispatched to ${data.contact} for ${studentName} via ${provName}!`, 'success');
        } else {
          showAlert(`Parent notification notice successfully recorded and queued in school registry for ${studentName} (${data.contact}).`, 'success');
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
  const queuedCount = logs.filter(l => l.status === 'queued' || l.status === 'mock_sent').length;
  const noContactCount = logs.filter(l => l.status === 'no_contact').length;
  const todayKey = new Date().toISOString().split('T')[0];
  const todayCount = logs.filter(l => (l.created_at || '').includes(todayKey)).length;

  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      (l.full_name || '').toLowerCase().includes(search.toLowerCase().trim()) ||
      (l.guardian_contact || '').includes(search.trim()) ||
      (l.message || '').toLowerCase().includes(search.toLowerCase().trim());

    const matchesStatus = statusFilter === 'all' 
      || l.status === statusFilter 
      || (statusFilter === 'queued' && (l.status === 'queued' || l.status === 'mock_sent'));

    const logDate = (l.created_at || '').substring(0, 10);
    const matchesDate = !dateFilter || logDate === dateFilter;

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="sres-sms-page">
      {/* 1. Page Header with Tag and Refresh */}
      <PageTitle
        title="SMS Alerts & Notifications"
        emoji="✉️"
        tag="Parent Dispatch Log & Registry"
        icon={MessageSquare}
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {/* SMS Gateway Status Notice */}
      {smsStatus && (!smsStatus.has_api_key || smsStatus.provider === 'mock') ? (
        <Card
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            marginBottom: '20px'
          }}
          padding="12px 18px"
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={22} color="#0284c7" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '0.86rem', color: '#1e293b' }}>
                  Parent SMS Registry &amp; Automated Dispatch
                </strong>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Notices are logged and queued in the official school registry. To link a direct SIM/Carrier gateway for live wireless broadcast, configure TextBee or an Android Phone Gateway in Settings.
                </div>
              </div>
            </div>
            <Link to="/settings" className="sres-btn sres-btn-secondary sres-btn-sm" style={{ whiteSpace: 'nowrap' }}>
              Configure SMS Gateway
            </Link>
          </div>
        </Card>
      ) : smsStatus && smsStatus.has_api_key && (
        <Card
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            marginBottom: '20px'
          }}
          padding="10px 18px"
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#166534' }}>
              <CheckCircle size={18} color="#16a34a" />
              <span>
                Live SMS Gateway is <strong>Active</strong>: <strong>{smsStatus.provider === 'textbee' ? 'TextBee (Free Cloud Android)' : (smsStatus.provider === 'android' ? 'Local Android IP' : smsStatus.provider?.toUpperCase())}</strong>
                {smsStatus.masked_key ? ` (${smsStatus.masked_key})` : ''}
              </span>
            </div>
            <Link to="/settings" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
              Change Settings →
            </Link>
          </div>
        </Card>
      )}

      {/* Stats Counter */}
      <div className="stats-grid" style={{ marginBottom: '22px' }}>
        <StatCard
          label="Total SMS Logs"
          value={totalSMS}
          icon={MessageSquare}
          color="#C2185B"
          bgTint="#FDF2F6"
        />
        <StatCard
          label="Live Delivered"
          value={sentCount}
          icon={CheckCircle}
          color="#10B981"
          bgTint="#ECFDF5"
        />
        <StatCard
          label="Queued / Registered"
          value={queuedCount}
          icon={Clock}
          color="#0284C7"
          bgTint="#E0F2FE"
        />
        <StatCard
          label="Missing Mobile"
          value={noContactCount}
          icon={PhoneOff}
          color="#F59E0B"
          bgTint="#FFFBEB"
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
          <button className="btn btn-secondary btn-sm" onClick={() => loadData()}>
            <RefreshCw size={14} />
            <span>Refresh Logs</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ flex: '1 1 240px', minWidth: '220px', position: 'relative' }}>
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

          {/* Delivery Status Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '150px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Delivery Statuses</option>
            <option value="sent">Live Sent</option>
            <option value="queued">Queued / Registry</option>
            <option value="no_contact">Missing Contact</option>
            <option value="failed">Failed</option>
          </select>

          {/* Filter by Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', minWidth: '150px', paddingLeft: '34px', fontSize: '0.85rem' }}
                value={dateFilter}
                onChange={(e) => handleDateChange(e.target.value)}
                title="Filter by log date"
              />
              <Calendar size={15} style={{ position: 'absolute', left: '11px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
            {dateFilter && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearDate}
                title="Clear date filter"
                style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
              >
                <X size={13} />
                <span>Clear Date</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Items Notice Banner with Action Button */}
        {selectedIds.length > 0 && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '8px',
            padding: '8px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.84rem',
            color: '#9f1239'
          }}>
            <span>
              <strong>{selectedIds.length}</strong> log record{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedIds([])}
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              >
                Deselect All
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleDeleteSelected}
                disabled={deleting}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #dc2626',
                  padding: '5px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} />
                <span>{deleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}</span>
              </button>
            </div>
          </div>
        )}

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.includes(l.id))}
                    onChange={handleToggleSelectAll}
                    title="Select/Deselect all visible logs"
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                </th>
                <th style={{ width: '45px' }}>No.</th>
                <th>Learner</th>
                <th style={{ width: '130px' }}>Contact</th>
                <th>Message Content</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ width: '150px' }}>Date / Time</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {dateFilter ? `No SMS logs found for date ${dateFilter}.` : 'No SMS logs found. Logs will appear automatically when attendance is scanned.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const isSelected = selectedIds.includes(log.id);
                  return (
                    <tr key={log.id || index} style={isSelected ? { background: '#fff1f2' } : {}}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(log.id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </td>
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
                              : (log.status === 'queued' || log.status === 'mock_sent')
                              ? 'badge-pending'
                              : log.status === 'no_contact' 
                              ? 'badge-pending' 
                              : 'badge-rejected'
                          }`}
                          style={(log.status === 'queued' || log.status === 'mock_sent') ? { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' } : {}}
                        >
                          {log.status === 'sent' ? 'Live Sent' : (log.status === 'queued' || log.status === 'mock_sent') ? 'Queued' : log.status === 'no_contact' ? 'No Mobile' : 'Failed'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.created_at || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSingle(log.id, e)}
                          title="Delete this SMS log"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
