import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Shield, Users, Truck } from 'lucide-react';

/**
 * Layout wrapper that shows different navigation / controls based on the logged‑in user role.
 * - `admin` / `supervisor` → full Control Tower UI (can edit driver data, view all stats)
 * - `driver`            → driver‑only UI (focuses on personal performance, no edit controls)
 */
export default function RoleBasedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? '';

  const isAdmin = role === 'admin' || role === 'supervisor';
  const isDriver = role === 'driver';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f0f4f8]">
      {/* Sidebar – visible on larger screens, collapsible on mobile */}
      <aside className="lg:w-64 w-full bg-[#0f2b5b] text-white lg:block hidden">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">SILOG</h2>
          <nav className="space-y-2">
            <a href="/dashboard" className="block hover:bg-[#173b78] rounded px-3 py-2">
              {isAdmin ? <Shield size={16} className="inline mr-2" /> : <Truck size={16} className="inline mr-2" />}
              Dashboard
            </a>
            {isAdmin && (
              <>
                <a href="/driver-monitoring" className="block hover:bg-[#173b78] rounded px-3 py-2">Driver Monitoring</a>
                <a href="/reports" className="block hover:bg-[#173b78] rounded px-3 py-2">Reports</a>
                {/* Add more admin‑only links here */}
              </>
            )}
            {isDriver && (
              <a href="/my-performance" className="block hover:bg-[#173b78] rounded px-3 py-2">My Performance</a>
            )}
          </nav>
        </div>
      </aside>

      {/* Main content area – mobile friendly */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

