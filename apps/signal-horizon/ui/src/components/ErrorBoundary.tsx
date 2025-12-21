/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 * Uses key-based remounting for true recovery of children
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional callback when retry is clicked */
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  /** Key for forcing remount of children on retry */
  retryKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Log to error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    // Increment retryKey to force remount of children
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryKey: prevState.retryKey + 1,
    }));
    // Call optional retry callback
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center min-h-[400px] p-6"
        >
          <div className="p-4 rounded-full bg-red-500/10 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-400 text-center max-w-md mb-4">
            An error occurred while rendering this component. Try refreshing or contact support if the problem persists.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-red-400 bg-gray-900 p-4 rounded-lg max-w-lg overflow-auto mb-4">
              {this.state.error.message}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-horizon-600 hover:bg-horizon-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-horizon-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            aria-label="Retry loading this component"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      );
    }

    // Use key to force remount of children on retry
    // This ensures fresh state and re-runs effects
    return (
      <div key={this.state.retryKey}>
        {this.props.children}
      </div>
    );
  }
}

export default ErrorBoundary;
