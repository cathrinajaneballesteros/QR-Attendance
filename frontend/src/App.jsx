import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

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

function HomeRedirect() {
  const { user, token, loading } = useAuth();
  if (loading) return null;
  if (!token || !user) return <Navigate to="/login/teacher" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'student') return <Navigate to="/student-portal" replace />;
  return <Navigate to="/dashboard" replace />;
}

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
          {/* Public Login Routes - Default is Teacher Login */}
          <Route path="/login" element={<TeacherLogin />} />
          <Route path="/login/teacher" element={<TeacherLogin />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/login/student" element={<StudentLogin />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/" element={<HomeRedirect />} />

          {/* Teacher & Admin Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <TeacherDashboard />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/attendance" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <AttendanceScanner />
              </Layout>
            </ProtectedRoute>
          } />

          {/* Historical Data (Requirement 9) */}
          <Route path="/history" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <AttendanceHistory />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/students" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <Students />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/print-qr" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <PrintQR />
            </ProtectedRoute>
          } />

          <Route path="/sf2-report" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <SF2Report />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/sf2-progress" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <SF2Progress />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/sms-logs" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <SMSLogs />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute allowedRoles={['teacher', 'admin']}>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />

          {/* Admin Only Route */}
          <Route path="/manage-teachers" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout>
                <ManageTeachers />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/student-accounts" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout>
                <ManageStudentAccounts />
              </Layout>
            </ProtectedRoute>
          } />

          {/* Student Only Route */}
          <Route path="/student-portal" element={
            <ProtectedRoute allowedRoles={['student']}>
              <Layout>
                <StudentPortal />
              </Layout>
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
