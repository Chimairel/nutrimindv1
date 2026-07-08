import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Only USER role accounts have notifications; skip for NUTRITIONIST/ADMIN
  const isUserRole = user?.role === 'USER';

  const fetchNotifications = useCallback(async () => {
    if (!isUserRole) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get('/user/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data.notifications);
        setUnreadCount(res.data.data.unreadCount);
      }
    } catch (err) {
      console.error('[useNotifications] Fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isUserRole]);

  useEffect(() => {
    fetchNotifications();

    if (!isUserRole) return;

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);

    // Refresh on window focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNotifications, isUserRole]);

  const markAsRead = async (id: string) => {
    await api.patch(`/user/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    await Promise.all(unreadIds.map((id) => api.patch(`/user/notifications/${id}/read`)));
    
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refresh: fetchNotifications };
}
