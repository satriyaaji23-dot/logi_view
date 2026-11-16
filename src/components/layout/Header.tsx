'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { Bell, Menu, Radio, Search, X } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  const { user } = useAuth();
  const { toggleMobileSidebar } = useApp();
  const {
    notifications,
    realtimeStatus,
    realtimeTransport,
    lastSyncBy,
    lastRemoteNotice,
    dismissRemoteNotice,
  } = useData();

  useEffect(() => {
    if (!lastRemoteNotice) return;
    const t = setTimeout(() => dismissRemoteNotice(), 5000);
    return () => clearTimeout(t);
  }, [lastRemoteNotice, dismissRemoteNotice]);

  const isDriver = user?.role === 'driver';
  const unreadCount = notifications.filter(
    n => (!isDriver || n.driverId === user?.driverId) && !n.readAt
  ).length;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin / Control Tower';
      case 'supervisor': return 'Supervisor';
      case 'driver': return 'Driver';
      default: return role;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200/70 px-3 sm:px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Mobile Menu toggle + Brand (mobile) / Search (desktop admin) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={toggleMobileSidebar}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors shrink-0"
            aria-label="Buka menu navigasi"
          >
            <Menu size={22} />
          </button>

          {/* Compact Mobile Brand */}
          <div className="flex items-center gap-2 lg:hidden min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#0f2b5b] flex items-center justify-center font-bold text-white text-xs shrink-0">
              SL
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0f2b5b] leading-tight truncate">SILOG</p>
              <p className="text-[10px] text-gray-500 leading-tight truncate">
                {isDriver ? 'Portal Driver' : 'Control Tower'}
              </p>
            </div>
          </div>

          {!isDriver && (
            <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-80">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari driver, pengiriman, notifikasi..."
                className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-full"
              />
            </div>
          )}
        </div>

        {/* Right: Realtime Status + Notifications + Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            title={`${realtimeTransport}${lastSyncBy ? ` · Terakhir oleh ${lastSyncBy}` : ''}`}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              realtimeStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : realtimeStatus === 'local'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : realtimeStatus === 'local'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-gray-400'
              }`}
            />
            <Radio size={12} />
            <span>{realtimeStatus === 'connected' ? 'Live Sync' : realtimeStatus === 'local' ? 'Live Tab' : 'Menghubungkan'}</span>
          </div>

          <Link
            href="/notifications"
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Notifikasi"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </Link>

          {user && (
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-gray-200">
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

      {lastRemoteNotice && (
        <div className="mt-2 bg-[#0f2b5b] text-white text-xs px-3 py-2 rounded-lg flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="truncate">
              <b>Update Realtime ({lastRemoteNotice.actor}):</b> {lastRemoteNotice.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissRemoteNotice}
            className="text-blue-200 hover:text-white shrink-0"
            aria-label="Tutup pemberitahuan realtime"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </header>
  );
}
