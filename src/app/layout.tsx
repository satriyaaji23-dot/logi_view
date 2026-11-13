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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${inter.className} ${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <DataProvider>
            <AppProvider>
              {children}
            </AppProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
