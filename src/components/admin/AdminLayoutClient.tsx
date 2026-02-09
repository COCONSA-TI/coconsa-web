'use client';

import { useState } from 'react';
import AdminNavbar from './adminNavbar';
import AdminSidebar from './adminSidebar';
import AdminFooter from './adminFooter';
import { ToastProvider } from '@/components/ui/Toast';

interface AdminLayoutClientProps {
  children: React.ReactNode;
}

export default function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <AdminNavbar onMenuClick={toggleSidebar} />
        
        <div className="flex flex-1 relative">
          {/* Overlay para cerrar sidebar en móvil */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={closeSidebar}
            />
          )}
          
          {/* Sidebar */}
          <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
          
          {/* Main content */}
          <main className="flex-1 p-4 sm:p-6 w-full lg:ml-0">
            {children}
          </main>
        </div>
        
        <AdminFooter />
      </div>
    </ToastProvider>
  );
}
