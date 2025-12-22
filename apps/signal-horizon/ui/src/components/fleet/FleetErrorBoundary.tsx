import React, { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface FleetErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
  level?: 'page' | 'component';
}

interface FleetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class FleetErrorBoundary extends React.Component<
  FleetErrorBoundaryProps,
  FleetErrorBoundaryState
> {
  constructor(props: FleetErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): FleetErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { level = 'component' } = this.props;
    console.error(
      `[FleetErrorBoundary - ${level}] Error caught:`,
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    const {
      children,
      title = 'Fleet Component Error',
      description = 'An error occurred while loading this component.',
      level = 'component',
    } = this.props;

    const { hasError } = this.state;

    if (hasError) {
      return (
        <div
          className={`flex flex-col items-center justify-center ${
            level === 'page' ? 'min-h-screen' : 'min-h-[200px]'
          } bg-white border border-red-200 p-6`}
        >
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-4 text-center max-w-md">
            {description}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#0057B7] text-white hover:bg-[#001E62] rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
