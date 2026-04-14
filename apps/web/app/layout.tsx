import type { Metadata } from 'next';
import { Red_Hat_Display, Geist_Mono } from 'next/font/google';
import './globals.css';

const redHatDisplay = Red_Hat_Display({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nibras',
  description: 'The developer education platform built for serious instructors.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${redHatDisplay.variable} ${geistMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute("data-theme","dark");`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
