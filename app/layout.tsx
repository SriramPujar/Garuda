import type { Metadata, Viewport } from 'next';
import { Lora } from 'next/font/google';
import './globals.css';
import SessionProviderWrapper from './components/SessionProviderWrapper';

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Garuda - Spiritual AI',
  description: 'Wisdom from Bhagavad Gita, Uddhava Gita, and Shrimad Bhagavatam.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png?v=3',
    apple: '/icon-512.png?v=3'
  }
};

export const viewport: Viewport = {
  themeColor: '#060B14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${lora.variable}`}>
      <body>
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
