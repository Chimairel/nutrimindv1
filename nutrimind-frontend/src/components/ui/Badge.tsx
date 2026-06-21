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
    verified: 'bg-status-verified-bg text-status-verified-text border border-status-verified-text/10',
    pending: 'bg-status-pending-bg text-status-pending-text border border-status-pending-text/10',
    rejected: 'bg-status-rejected-bg text-status-rejected-text border border-status-rejected-text/10',
    ai: 'bg-status-ai-bg text-status-ai-text border border-status-ai-text/10',
    user: 'bg-status-user-bg text-status-user-text border border-status-user-text/10',
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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${styles[variant]} ${className}`}
      {...props}
    >
      {showIcon && icons[variant]}
      <span>{children || defaultText[variant]}</span>
    </span>
  );
};

export default Badge;

