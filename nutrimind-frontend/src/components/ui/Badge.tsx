import React from 'react';
import { Check, Clock, AlertCircle, Bot, User } from 'lucide-react';

export type BadgeVariant = 'verified' | 'pending' | 'rejected' | 'ai' | 'user';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  showIcon?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  showIcon = true,
  children,
  className = '',
  ...props
}) => {
  const styles = {
    verified: 'border border-status-verified-text/20 bg-status-verified-bg text-status-verified-text',
    pending: 'border border-status-pending-text/20 bg-status-pending-bg text-status-pending-text',
    rejected: 'border border-status-rejected-text/20 bg-status-rejected-bg text-status-rejected-text',
    ai: 'border border-status-ai-text/20 bg-status-ai-bg text-status-ai-text',
    user: 'border border-status-user-text/20 bg-status-user-bg text-status-user-text',
  };

  const icons = {
    verified: <Check className="w-3 h-3 stroke-[3px]" />,
    pending: <Clock className="w-3 h-3" />,
    rejected: <AlertCircle className="w-3 h-3" />,
    ai: <Bot className="w-3 h-3" />,
    user: <User className="w-3 h-3" />,
  };

  const defaultText = {
    verified: 'Verified',
    pending: 'Pending Review',
    rejected: 'Rejected',
    ai: 'AI Generated',
    user: 'You logged',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${styles[variant]} ${className}`}
      {...props}
    >
      {showIcon && icons[variant]}
      <span>{children || defaultText[variant]}</span>
    </span>
  );
};

export default Badge;
