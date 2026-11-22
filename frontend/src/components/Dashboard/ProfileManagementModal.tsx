import React from 'react';
import { X } from 'lucide-react';

interface ProfileManagementModalProps {
  isOpen: boolean;
  editName: string;
  editTaxSlab: number;
  onEditNameChange: (val: string) => void;
  onEditTaxSlabChange: (val: number) => void;
  onSave: () => void;
  onClose: () => void;
}

/**
 * Modal dialog for editing family member profile name and tax slab.
 */
export const ProfileManagementModal: React.FC<ProfileManagementModalProps> = ({
  isOpen,
  editName,
  editTaxSlab,
  onEditNameChange,
  onEditTaxSlabChange,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Edit Member</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={24} />
          </button>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            DISPLAY NAME
          </label>
          <input
            type="text"
            className="card"
            style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', outline: 'none' }}
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            TAX SLAB (e.g. 0.3 for 30%)
          </label>
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            className="card"
            style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', outline: 'none' }}
            value={editTaxSlab}
            onChange={(e) => onEditTaxSlabChange(parseFloat(e.target.value))}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, border: '1px solid var(--border-color)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onSave}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
