/**
 * Loading States Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  CardSkeleton,
  LoadingSpinner,
  EmptyState,
  ConnectionBanner,
} from './LoadingStates';

describe('LoadingStates', () => {
  describe('Skeleton', () => {
    it('should render with default styles', () => {
      render(<Skeleton />);
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Skeleton className="custom-class" />);
      const skeleton = document.querySelector('.custom-class');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('CardSkeleton', () => {
    it('should render skeleton card', () => {
      render(<CardSkeleton />);
      const card = document.querySelector('.card');
      expect(card).toBeInTheDocument();
    });
  });

  describe('LoadingSpinner', () => {
    it('should render loading message', () => {
      render(<LoadingSpinner />);
      // Use getAllByText since there are visible + sr-only elements
      const elements = screen.getAllByText('Loading...');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should render custom message', () => {
      render(<LoadingSpinner message="Fetching data..." />);
      const elements = screen.getAllByText('Fetching data...');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should have accessible status role', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should apply size classes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />);
      let spinner = document.querySelector('.w-4');
      expect(spinner).toBeInTheDocument();

      rerender(<LoadingSpinner size="lg" />);
      // lg size uses w-12 (not w-8)
      spinner = document.querySelector('.w-12');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    it('should render title and description', () => {
      const TestIcon = () => <span data-testid="test-icon">Icon</span>;
      // EmptyState requires icon, title, and description props
      render(<EmptyState title="No Data" description="Nothing to display" icon={TestIcon} />);
      expect(screen.getByText('No Data')).toBeInTheDocument();
      expect(screen.getByText('Nothing to display')).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
      const TestIcon = () => <span data-testid="test-icon">Icon</span>;
      render(<EmptyState title="Empty" description="No items" icon={TestIcon} />);
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('ConnectionBanner', () => {
    it('should not render when connected', () => {
      const { container } = render(<ConnectionBanner isConnected={true} isReconnecting={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('should show reconnecting message when reconnecting', () => {
      render(<ConnectionBanner isConnected={false} isReconnecting={true} />);
      expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
    });

    it('should show connection lost message when not connected', () => {
      render(<ConnectionBanner isConnected={false} isReconnecting={false} />);
      // Check for the actual message from the component
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
    });

    it('should have accessible alert role', () => {
      render(<ConnectionBanner isConnected={false} isReconnecting={false} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
