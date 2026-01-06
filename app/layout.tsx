import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AgriConnect Marketplace',
    template: '%s | AgriConnect',
  },
  description:
    'Discover, buy, and sell farm produce near you. Real-time marketplace connecting farmers, buyers, and traders.',
  keywords: [
    'agriculture',
    'farm produce',
    'marketplace',
    'farmers',
    'buyers',
    'Uganda',
    'AgriConnect',
  ],
  authors: [{ name: 'AgriConnect' }],
  applicationName: 'AgriConnect',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          antialiased
          bg-gradient-to-br from-slate-50 to-gray-100
          text-gray-900
          min-h-screen
        `}
      >
        {children}
      </body>
    </html>
  );
}
