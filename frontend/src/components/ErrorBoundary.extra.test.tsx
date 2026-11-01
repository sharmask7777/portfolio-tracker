import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const BadComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Explosive test failure');
  }
  return <div>Healthy Child</div>;
};

describe('ErrorBoundary Comprehensive Coverage', () => {
  it('resets error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BadComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component Rendering Failed')).toBeInTheDocument();
    expect(screen.getByText('Explosive test failure')).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <BadComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /Try Again/ }));
    expect(screen.getByText('Healthy Child')).toBeInTheDocument();
  });

  it('renders custom functional fallback and triggers reset', () => {
    const customFallback = (error: Error, reset: () => void) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={reset}>Reset Custom</button>
      </div>
    );

    const { rerender } = render(
      <ErrorBoundary fallback={customFallback}>
        <BadComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error: Explosive test failure')).toBeInTheDocument();

    rerender(
      <ErrorBoundary fallback={customFallback}>
        <BadComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset Custom' }));
    expect(screen.getByText('Healthy Child')).toBeInTheDocument();
  });

  it('calls onError callback when provided', () => {
    const onErrorMock = vi.fn();
    render(
      <ErrorBoundary onError={onErrorMock}>
        <BadComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });
});
