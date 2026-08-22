import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-3',
    lg: 'h-16 w-16 border-4',
  };

  const spinner = (
    <div
      className={`animate-spin rounded-full border-t-brand-green border-r-transparent border-b-brand-green border-l-transparent ${sizeClasses[size]}`}
      style={{ borderColor: 'var(--brand-border)', borderTopColor: 'var(--brand-green)', borderBottomColor: 'var(--brand-cyan)' }}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-brand-bg">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-4">{spinner}</div>;
};

export default LoadingSpinner;
