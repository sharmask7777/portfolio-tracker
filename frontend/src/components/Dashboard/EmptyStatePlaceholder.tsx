import { Plus, Upload as UploadIcon } from 'lucide-react';

export interface EmptyStatePlaceholderProps {
  onAddAsset: () => void;
  onUpload: () => void;
}

export function EmptyStatePlaceholder({ onAddAsset, onUpload }: EmptyStatePlaceholderProps) {
  return (
    <div className="empty-state">
      <h2>No portfolio data found</h2>
      <p>Upload your CAMS CAS statement to get started.</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn" style={{ border: '1px solid var(--border-color)' }} onClick={onAddAsset}>
          <Plus size={18} /> Add Other Asset
        </button>
        <button className="btn btn-primary" onClick={onUpload}>
          <UploadIcon size={18} /> Upload CAS
        </button>
      </div>
    </div>
  );
}
