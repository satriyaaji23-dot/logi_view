'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#0f2b5b] flex items-center justify-center font-bold text-white">
          SL
        </div>
        <span className="text-lg font-semibold text-gray-600">Memuat...</span>
      </div>
    </div>
  );
}
