import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').origin;
  } catch {
    return 'http://localhost:5000';
  }
})();

const isDevelopment = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://api.dicebear.com https://lh3.googleusercontent.com https://res.cloudinary.com https://i.ytimg.com",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com${isDevelopment ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
  "frame-src 'self' https://accounts.google.com https://www.google.com https://maps.google.com",
  "font-src 'self' data:",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig = {
  distDir: process.env.NUTRIMIND_REPAIR_E2E === 'true' ? '.next-repair' : '.next',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: {
    position: 'bottom-right',
  },
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
  async rewrites() {
    const backendOrigin = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
