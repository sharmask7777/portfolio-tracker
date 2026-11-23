import React from 'react';
import {
  LayoutDashboard,
  Moon,
  Sun,
  Smartphone,
  LogOut,
} from 'lucide-react';
import type { PerformanceMode } from '@portfolio/core-view';

interface DashboardHeaderBarProps {
  performanceMode: PerformanceMode;
  onSetPerformanceMode: (mode: PerformanceMode) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenPairModal: () => void;
  userEmail: string | undefined;
  onLogout: () => void;
  onPurge: () => void;
}

/**
 * Top dashboard header bar containing logo, performance mode selector, theme toggle, mobile pairing, and user controls.
 */
export const DashboardHeaderBar: React.FC<DashboardHeaderBarProps> = ({
  performanceMode,
  onSetPerformanceMode,
  theme,
  onToggleTheme,
  onOpenPairModal,
  userEmail,
  onLogout,
  onPurge,
}) => {
  const displayUser = userEmail ? userEmail.split('@')[0] : 'User';

  return (
    <header className="header">
      <div className="logo">
        <LayoutDashboard size={24} />
        <span>Portfolio Tracker</span>
      </div>
      <div className="header-actions">
        <div className="segmented-control">
          <button
            className={performanceMode === 'XIRR' ? 'active' : ''}
            onClick={() => onSetPerformanceMode('XIRR')}
          >
            XIRR
          </button>
          <button
            className={performanceMode === 'ABS' ? 'active' : ''}
            onClick={() => onSetPerformanceMode('ABS')}
          >
            ABS
          </button>
        </div>
        <button onClick={onToggleTheme} className="theme-toggle" aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button
          onClick={onOpenPairModal}
          className="theme-toggle"
          title="Pair Mobile App"
          aria-label="Pair Mobile App"
          data-testid="pair-mobile-button"
        >
          <Smartphone size={20} />
        </button>
        <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{displayUser}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Free Plan</div>
          </div>
          <button
            className="theme-toggle"
            title="Logout"
            aria-label="Logout"
            onClick={onLogout}
            style={{ color: 'var(--danger-color)' }}
          >
            <LogOut size={20} />
          </button>
          <button
            className="btn btn-danger"
            style={{ marginLeft: '0.5rem', backgroundColor: 'var(--danger-color)', color: 'var(--bg-primary)', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
            onClick={onPurge}
          >
            Purge
          </button>
        </div>
      </div>
    </header>
  );
};
