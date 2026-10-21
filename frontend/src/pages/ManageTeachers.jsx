import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  UserCheck, 
  UserPlus, 
  Trash2, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Camera,
  Scan
} from 'lucide-react';
import TeacherFaceScannerModal from '../components/TeacherFaceScannerModal';
import { showConfirm, showAlert as showSwalAlert } from '../utils/dialog';
import { 
  PageTitle, 
  Card, 
  SectionCard, 
  DataTable, 
  StatusBadge, 
  Button 
} from '../components/ui';

export default function ManageTeachers() {
  const [users, setUsers] = useState([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTeacherForFace, setSelectedTeacherForFace] = useState(null);

  const loadUsers = async () => {
    try {
      const response = await apiFetch('/api/auth/users');
      if (response.ok) {
        const data = await response.json();
        // Ensure student accounts never appear on Manage Teachers
        setUsers(Array.isArray(data) ? data.filter(u => u.role !== 'student') : []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password) {
      showAlert('All fields are required.', 'error');
      return;
    }

    if (role === 'teacher') {
      const depedEmailRegex = /^[a-zA-Z0-9._%+-]+@deped\.gov\.ph$/i;
      if (!depedEmailRegex.test(username.trim())) {
        showAlert('Teachers must be registered with an official DepEd email (e.g. name@deped.gov.ph).', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          password,
          role
        })
      });

      const data = await response.json();
      if (response.ok) {
        showAlert(`User account for "${fullName}" registered successfully!`);
        setFullName('');
        setUsername('');
        setPassword('');
        setRole('teacher');
        loadUsers();
      } else {
        showAlert(data.error || 'Failed to add user.', 'error');
      }
    } catch (err) {
      showAlert('Network error registering user.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id, uname) => {
    if (uname === 'admin') {
      await showSwalAlert({
        title: 'Action Restricted',
        text: 'The primary administrator account cannot be deleted.',
        icon: 'warning'
      });
      return;
    }

    const confirmed = await showConfirm({
      title: 'Delete Faculty Account?',
      text: `Are you sure you want to delete user "${uname}"?`,
      confirmButtonText: 'Yes, Delete',
      isDanger: true
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/api/auth/users/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showAlert(`User "${uname}" removed successfully.`);
        loadUsers();
      } else {
        const data = await response.json();
        showAlert(data.error || 'Failed to delete user.', 'error');
      }
    } catch (err) {
      showAlert('Network error deleting user.', 'error');
    }
  };

  const handleClearFace = async (teacherId, teacherName) => {
    const confirmed = await showConfirm({
      title: 'Remove Facial Recognition Data?',
      text: `Are you sure you want to remove the registered facial recognition data for ${teacherName}?`,
      confirmButtonText: 'Yes, Remove Data',
      isDanger: true
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch('/api/auth/teacher-face-register', {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: teacherId,
          clear: true
        })
      });

      if (response.ok) {
        showAlert(`Facial profile removed for ${teacherName}.`);
        loadUsers();
      } else {
        const data = await response.json();
        showAlert(data.error || 'Failed to remove face profile.', 'error');
      }
    } catch (err) {
      showAlert('Network error removing face profile.', 'error');
    }
  };

  return (
    <div className="sres-manage-teachers-page">
      {/* 1. Page Header */}
      <PageTitle
        title="Faculty & Staff Management"
        emoji="👩‍🏫"
        tag={`Registered Staff: ${users.length} Accounts`}
        icon={UserCheck}
      />

      {/* Add User Form */}
      <SectionCard
        title="Register Faculty / Admin Account"
        subtitle="Create logins for class advisers and system staff"
        icon={UserPlus}
        style={{ marginBottom: '22px' }}
      >
        {alert && (
          <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '16px' }}>
            {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{alert.message}</span>
          </div>
        )}

        <form onSubmit={handleAddUser}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Tifanny Martin Aragon"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {role === 'teacher' ? 'DepEd Email Address *' : 'Username *'}
              </label>
              <input
                type={role === 'teacher' ? 'email' : 'text'}
                className="form-input"
                placeholder={role === 'teacher' ? 'e.g. tifanny.aragon@deped.gov.ph' : 'e.g. admin_office'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              {role === 'teacher' && (
                <span style={{ display: 'block', marginTop: '5px', fontSize: '0.76rem', color: 'var(--text-muted, #64748b)' }}>
                  Policy requirement: Only official <strong>@deped.gov.ph</strong> email accounts are permitted.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Initial password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Role</label>
              <select
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="teacher">Teacher / Class Adviser</option>
                <option value="admin">Administrator / School Head</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <Button type="submit" variant="primary" disabled={loading} icon={UserPlus}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </SectionCard>

      {/* Users Directory Table */}
      <SectionCard
        title="Active System Accounts"
        subtitle="List of registered faculty and administrative logins"
        icon={UserCheck}
        badge={<span className="badge badge-submitted">{users.length} Users</span>}
      >
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>No.</th>
                <th>Full Name</th>
                <th>Username / DepEd Email</th>
                <th style={{ width: '110px' }}>Role</th>
                <th style={{ width: '140px' }}>Biometric Face ID</th>
                <th style={{ width: '160px' }}>Class Roster</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id || i}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{u.full_name || 'Staff Member'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{u.username}</td>
                  <td>
                    <span className={`role-pill ${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.role === 'teacher' ? (
                      u.has_face_profile ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              borderRadius: '8px',
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onClick={() => setSelectedTeacherForFace(u)}
                            title="Face biometric active. Click to re-scan/update."
                          >
                            <CheckCircle size={13} style={{ color: '#10b981' }} />
                            <span>Active</span>
                          </button>
                          <button
                            type="button"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px 4px'
                            }}
                            onClick={() => handleClearFace(u.id, u.full_name)}
                            title="Remove face profile"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: '#fdf2f8',
                            color: '#be185d',
                            border: '1px solid #fbcfe8',
                            borderRadius: '8px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={() => setSelectedTeacherForFace(u)}
                          title="Enroll face for biometric login"
                        >
                          <Camera size={13} />
                          <span>+ Enroll</span>
                        </button>
                      )
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>N/A (Admin)</span>
                    )}
                  </td>
                  <td>
                    {u.role === 'teacher' ? (
                      u.student_count > 0 ? (
                        <span className="badge badge-submitted">
                          {u.student_count} Learners
                        </span>
                      ) : (
                        <span className="badge badge-pending" title="Fresh teacher account: Needs to import Excel roster">
                          0 (Fresh - No Roster Yet)
                        </span>
                      )
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {u.username === 'admin' ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        <Shield size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> Protected
                      </span>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Delete user"
                        onClick={() => handleDeleteUser(u.id, u.username)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {selectedTeacherForFace && (
        <TeacherFaceScannerModal
          isOpen={Boolean(selectedTeacherForFace)}
          onClose={() => setSelectedTeacherForFace(null)}
          mode="register"
          teacher={selectedTeacherForFace}
          onSuccess={() => {
            showAlert(`Face profile enrolled successfully for ${selectedTeacherForFace.full_name}!`);
            setSelectedTeacherForFace(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
