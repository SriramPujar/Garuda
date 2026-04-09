import type { Metadata, Viewport } from 'next';
import { Outfit, Playfair_Display } from 'next/font/google';
import './globals.css';
import SessionProviderWrapper from './components/SessionProviderWrapper';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
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
    <html lang="en" className={`${outfit.variable} ${playfair.variable}`}>
      <body>
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
