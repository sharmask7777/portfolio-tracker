import React from 'react';
import { BarChart2, Zap, Info } from 'lucide-react';

interface RealityCheckModeToggleProps {
  realityCheckMode: boolean;
  setRealityCheckMode: (mode: boolean) => void;
}

export const RealityCheckModeToggle: React.FC<RealityCheckModeToggleProps> = ({
  realityCheckMode,
  setRealityCheckMode,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <div
      style={{
        display: 'inline-flex',
        padding: '0.25rem',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
      }}
    >
      <button
        type="button"
        onClick={() => setRealityCheckMode(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.4rem 0.75rem',
          fontSize: '0.8125rem',
          fontWeight: realityCheckMode ? 500 : 700,
          color: realityCheckMode ? 'var(--text-secondary)' : 'var(--accent-color)',
          backgroundColor: realityCheckMode ? 'transparent' : 'var(--bg-card)',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: realityCheckMode ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
          transition: 'all 0.15s ease',
        }}
      >
        <BarChart2 size={15} />
        Broker View
      </button>
      <button
        type="button"
        onClick={() => setRealityCheckMode(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.4rem 0.75rem',
          fontSize: '0.8125rem',
          fontWeight: realityCheckMode ? 700 : 500,
          color: realityCheckMode ? '#f59e0b' : 'var(--text-secondary)',
          backgroundColor: realityCheckMode ? 'var(--bg-card)' : 'transparent',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: realityCheckMode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <Zap size={15} />
        Reality Check
      </button>
    </div>

    {realityCheckMode && (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.5rem',
          borderRadius: '6px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          color: '#d97706',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        <Info size={12} />
        After-Tax & Inflation Deflated
      </span>
    )}
  </div>
);
