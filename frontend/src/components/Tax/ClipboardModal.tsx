import React from 'react';
import { Copy, X } from 'lucide-react';

interface ClipboardModalProps {
  showCopyModal: boolean;
  onClose: () => void;
  clipboardText: string;
}

export const ClipboardModal: React.FC<ClipboardModalProps> = ({
  showCopyModal,
  onClose,
  clipboardText,
}) => {
  if (!showCopyModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '650px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Copy size={18} /> MF Central / CAMS Redemption Instructions
          </h3>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.25rem 0.5rem', cursor: 'pointer' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Clipboard access was unavailable or denied. Select all and copy the redemption
          instructions below:
        </p>
        <textarea
          readOnly
          value={clipboardText}
          rows={12}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            resize: 'vertical',
          }}
          onFocus={(e) => e.target.select()}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
