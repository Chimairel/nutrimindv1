import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { CheckCircle, AlertTriangle, ClipboardList, Calendar, Bell, Inbox } from 'lucide-react';

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-brand-muted hover:bg-brand-surface hover:text-brand-green transition-all outline-none focus:ring-2 focus:ring-brand-green/20 flex items-center justify-center"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-green text-[9px] font-bold text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[400px] flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-brand-border/60 bg-brand-bg/50 px-4 py-3">
            <h3 className="text-sm font-bold text-brand-text font-display">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-bold text-brand-green hover:underline tracking-wider uppercase"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                 <Inbox className="w-8 h-8 opacity-40 text-brand-muted" />
                 <p className="text-xs text-brand-muted">You&apos;re all caught up!</p>
               </div>
             ) : (
               <div className="flex flex-col">
                 {notifications.map((notif) => (
                   <div 
                     key={notif.id}
                     onClick={() => {
                       if (!notif.isRead) markAsRead(notif.id);
                     }}
                     className={`flex items-start gap-3 border-b border-brand-border/40 p-4 transition-colors cursor-pointer hover:bg-brand-bg/50 ${
                       !notif.isRead ? 'bg-brand-green/5' : ''
                     }`}
                   >
                     <span className="mt-0.5 shrink-0">{getIconForType(notif.type)}</span>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start gap-2 mb-1">
                         <p className={`text-xs font-semibold leading-tight ${!notif.isRead ? 'text-brand-text' : 'text-brand-muted'}`}>
                           {notif.title}
                         </p>
                         {!notif.isRead && (
                           <span className="h-2 w-2 rounded-full bg-brand-green shrink-0 mt-1" />
                         )}
                       </div>
                       <p className="text-[11px] text-brand-muted line-clamp-2 leading-relaxed">
                         {notif.message}
                       </p>
                       <p className="text-[9px] text-brand-muted/70 mt-2 uppercase tracking-wider">
                         {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       </p>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>

        </div>
      )}
    </div>
  );
}
