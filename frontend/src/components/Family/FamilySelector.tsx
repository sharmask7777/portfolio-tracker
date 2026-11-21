import React, { useMemo } from 'react';
import { User, Edit2, Users, Trash2 } from 'lucide-react';
import type { PanBreakdownDto } from '../../types/generated/PanBreakdownDto';

export interface ManagedProfile {
  id: string;
  name: string;
  pan: string;
  taxSlab?: number;
}

export interface FamilySelectorProps {
  profiles: ManagedProfile[];
  selectedProfileId: string | null;
  onSelect: (id: string | null) => void;
  onRename: (profile: ManagedProfile) => void;
  onDelete?: (profile: ManagedProfile) => void;
  panBreakdowns?: PanBreakdownDto[] | undefined;
  totalFolios?: number | undefined;
}

export const FamilySelector: React.FC<FamilySelectorProps> = ({ 
  profiles, 
  selectedProfileId, 
  onSelect,
  onRename,
  onDelete,
  panBreakdowns,
  totalFolios
}) => {
  // Compute total corpus valuation across panBreakdowns to derive share percentages
  const totalValuation = useMemo(() => {
    if (!panBreakdowns || panBreakdowns.length === 0) return 0;
    return panBreakdowns.reduce((sum, item) => sum + (item.currentValue > 0 ? item.currentValue : 0), 0);
  }, [panBreakdowns]);

  // Map PAN (uppercase) to breakdown for fast lookup
  const breakdownByPan = useMemo(() => {
    const map = new Map<string, PanBreakdownDto>();
    if (panBreakdowns) {
      for (const b of panBreakdowns) {
        if (b.pan) {
          map.set(b.pan.trim().toUpperCase(), b);
        }
      }
    }
    return map;
  }, [panBreakdowns]);

  // Aggregate count of folios across all PANs or from totalFolios prop
  const totalCount = useMemo(() => {
    if (typeof totalFolios === 'number') return totalFolios;
    if (panBreakdowns && panBreakdowns.length > 0) {
      return panBreakdowns.reduce((sum, item) => sum + item.folioCount, 0);
    }
    return undefined;
  }, [totalFolios, panBreakdowns]);

  const uniquePanCount = useMemo(() => {
    if (panBreakdowns && panBreakdowns.length > 0) {
      return panBreakdowns.length;
    }
    const pans = new Set(
      profiles
        .map(p => (p.pan ? p.pan.trim().toUpperCase() : ''))
        .filter(Boolean)
    );
    return pans.size;
  }, [panBreakdowns, profiles]);

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
        <span>Consolidated Family</span>
        {uniquePanCount > 0 && (
          <span
            className="badge badge-slab"
            style={{
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: '999px',
              backgroundColor: selectedProfileId === null ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color)',
              color: 'inherit'
            }}
            title={`${uniquePanCount} PANs${totalCount !== undefined ? ` • ${totalCount} Folios` : ''}`}
          >
            {uniquePanCount} PANs{totalCount !== undefined ? ` • ${totalCount} Folios` : ''}
          </span>
        )}
      </button>

      {profiles.map((profile) => {
        const panKey = profile.pan ? profile.pan.trim().toUpperCase() : '';
        const breakdown = panKey ? breakdownByPan.get(panKey) : undefined;
        const corpusShare = totalValuation > 0 && breakdown && breakdown.currentValue > 0
          ? Math.round((breakdown.currentValue / totalValuation) * 100)
          : null;

        return (
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
              <span>{profile.name}</span>
              {profile.pan && (
                <span
                  className="badge badge-slab"
                  style={{
                    fontSize: '0.7rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: selectedProfileId === profile.id ? 'rgba(255, 255, 255, 0.2)' : 'var(--border-color)',
                    color: 'inherit'
                  }}
                  title={`PAN: ${profile.pan}`}
                >
                  {profile.pan}
                </span>
              )}
              {corpusShare !== null && (
                <span
                  className="badge badge-slab"
                  style={{
                    fontSize: '0.7rem',
                    padding: '1px 5px',
                    borderRadius: '999px',
                    backgroundColor: selectedProfileId === profile.id ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color)',
                    color: 'inherit'
                  }}
                  title={`${corpusShare}% of corpus`}
                >
                  {corpusShare}% of corpus
                </span>
              )}
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
        );
      })}
    </div>
  );
};
