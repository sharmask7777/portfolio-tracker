import React from 'react';
import { User, Edit2, Users, Trash2 } from 'lucide-react';

interface ManagedProfile {
  id: string;
  name: string;
  pan: string;
  taxSlab?: number;
}

interface FamilySelectorProps {
  profiles: ManagedProfile[];
  selectedProfileId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (profile: ManagedProfile) => void;
  onDelete?: (profile: ManagedProfile) => void;
}

export const FamilySelector: React.FC<FamilySelectorProps> = ({ 
  profiles, 
  selectedProfileId, 
  onSelect,
  onRename,
  onDelete 
}) => {
  return (
    <div className="family-selector-container">
      <button
        className={`chip ${selectedProfileId === null ? 'active' : ''}`}
        onClick={() => onSelect(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '100px',
          border: '1px solid var(--border-color)',
          background: selectedProfileId === null ? 'var(--accent-color)' : 'var(--bg-secondary)',
          color: selectedProfileId === null ? 'var(--bg-primary)' : 'var(--text-primary)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s'
        }}
      >
        <Users size={16} />
        Consolidated Family
      </button>

      {profiles.map((profile) => (
        <div key={profile.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            className={`chip ${selectedProfileId === profile.id ? 'active' : ''}`}
            onClick={() => onSelect(profile.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              paddingRight: onDelete ? '3.75rem' : '2.5rem',
              borderRadius: '100px',
              border: '1px solid var(--border-color)',
              background: selectedProfileId === profile.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: selectedProfileId === profile.id ? 'var(--bg-primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <User size={16} />
            {profile.name}
          </button>
          <div style={{ position: 'absolute', right: '0.5rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRename(profile);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: selectedProfileId === profile.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Rename Profile"
            >
              <Edit2 size={12} />
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(profile);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: selectedProfileId === profile.id ? 'var(--bg-primary)' : 'var(--danger-color, #ef4444)',
                  padding: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Delete Profile"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
