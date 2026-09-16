import type { Metadata, Viewport } from 'next';
import { DM_Sans, Plus_Jakarta_Sans, JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { BreadcrumbProvider } from '@/lib/context/BreadcrumbContext';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600', '700'],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  weight: ['400', '500', '600', '700', '800'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#060b09',
};

export const metadata: Metadata = {
  title: 'KAINARA | AI Nutrition & Meal Planning',
  description:
    'AI-powered, culturally aware meal planning validated against the FNRI Philippine Food Composition Table. Personalized nutrition for health-conscious Filipinos.',
  keywords: ['nutrition', 'meal planning', 'Filipino food', 'FNRI', 'diet', 'health', 'AI nutrition', 'KAINARA'],
  authors: [{ name: 'KAINARA Team' }],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/icon.svg',
    apple: '/icons/icon-192.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'KAINARA | AI Nutrition & Meal Planning',
    description: 'Personalized AI-powered nutrition for health-conscious Filipinos.',
    type: 'website',
    locale: 'en_PH',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('nutrimind-theme');
                  var theme = saved === 'light' || saved === 'dark' ? saved : 'light';
                  document.documentElement.className = theme;
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable} bg-brand-bg font-sans text-brand-text antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <BreadcrumbProvider>{children}</BreadcrumbProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
