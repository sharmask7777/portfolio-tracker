import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, Smartphone, Clock, AlertCircle } from 'lucide-react';
import api from '../api';
import type { PairInitResponse } from '../types/generated/PairInitResponse';

/**
 * Props for the {@link PairMobileModal} component.
 */
export interface PairMobileModalProps {
  /** Controls modal dialog visibility */
  isOpen: boolean;
  /** Callback fired when the user closes or dismisses the modal */
  onClose: () => void;
  /** Optional server endpoint override (defaults to current window.location.origin) */
  serverUrl?: string;
}

/**
 * Payload encoded in the mobile pairing QR code.
 */
export interface MobilePairingPayload {
  /** The accessible URL of the backend API server */
  serverUrl: string;
  /** Single-use pairing secret token */
  pairingSecret: string;
  /** ISO timestamp when the pairing secret expires */
  expiresAt: string;
}

/**
 * Format remaining seconds into M:SS display.
 */
function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Custom hook to manage pairing token fetch, expiration timestamp, and countdown.
 */
function useMobilePairing(isOpen: boolean) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pairingSecret, setPairingSecret] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  const fetchPairingSecret = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post<PairInitResponse>('/api/auth/pair/init');
      setPairingSecret(res.data.pairingSecret);
      setExpiresAt(res.data.expiresAt);

      const expiryMs = new Date(res.data.expiresAt).getTime();
      const diffSec = Math.max(0, Math.round((expiryMs - Date.now()) / 1000));
      setSecondsRemaining(diffSec > 0 ? diffSec : 300);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate mobile pairing code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPairingSecret();
    }
  }, [isOpen, fetchPairingSecret]);

  useEffect(() => {
    if (!isOpen || loading || !pairingSecret || secondsRemaining <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, loading, pairingSecret, secondsRemaining]);

  return {
    loading,
    error,
    pairingSecret,
    expiresAt,
    secondsRemaining,
    fetchPairingSecret,
  };
}

/**
 * Custom hook implementing WCAG 2.1 AA focus trap and Escape key listener.
 */
function useDialogFocusTrap(
  isOpen: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusable = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const initialFocusable = containerRef.current?.querySelector<HTMLElement>('button');
    initialFocusable?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose, containerRef]);
}

/**
 * Header with mobile icon, modal title, and close button.
 */
const ModalHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          color: 'var(--accent-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Smartphone size={20} />
      </div>
      <h2 id="pair-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
        Pair Mobile App
      </h2>
    </div>
    <button
      onClick={onClose}
      aria-label="Close modal"
      data-testid="close-pair-modal-button"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        padding: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <X size={22} />
    </button>
  </div>
);

/**
 * Step instructions component explaining mobile device pairing.
 */
const PairingInstructions: React.FC = () => (
  <div
    id="pair-modal-description"
    style={{
      backgroundColor: 'var(--bg-secondary)',
      padding: '1rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      lineHeight: '1.5',
      color: 'var(--text-secondary)',
      textAlign: 'left',
      width: '100%',
    }}
  >
    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
      Instructions:
    </div>
    <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
      <li>Open the Portfolio mobile app on your smartphone.</li>
      <li>Tap <strong>&quot;Pair Device&quot;</strong> on the welcome screen.</li>
      <li>Scan this QR code to authenticate instantly.</li>
    </ol>
  </div>
);

interface QrDisplayProps {
  loading: boolean;
  error: string | null;
  isExpired: boolean;
  payloadString: string;
  onRegenerate: () => void;
}

/**
 * QR Code / Loading / Expired display area.
 */
const QrDisplayArea: React.FC<QrDisplayProps> = ({
  loading,
  error,
  isExpired,
  payloadString,
  onRegenerate,
}) => {
  if (loading) {
    return (
      <div
        data-testid="qr-loading-state"
        style={{
          width: '216px',
          height: '216px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          color: 'var(--text-secondary)',
          gap: '0.5rem',
        }}
      >
        <RefreshCw size={28} className="animate-spin" />
        <span style={{ fontSize: '0.85rem' }}>Generating pairing secret...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="qr-error-state"
        style={{
          width: '216px',
          height: '216px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          color: 'var(--danger-color)',
          padding: '1rem',
          textAlign: 'center',
          gap: '0.75rem',
        }}
      >
        <AlertCircle size={28} />
        <span style={{ fontSize: '0.85rem' }}>{error}</span>
        <button
          onClick={onRegenerate}
          className="btn btn-primary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div
        data-testid="qr-expired-state"
        style={{
          width: '216px',
          height: '216px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          color: 'var(--text-secondary)',
          padding: '1rem',
          textAlign: 'center',
          gap: '0.75rem',
          border: '1px dashed var(--border-color)',
        }}
      >
        <Clock size={32} style={{ color: 'var(--danger-color)' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--danger-color)' }}>
          QR Code Expired
        </span>
        <button
          onClick={onRegenerate}
          className="btn btn-primary"
          data-testid="regenerate-button"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          Regenerate QR Code
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="qr-container"
      data-payload={payloadString}
      style={{
        backgroundColor: '#ffffff',
        padding: '0.75rem',
        borderRadius: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      }}
    >
      <QRCodeSVG
        value={payloadString}
        size={200}
        level="M"
        marginSize={1}
        title="Mobile Pairing QR Code"
      />
    </div>
  );
};

interface ValidityTimerBarProps {
  isExpired: boolean;
  secondsRemaining: number;
  onRegenerate: () => void;
}

/**
 * Countdown timer display bar with regenerate button.
 */
const ValidityTimerBar: React.FC<ValidityTimerBarProps> = ({
  isExpired,
  secondsRemaining,
  onRegenerate,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      padding: '0.5rem 0.75rem',
      backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.08)',
      borderRadius: '8px',
      fontSize: '0.85rem',
    }}
    aria-live="polite"
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        color: isExpired ? 'var(--danger-color)' : 'var(--text-primary)',
        fontWeight: 500,
      }}
    >
      <Clock size={15} />
      <span data-testid="countdown-timer">
        {isExpired ? 'Validity expired' : `Expires in ${formatTime(secondsRemaining)}`}
      </span>
    </div>
    {!isExpired && (
      <button
        onClick={onRegenerate}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent-color)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontWeight: 500,
        }}
        title="Regenerate code"
      >
        <RefreshCw size={13} />
        Regenerate
      </button>
    )}
  </div>
);

/**
 * Modal dialog displaying a cryptographically signed QR code to pair a mobile companion app.
 *
 * Implements WCAG 2.1 AA focus trap, Escape key closing, and live expiration timer.
 *
 * @param props - Component properties {@link PairMobileModalProps}
 * @returns Accessible pairing modal dialog or null if closed
 */
export const PairMobileModal: React.FC<PairMobileModalProps> = ({
  isOpen,
  onClose,
  serverUrl,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    loading,
    error,
    pairingSecret,
    expiresAt,
    secondsRemaining,
    fetchPairingSecret,
  } = useMobilePairing(isOpen);

  useDialogFocusTrap(isOpen, onClose, modalRef);

  if (!isOpen) return null;

  const resolvedServerUrl =
    serverUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const isExpired = secondsRemaining <= 0;
  const payload: MobilePairingPayload = {
    serverUrl: resolvedServerUrl,
    pairingSecret: pairingSecret ?? '',
    expiresAt: expiresAt ?? '',
  };
  const payloadString = JSON.stringify(payload);

  return (
    <div
      className="modal-overlay"
      data-testid="pair-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pair-modal-title"
      aria-describedby="pair-modal-description"
    >
      <div
        className="modal"
        ref={modalRef}
        tabIndex={-1}
        style={{
          maxWidth: '460px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.25rem',
        }}
      >
        <ModalHeader onClose={onClose} />
        <QrDisplayArea
          loading={loading}
          error={error}
          isExpired={isExpired}
          payloadString={payloadString}
          onRegenerate={fetchPairingSecret}
        />
        {!loading && !error && (
          <ValidityTimerBar
            isExpired={isExpired}
            secondsRemaining={secondsRemaining}
            onRegenerate={fetchPairingSecret}
          />
        )}
        <PairingInstructions />
      </div>
    </div>
  );
};
