import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', style: ['normal', 'italic'] });

const description = 'Turns dense lab PDFs and photos into plain-language tables and a printable doctor sheet. AI explains, code decides. Information only, never a diagnosis.';

export const metadata: Metadata = {
  title: 'Lab Report Translator',
  description,
  manifest: '/manifest.json',
  openGraph: { title: 'Lab Report Translator', description, siteName: 'Lab Report Translator', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#0c2436', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
