'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import {
  LayoutDashboard,
  Truck,
  Bell,
  ClipboardList,
  Trophy,
  Gift,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount, sidebarCollapsed, toggleSidebar } = useApp();

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'supervisor', 'driver'] },
    { label: 'Driver Monitoring', href: '/driver-monitoring', icon: <Truck size={20} />, roles: ['admin', 'supervisor'] },
    { label: 'Notifikasi', href: '/notifications', icon: <Bell size={20} />, roles: ['admin', 'supervisor', 'driver'], badge: unreadCount },
    { label: 'RCA / Kejadian', href: '/rca', icon: <ClipboardList size={20} />, roles: ['admin', 'supervisor', 'driver'] },
    { label: 'Leaderboard', href: '/leaderboard', icon: <Trophy size={20} />, roles: ['admin', 'supervisor', 'driver'] },
    { label: 'Reward', href: '/reward', icon: <Gift size={20} />, roles: ['admin', 'supervisor', 'driver'] },
    { label: 'Laporan', href: '/reports', icon: <FileText size={20} />, roles: ['admin', 'supervisor'] },
    { label: 'Pengaturan Poin', href: '/settings', icon: <Settings size={20} />, roles: ['admin'] },
  ];

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin / Control Tower';
      case 'supervisor': return 'Supervisor';
      case 'driver': return 'Driver';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={14} />;
      case 'supervisor': return <Users size={14} />;
      case 'driver': return <Truck size={14} />;
      default: return null;
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-[68px]' : 'w-64'
      }`}
      style={{ backgroundColor: 'var(--sidebar)', color: 'var(--sidebar-foreground)' }}
    >
      {/* Logo Area */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-sm">
              SL
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">SILOG</h1>
              <p className="text-[10px] text-blue-300 leading-tight">Driver Control Tower</p>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-sm mx-auto">
            SL
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="text-blue-300 hover:text-white transition-colors p-1 rounded hidden lg:block"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* User Profile */}
      {!sidebarCollapsed && user && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/30 flex items-center justify-center text-blue-200 font-semibold text-sm">
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <div className="flex items-center gap-1 text-[11px] text-blue-300">
                {getRoleIcon(user.role)}
                <span>{getRoleLabel(user.role)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-1">
          {filteredNav.map(item => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-blue-500/20 text-white'
                    : 'text-blue-200/70 hover:bg-white/5 hover:text-white'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-400 rounded-r-full" />
                )}
                <span className={isActive ? 'text-blue-400' : 'text-blue-300/70 group-hover:text-blue-300'}>
                  {item.icon}
                </span>
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && item.badge && item.badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
                {sidebarCollapsed && item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 pt-2 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300/80 hover:bg-red-500/10 hover:text-red-300 transition-all w-full"
          title={sidebarCollapsed ? 'Keluar' : undefined}
        >
          <LogOut size={20} />
          {!sidebarCollapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}

