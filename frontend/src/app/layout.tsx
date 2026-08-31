import type { Metadata, Viewport } from 'next';
import { DM_Sans, Plus_Jakarta_Sans, JetBrains_Mono, Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/context/AuthContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';

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
  title: 'NutriMind | AI Nutrition & Meal Planning',
  description: 'AI-powered, culturally aware meal planning validated against the FNRI Philippine Food Composition Table. Personalized nutrition for health-conscious Filipinos.',
  keywords: ['nutrition', 'meal planning', 'Filipino food', 'FNRI', 'diet', 'health', 'AI nutrition'],
  authors: [{ name: 'NutriMind Team' }],
  manifest: '/manifest.json',
  openGraph: {
    title: 'NutriMind | AI Nutrition & Meal Planning',
    description: 'Personalized AI-powered nutrition for health-conscious Filipinos.',
    type: 'website',
    locale: 'en_PH',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="light">
      <head>
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
      <body className={`${dmSans.variable} ${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable} bg-brand-bg font-sans text-brand-text antialiased`}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
