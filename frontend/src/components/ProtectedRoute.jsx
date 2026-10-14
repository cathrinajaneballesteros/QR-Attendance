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
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to their default landing page
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'student') return <Navigate to="/student-portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
