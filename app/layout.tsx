import type { Metadata } from 'next';
import { Outfit, Cinzel } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Garuda - Spiritual AI',
  description: 'Wisdom from Bhagavad Gita, Uddhava Gita, and Shrimad Bhagavatam.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${cinzel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
