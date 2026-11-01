import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    AUTH: '/api/auth',
  },
}));

const TestConsumer = () => {
  const { user, token, isAuthenticated, login, signup, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{user?.email || 'none'}</div>
      <div data-testid="token">{token || 'none'}</div>
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={() => signup('new@example.com', 'password123')}>Signup</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('provides unauthenticated state by default', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('none');
    expect(screen.getByTestId('token')).toHaveTextContent('none');
  });

  it('logs in successfully and persists token', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        token: 'jwt-xyz',
        user: { id: 'u1', email: 'test@example.com' },
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    expect(localStorage.getItem('token')).toBe('jwt-xyz');
  });

  it('signs up successfully and logs out', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        token: 'jwt-signup',
        user: { id: 'u2', email: 'new@example.com' },
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Signup').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-email')).toHaveTextContent('new@example.com');

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('throws error when used outside provider', () => {
    const renderOutside = () => render(<TestConsumer />);
    expect(renderOutside).toThrow('useAuth must be used within an AuthProvider');
  });
});
