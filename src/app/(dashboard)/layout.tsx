'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { sidebarCollapsed } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <span className="text-gray-500 text-sm">Mengalihkan ke halaman login...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] overflow-x-hidden">
      <Sidebar />
      <div
        className={`min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
        }`}
      >
        <Header />
        <main className="p-3 sm:p-4 lg:p-6 max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
