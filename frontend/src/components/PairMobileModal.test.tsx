import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PairMobileModal } from './PairMobileModal';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    AUTH: '/api/auth',
  },
}));

describe('PairMobileModal Component', () => {
  const mockPairInitResponse = {
    pairingSecret: 'test-secret-1234567890abcdef',
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: mockPairInitResponse });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PairMobileModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('fetches pairing secret and renders modal with QR code and instructions when opened', async () => {
    const handleClose = vi.fn();
    render(<PairMobileModal isOpen={true} onClose={handleClose} />);

    // Verify API was called
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/pair/init');
    });

    // Verify modal title and instructions are in document
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Pair Mobile App')).toBeInTheDocument();
    expect(
      screen.getByText(/Open the Portfolio mobile app on your smartphone/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Scan this QR code to authenticate instantly/i)
    ).toBeInTheDocument();

    // Verify QR code container and payload
    const qrContainer = await screen.findByTestId('qr-container');
    const payload = JSON.parse(qrContainer.getAttribute('data-payload') || '{}');
    expect(payload).toEqual({
      serverUrl: window.location.origin,
      pairingSecret: 'test-secret-1234567890abcdef',
      expiresAt: mockPairInitResponse.expiresAt,
    });
  });

  it('encodes custom serverUrl when passed as prop', async () => {
    const customUrl = 'https://portfolio.example.com';
    render(
      <PairMobileModal
        isOpen={true}
        onClose={vi.fn()}
        serverUrl={customUrl}
      />
    );

    const qrContainer = await screen.findByTestId('qr-container');
    const payload = JSON.parse(qrContainer.getAttribute('data-payload') || '{}');
    expect(payload.serverUrl).toBe(customUrl);
    expect(payload.pairingSecret).toBe('test-secret-1234567890abcdef');
  });

  it('ticks countdown timer correctly', async () => {
    vi.useFakeTimers();
    render(<PairMobileModal isOpen={true} onClose={vi.fn()} />);

    // Let the initial promise resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Check timer display (starting at 5:00)
    expect(screen.getByTestId('countdown-timer')).toHaveTextContent(/Expires in 5:00/);

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('countdown-timer')).toHaveTextContent(/Expires in 4:58/);

    // Advance 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByTestId('countdown-timer')).toHaveTextContent(/Expires in 3:58/);
  });

  it('transitions to expired state when countdown completes', async () => {
    vi.useFakeTimers();
    render(<PairMobileModal isOpen={true} onClose={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    // Advance past remaining validity
    act(() => {
      vi.advanceTimersByTime(301 * 1000);
    });

    // Verify expired UI
    expect(screen.getByTestId('qr-expired-state')).toBeInTheDocument();
    expect(screen.getByText('QR Code Expired')).toBeInTheDocument();
    expect(screen.getByTestId('countdown-timer')).toHaveTextContent('Validity expired');
    expect(screen.getByTestId('regenerate-button')).toBeInTheDocument();
  });

  it('regenerates pairing secret on clicking regenerate button when expired', async () => {
    vi.useFakeTimers();
    const secondResponse = {
      pairingSecret: 'new-regenerated-secret-999',
      expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
    };

    render(<PairMobileModal isOpen={true} onClose={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.post).toHaveBeenCalledTimes(1);

    // Advance to expired
    act(() => {
      vi.advanceTimersByTime(300 * 1000);
    });

    expect(screen.getByTestId('qr-expired-state')).toBeInTheDocument();

    // Mock next response
    vi.mocked(api.post).mockResolvedValueOnce({ data: secondResponse });

    // Click regenerate button
    await act(async () => {
      fireEvent.click(screen.getByTestId('regenerate-button'));
      await Promise.resolve();
    });

    expect(api.post).toHaveBeenCalledTimes(2);

    // QR container is back with updated payload
    const qrContainer = screen.getByTestId('qr-container');
    const payload = JSON.parse(qrContainer.getAttribute('data-payload') || '{}');
    expect(payload.pairingSecret).toBe('new-regenerated-secret-999');
    expect(screen.getByTestId('countdown-timer')).toHaveTextContent(/Expires in 5:00/);
  });

  it('renders error state and allows retry if pairing generation fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error: server unreachable'));

    render(<PairMobileModal isOpen={true} onClose={vi.fn()} />);

    const errorState = await screen.findByTestId('qr-error-state');
    expect(errorState).toBeInTheDocument();
    expect(screen.getByText('Network error: server unreachable')).toBeInTheDocument();

    // Now mock success and click Try Again
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockPairInitResponse });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    const qrContainer = await screen.findByTestId('qr-container');
    expect(qrContainer).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(<PairMobileModal isOpen={true} onClose={handleClose} />);

    await screen.findByTestId('qr-container');

    const closeBtn = screen.getByTestId('close-pair-modal-button');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside modal on overlay backdrop', async () => {
    const handleClose = vi.fn();
    render(<PairMobileModal isOpen={true} onClose={handleClose} />);

    await screen.findByTestId('qr-container');

    const overlay = screen.getByTestId('pair-modal-overlay');
    fireEvent.click(overlay);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', async () => {
    const handleClose = vi.fn();
    render(<PairMobileModal isOpen={true} onClose={handleClose} />);

    await screen.findByTestId('qr-container');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the modal dialog on Tab and Shift+Tab', async () => {
    render(<PairMobileModal isOpen={true} onClose={vi.fn()} />);

    await screen.findByTestId('qr-container');

    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled])'
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus last, press Tab -> should wrap to first
    last?.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);

    // Focus first, press Shift+Tab -> should wrap to last
    first?.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
