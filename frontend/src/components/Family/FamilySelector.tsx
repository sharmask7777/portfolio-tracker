import React from 'react';
import { User, Edit2, Users } from 'lucide-react';

interface ManagedProfile {
  id: string;
  name: string;
  pan: string;
}

interface FamilySelectorProps {
  profiles: ManagedProfile[];
  selectedProfileId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (profile: ManagedProfile) => void;
}

export const FamilySelector: React.FC<FamilySelectorProps> = ({ 
  profiles, 
  selectedProfileId, 
  onSelect,
  onRename 
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
          color: selectedProfileId === null ? '#fff' : 'var(--text-primary)',
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
              paddingRight: '2.5rem',
              borderRadius: '100px',
              border: '1px solid var(--border-color)',
              background: selectedProfileId === profile.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: selectedProfileId === profile.id ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <User size={16} />
            {profile.name}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename(profile);
            }}
            style={{
              position: 'absolute',
              right: '0.75rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: selectedProfileId === profile.id ? '#fff' : 'var(--text-secondary)',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Rename Profile"
          >
            <Edit2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};
