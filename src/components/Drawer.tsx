import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Shield, Users, Truck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Mobile drawer that slides in from the left.
 * It uses a semi‑transparent backdrop and closes when the user clicks outside
 * the panel or taps the close (X) button.
 */
export default function Drawer({ open, onClose }: Props) {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isAdmin = role === 'admin' || role === 'supervisor';
  const isDriver = role === 'driver';
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer when clicking outside of it
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } bg-black/30`}
    >
      {/* Sliding panel */}
      <aside
        ref={drawerRef}
        className={`fixed inset-y-0 left-0 w-64 max-w-full bg-white text-gray-800 shadow-lg transform transition-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header inside drawer */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#0f2b5b] text-white">
          <h2 className="text-lg font-semibold">Menu</h2>
          <button onClick={onClose} aria-label="Close menu">
            <X size={20} className="text-white" />
          </button>
        </div>
        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100">
            {isAdmin ? <Shield size={16} /> : <Truck size={16} />}
            <span>Dashboard</span>
          </Link>
          {isAdmin && (
            <>
              <Link href="/driver-monitoring" className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100">
                <Truck size={16} />
                <span>Driver Monitoring</span>
              </Link>
              <Link href="/reports" className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100">
                <Users size={16} />
                <span>Reports</span>
              </Link>
            </>
          )}
          {isDriver && (
            <Link href="/my-performance" className="flex items-center gap-2 py-2 px-2 rounded hover:bg-gray-100">
              <Truck size={16} />
              <span>My Performance</span>
            </Link>
          )}
        </nav>
      </aside>
    </div>
  );
}

