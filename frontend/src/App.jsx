import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import TeacherLogin from './pages/TeacherLogin';
import AdminLogin from './pages/AdminLogin';
import StudentLogin from './pages/StudentLogin';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AttendanceScanner from './pages/AttendanceScanner';
import AttendanceHistory from './pages/AttendanceHistory';
import Students from './pages/Students';
import PrintQR from './pages/PrintQR';
import SF2Report from './pages/SF2Report';
import SF2Progress from './pages/SF2Progress';
import SMSLogs from './pages/SMSLogs';
import ManageTeachers from './pages/ManageTeachers';
import ManageStudentAccounts from './pages/ManageStudentAccounts';
import Settings from './pages/Settings';
import StudentPortal from './pages/StudentPortal';

import { AppLayout } from './components/ui';

function HomeRedirect() {
  const { user, token, loading } = useAuth();
  if (loading) return null;
  if (!token || !user) return <Navigate to="/login/teacher" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'student') return <Navigate to="/student/portal" replace />;
  return <Navigate to="/teacher/dashboard" replace />;
}

function RoleRedirect({ toTeacher, toAdmin, toStudent }) {
  const { user, token, loading } = useAuth();
  if (loading) return null;
  if (!token || !user) return <Navigate to="/login/teacher" replace />;
  if (user.role === 'admin') return <Navigate to={toAdmin || '/admin/dashboard'} replace />;
  if (user.role === 'student') return <Navigate to={toStudent || '/student/portal'} replace />;
  return <Navigate to={toTeacher || '/teacher/dashboard'} replace />;
}

function Layout({ children }) {
  return (
    <AppLayout>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* Public Login Routes */}
            <Route path="/login" element={<TeacherLogin />} />
            <Route path="/login/teacher" element={<TeacherLogin />} />
            <Route path="/teacher/login" element={<TeacherLogin />} />
            <Route path="/login/admin" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/login/student" element={<StudentLogin />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/" element={<HomeRedirect />} />

            {/* =========================================
                TEACHER EXCLUSIVE ROUTES (/teacher/*)
               ========================================= */}
            <Route path="/teacher/dashboard" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <TeacherDashboard />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/attendance" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <AttendanceScanner />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/history" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <AttendanceHistory />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/students" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <Students />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/print-qr" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <PrintQR />
              </ProtectedRoute>
            } />

            <Route path="/teacher/sf2-report" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <SF2Report />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/sf2-progress" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <SF2Progress />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/sms-logs" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <SMSLogs />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/teacher/settings" element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />

            {/* =========================================
                ADMIN EXCLUSIVE ROUTES (/admin/*)
               ========================================= */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/teachers" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <ManageTeachers />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/manage-teachers" element={<Navigate to="/admin/teachers" replace />} />

            <Route path="/admin/student-accounts" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <ManageStudentAccounts />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/history" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <AttendanceHistory />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />

            {/* =========================================
                STUDENT EXCLUSIVE ROUTES (/student/*)
               ========================================= */}
            <Route path="/student/portal" element={
              <ProtectedRoute allowedRoles={['student']}>
                <Layout>
                  <StudentPortal />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/student/dashboard" element={<Navigate to="/student/portal" replace />} />

            {/* =========================================
                LEGACY & SMART REDIRECT ROUTES
               ========================================= */}
            <Route path="/dashboard" element={<RoleRedirect toTeacher="/teacher/dashboard" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/attendance" element={<RoleRedirect toTeacher="/teacher/attendance" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/history" element={<RoleRedirect toTeacher="/teacher/history" toAdmin="/admin/history" toStudent="/student/portal" />} />
            <Route path="/students" element={<RoleRedirect toTeacher="/teacher/students" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/print-qr" element={<RoleRedirect toTeacher="/teacher/print-qr" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/sf2-report" element={<RoleRedirect toTeacher="/teacher/sf2-report" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/sf2-progress" element={<RoleRedirect toTeacher="/teacher/sf2-progress" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/sms-logs" element={<RoleRedirect toTeacher="/teacher/sms-logs" toAdmin="/admin/dashboard" toStudent="/student/portal" />} />
            <Route path="/settings" element={<RoleRedirect toTeacher="/teacher/settings" toAdmin="/admin/settings" toStudent="/student/portal" />} />

            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/student-portal" element={<Navigate to="/student/portal" replace />} />
            <Route path="/manage-teachers" element={<Navigate to="/admin/teachers" replace />} />
            <Route path="/student-accounts" element={<Navigate to="/admin/student-accounts" replace />} />

            {/* Fallback */}
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
