import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { 
  UserCheck, 
  UserPlus, 
  Trash2, 
  Shield, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

export default function ManageTeachers() {
  const [users, setUsers] = useState([]);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    try {
      const response = await apiFetch('/api/auth/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
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
      alert('The primary administrator account cannot be deleted.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${uname}"?`)) {
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

  return (
    <div>
      {/* Add User Form */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <UserPlus size={22} />
              <span>Register Faculty / Admin Account</span>
            </h2>
            <p className="card-subtitle">Create logins for class advisers and system staff</p>
          </div>
        </div>

        {alert && (
          <div className={`alert ${alert.type === 'error' ? 'alert-error' : 'alert-success'}`}>
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
              <label className="form-label">Username *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. teacher_tifanny"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <UserPlus size={15} />
              <span>{loading ? 'Creating account...' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Users Directory Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <UserCheck size={20} />
              <span>Active System Accounts</span>
            </h3>
            <p className="card-subtitle">List of registered faculty and administrative logins</p>
          </div>
          <span className="badge badge-submitted">{users.length} Users</span>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px' }}>No.</th>
                <th>Full Name</th>
                <th>Username</th>
                <th style={{ width: '130px' }}>Role</th>
                <th style={{ width: '190px' }}>Class Roster</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
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
      </div>
    </div>
  );
}
