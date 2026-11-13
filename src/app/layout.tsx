import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { DataProvider } from '@/context/DataContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SILOG Driver Control Tower',
  description: 'Sistem Monitoring dan Pengendalian Kinerja Driver - PT Semen Indonesia Logistik',
};

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { DataProvider } from '@/context/DataContext';
import RoleBasedLayout from '@/components/RoleBasedLayout';
import MobileHeader from '@/components/MobileHeader';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SILOG Driver Control Tower',
  description: 'Sistem Monitoring dan Pengendalian Kinerja Driver - PT Semen Indonesia Logistik',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${inter.className} ${inter.variable} font-sans antialiased`}>
        {/* Mobile header for small screens */}
        <MobileHeader />
        {/* Role‑based wrapper provides a sidebar for desktop and a drawer for mobile */}
        <RoleBasedLayout>{children}</RoleBasedLayout>
        {/* Providers are kept inside the layout so they wrap the whole app */}
        <AuthProvider>
          <DataProvider>
            <AppProvider />
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
