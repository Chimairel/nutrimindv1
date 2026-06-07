'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from '@/components/ui/Button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Error Boundary] Uncaught error caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center text-center p-8 bg-brand-surface/20 border border-brand-border rounded-2xl max-w-lg mx-auto my-12">
          <div className="text-4xl mb-4 bg-status-error-bg text-status-error-text p-4 rounded-full w-16 h-16 flex items-center justify-center font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold tracking-tight text-brand-text mb-2 font-display">
            Something went wrong
          </h2>
          <p className="text-sm text-brand-muted leading-relaxed mb-6 max-w-sm">
            NutriMind encountered an unexpected layout crash. Please try refreshing or clearing state.
          </p>
          {this.state.error && (
            <div className="w-full bg-brand-bgAlt border border-brand-border rounded-xl p-3 mb-6 font-mono text-[11px] text-left overflow-x-auto text-status-error-text max-h-36">
              {this.state.error.toString()}
            </div>
          )}
          <Button variant="secondary" onClick={this.handleReset}>
            🔄 Reload Interface
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
