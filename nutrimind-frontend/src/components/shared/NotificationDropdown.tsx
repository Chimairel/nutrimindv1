import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { CheckCircle, AlertTriangle, ClipboardList, Calendar, Bell, Inbox } from 'lucide-react';

export default function NotificationDropdown() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'PLAN_APPROVED': return <CheckCircle className="w-4 h-4 text-brand-green" />;
      case 'PLAN_REJECTED': return <AlertTriangle className="w-4 h-4 text-status-error-text" />;
      case 'REVIEW_REQUEST': return <ClipboardList className="w-4 h-4 text-status-pending-text" />;
      case 'WEEKLY_CHECKIN': return <Calendar className="w-4 h-4 text-brand-green" />;
      default: return <Bell className="w-4 h-4 text-brand-muted" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[14px] border border-brand-border/70 bg-brand-surface/75 text-brand-muted shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-brand-green/30 hover:bg-brand-green/10 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green/40"
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-[18px] w-[18px]" />

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-brand-bg bg-brand-accent text-[8px] font-bold text-[#07100d]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+12px)] z-50 flex max-h-[min(34rem,calc(100vh-6rem))] w-[min(23rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[24px] border border-brand-border bg-brand-surface shadow-[0_24px_70px_rgba(3,14,10,0.22)] animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between gap-4 border-b border-brand-border/70 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-green/10 text-brand-green">
                <Bell className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-sm font-bold text-brand-text">Notifications</h3>
                <p className="mt-0.5 text-[11px] text-brand-muted">
                  {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="shrink-0 rounded-xl border border-brand-border/80 bg-brand-bgAlt px-3 py-2 text-[10px] font-bold text-brand-green outline-none transition hover:border-brand-green/30 hover:bg-brand-green/10 focus-visible:ring-2 focus-visible:ring-brand-green/30"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto bg-brand-bgAlt/45 p-2.5">
            {isLoading ? (
              <div className="space-y-2" aria-label="Loading notifications">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-[18px] border border-brand-border/60 bg-brand-surface" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                  <Inbox className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-bold text-brand-text">No new notifications</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-brand-muted">Meal-plan and account updates will appear here.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      if (!notif.isRead) markAsRead(notif.id);
                    }}
                    className={`group flex w-full items-start gap-3 rounded-[18px] border p-3.5 text-left outline-none transition hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-green/35 ${
                      !notif.isRead
                        ? 'border-brand-green/25 bg-brand-green/[0.07]'
                        : 'border-brand-border/70 bg-brand-surface'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      !notif.isRead ? 'bg-brand-green/[0.12]' : 'bg-brand-bgAlt'
                    }`}>
                      {getIconForType(notif.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`text-xs font-bold leading-snug ${!notif.isRead ? 'text-brand-text' : 'text-brand-muted'}`}>
                          {notif.title}
                        </span>
                        {!notif.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-green shadow-[0_0_8px_rgba(8,112,91,0.35)]" />}
                      </span>
                      <span className="mt-1.5 line-clamp-2 block text-[11px] leading-relaxed text-brand-muted">
                        {notif.message}
                      </span>
                      <span className="mt-2.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-brand-muted/70">
                        {new Date(notif.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
