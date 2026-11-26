import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from './SignupPage';

const mockSignup = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signup: mockSignup }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits matching credentials and navigates home on success', async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'neha@example.com' },
    });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0]!, { target: { value: 'secret123' } });
    fireEvent.change(passwordInputs[1]!, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('neha@example.com', 'secret123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows error when passwords do not match', async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'neha@example.com' },
    });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0]!, { target: { value: 'secret123' } });
    fireEvent.change(passwordInputs[1]!, { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('displays API error message on signup failure', async () => {
    mockSignup.mockRejectedValueOnce({
      response: { data: { error: 'Email already registered' } },
    });
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'neha@example.com' },
    });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0]!, { target: { value: 'secret123' } });
    fireEvent.change(passwordInputs[1]!, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  it('displays fallback error message when error has no response payload', async () => {
    mockSignup.mockRejectedValueOnce(new Error('Network down'));
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'neha@example.com' },
    });
    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0]!, { target: { value: 'secret123' } });
    fireEvent.change(passwordInputs[1]!, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Failed to create account. Please try again.')).toBeInTheDocument();
  });
});
