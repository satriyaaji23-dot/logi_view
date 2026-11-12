'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Bell, Menu, Search } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { user } = useAuth();
  const { unreadCount, toggleSidebar } = useApp();

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin / Control Tower';
      case 'supervisor': return 'Supervisor';
      case 'driver': return 'Driver';
      default: return role;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Menu toggle + Search */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-80">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Cari driver, pengiriman, notifikasi..."
              className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-full"
            />
          </div>
        </div>

        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-[11px] text-gray-500">{getRoleLabel(user.role)}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0f2b5b] flex items-center justify-center text-white font-semibold text-sm">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

