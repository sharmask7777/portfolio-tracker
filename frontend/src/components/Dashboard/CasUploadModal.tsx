import React from 'react';
import { X } from 'lucide-react';

interface CasUploadModalProps {
  isOpen: boolean;
  uploading: boolean;
  uploadStatusMsg: string;
  password: string;
  onPasswordChange: (val: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

/**
 * Modal dialog handling CAS statement PDF upload and decryption password entry.
 */
export const CasUploadModal: React.FC<CasUploadModalProps> = ({
  isOpen,
  uploading,
  uploadStatusMsg,
  password,
  onPasswordChange,
  onFileUpload,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Import CAS Statement</h2>
          <button
            onClick={() => !uploading && onClose()}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>How to get your CAS:</strong>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
            <li>Go to <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>CAMS Online</a></li>
            <li>Select <strong>Detailed</strong> Statement type.</li>
            <li>Select <strong>Specific Period</strong> and set 'From Date' to <strong>01-Jan-2003</strong>.</li>
            <li>Enter your registered email and include <strong>Zero Balance Portfolios</strong>.</li>
            <li>You will receive a PDF via email. Upload that file here.</li>
          </ol>
        </div>

        <p style={{ marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          PDF PASSWORD (USUALLY YOUR PAN IN CAPS)
        </p>
        <input
          type="password"
          placeholder="Enter PDF Password"
          className="card"
          style={{ width: '100%', marginBottom: '1.5rem', outline: 'none', padding: '0.75rem' }}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          disabled={uploading}
        />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label className="btn btn-primary" style={{ flex: 1, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            {uploading ? uploadStatusMsg || 'Processing...' : 'Select File & Upload'}
            <input type="file" hidden onChange={onFileUpload} disabled={uploading} />
          </label>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={uploading}
            style={{ border: '1px solid var(--border-color)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
