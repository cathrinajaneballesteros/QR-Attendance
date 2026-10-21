import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = user?.role || 'teacher';

  return (
    <div className={`sres-app-shell sres-app-shell-${role}`} data-role={role}>
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="sres-main-content">
        <div className="sres-content-inner">
          {children}
        </div>
      </main>
    </div>
  );
}
