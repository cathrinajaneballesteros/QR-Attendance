import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--primary)', fontWeight: 600 }}>
        Loading session...
      </div>
    );
  }

  if (!token || !user) {
    if (allowedRoles.includes('admin') && !allowedRoles.includes('teacher')) {
      return <Navigate to="/login/admin" replace />;
    }
    if (allowedRoles.includes('student')) {
      return <Navigate to="/login/student" replace />;
    }
    return <Navigate to="/login/teacher" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to their default landing page
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'student') return <Navigate to="/student-portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
