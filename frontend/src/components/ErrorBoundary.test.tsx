import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const CrashingComponent: React.FC<{ shouldCrash?: boolean }> = ({ shouldCrash }) => {
  if (shouldCrash) {
    throw new Error('Test crash in component');
  }
  return <div>Normal Content</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <CrashingComponent shouldCrash={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal Content')).toBeInTheDocument();
  });

  it('catches render error, logs to console.error, and renders fallback error card', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <CrashingComponent shouldCrash={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Component Rendering Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Test crash in component/i)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('allows resetting error state with Try Again button', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let crash = true;
    const StatefulParent = () => {
      return (
        <ErrorBoundary>
          {crash ? <CrashingComponent shouldCrash={true} /> : <div>Recovered Content</div>}
        </ErrorBoundary>
      );
    };

    const { rerender } = render(<StatefulParent />);
    expect(screen.getByText(/Component Rendering Failed/i)).toBeInTheDocument();

    crash = false;
    rerender(<StatefulParent />);
    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryButton);

    expect(screen.getByText('Recovered Content')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
