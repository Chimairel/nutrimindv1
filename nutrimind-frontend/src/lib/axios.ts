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

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to manage routing dynamically upon session expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is a 401 and we haven't already retried this request
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Guard: don't redirect/refresh if we're already on an auth page
      const authPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
      const isAuthPage = typeof window !== 'undefined' && authPages.some((page) => window.location.pathname.startsWith(page));

      // Guard: if it's the refresh request itself that failed, don't retry!
      const isRefreshRequest = originalRequest.url && originalRequest.url.includes('/auth/refresh');

      if (!isAuthPage && !isRefreshRequest) {
        const refreshToken = cookieHelper.get('nutrimind_refresh');

        if (refreshToken) {
          if (isRefreshing) {
            // Queue this failed request while token is being refreshed
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const refreshResponse = await axios.post(
              (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api') + '/auth/refresh',
              { refreshToken }
            );

            if (refreshResponse.data && refreshResponse.data.success) {
              const { accessToken } = refreshResponse.data.data;
              cookieHelper.set('nutrimind_session', accessToken, 7);
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              
              processQueue(null, accessToken);
              isRefreshing = false;
              
              return api(originalRequest);
            }
          } catch (refreshError) {
            processQueue(refreshError, null);
            isRefreshing = false;
            
            cookieHelper.clear('nutrimind_session');
            cookieHelper.clear('nutrimind_refresh');
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token available — clear session and redirect
          cookieHelper.clear('nutrimind_session');
          cookieHelper.clear('nutrimind_refresh');
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }

    // Handle 403 Forbidden — log but don't redirect.
    // The RouteGuard component handles role-based page access.
    // Redirecting here causes issues when background fetches (e.g. notifications)
    // hit role-restricted endpoints for non-USER accounts.
    if (error.response && error.response.status === 403) {
      console.warn('[Axios] 403 Forbidden on:', error.config?.url);
    }

    return Promise.reject(error);
  }
);

export default api;
