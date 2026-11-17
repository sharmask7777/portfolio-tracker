import React from 'react';
import { X } from 'lucide-react';
import type { Asset } from './GoalItemView';

interface GoalAddFormProps {
  name: string;
  onNameChange: (val: string) => void;
  amount: string;
  onAmountChange: (val: string) => void;
  date: string;
  onDateChange: (val: string) => void;
  activeAssets: Asset[];
  selectedAssetIds: string[];
  onToggleAsset: (id: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const GoalAddForm: React.FC<GoalAddFormProps> = ({
  name,
  onNameChange,
  amount,
  onAmountChange,
  date,
  onDateChange,
  activeAssets,
  selectedAssetIds,
  onToggleAsset,
  onSubmit,
  onCancel,
}) => (
  <form
    onSubmit={onSubmit}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      marginBottom: '2rem',
      padding: '1rem',
      background: 'var(--bg-secondary)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
    }}
  >
    <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Add New Goal</h4>
    <input
      type="text"
      placeholder="Goal Name (e.g. Retirement)"
      className="card"
      style={{ padding: '0.5rem', outline: 'none' }}
      value={name}
      onChange={(e) => onNameChange(e.target.value)}
      required
    />
    <input
      type="number"
      placeholder="Target Amount (INR)"
      className="card"
      style={{ padding: '0.5rem', outline: 'none' }}
      value={amount}
      onChange={(e) => onAmountChange(e.target.value)}
      required
    />
    <input
      type="date"
      className="card"
      style={{ padding: '0.5rem', outline: 'none' }}
      value={date}
      onChange={(e) => onDateChange(e.target.value)}
      required
    />

    {activeAssets.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Attach Specific Mutual Funds (Optional):
        </span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            maxHeight: '150px',
            overflowY: 'auto',
            padding: '0.5rem',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
          }}
        >
          {activeAssets.map((asset) => (
            <label
              key={asset.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selectedAssetIds.includes(asset.id)}
                onChange={() => onToggleAsset(asset.id)}
              />
              <span>{asset.name}</span>
            </label>
          ))}
        </div>
      </div>
    )}

    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
        Add Goal
      </button>
      <button
        type="button"
        className="btn"
        onClick={onCancel}
        style={{ border: '1px solid var(--border-color)' }}
      >
        <X size={14} />
      </button>
    </div>
  </form>
);
