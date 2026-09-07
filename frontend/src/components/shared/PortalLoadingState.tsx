import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface PortalLoadingStateProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PortalLoadingState({
  message,
  className = '',
  fullScreen = false,
  size = 'lg',
}: PortalLoadingStateProps) {
  const heightClass = fullScreen ? 'h-screen w-screen bg-brand-bg' : 'min-h-[60vh] w-full';

  return (
    <div
      className={`flex ${heightClass} items-center justify-center text-brand-text ${className}`}
      aria-busy="true"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <LoadingSpinner size={size} />
        {message ? (
          <p className="animate-pulse font-display text-sm font-semibold text-brand-muted">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
