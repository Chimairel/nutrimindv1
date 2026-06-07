import axios from 'axios';
import { cookieHelper } from '@/lib/auth';

// Create a single pre-configured Axios instance for backend calls
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // Crucial for storing and sending HttpOnly session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token from cookie as Authorization header
// The backend expects "Authorization: Bearer <token>" on every protected route
api.interceptors.request.use((config) => {
  const token = cookieHelper.get('nutrimind_session');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to manage routing dynamically upon session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the browser environment is active, redirect to auth pages
    if (typeof window !== 'undefined') {
      if (error.response) {
        const { status } = error.response;

        // Guard: don't redirect if we're already on an auth page (prevents infinite loop)
        const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
        const isAuthPage = authPages.some((page) => window.location.pathname.startsWith(page));

        if (status === 401 && !isAuthPage) {
          // Session expired or invalid — clear token and redirect to login
          cookieHelper.clear('nutrimind_session');
          window.location.href = '/login';
        } else if (status === 403) {
          window.location.href = '/unauthorized';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
