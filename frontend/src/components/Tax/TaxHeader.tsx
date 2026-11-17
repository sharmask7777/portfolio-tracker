import React from 'react';
import { Clock } from 'lucide-react';

interface TaxHeaderProps {
  selectedFY: string;
  onFYChange: (fy: string) => void;
  recentFYs: string[];
  hasSyntheticAnchors?: boolean | undefined;
  showExemptionWarning: boolean;
  fyEndInfo: { daysRemaining: number; fyString: string };
  remainingExemption: number;
  formatCurrency: (val: number) => string;
}

export const TaxHeader: React.FC<TaxHeaderProps> = ({
  selectedFY,
  onFYChange,
  recentFYs,
  hasSyntheticAnchors,
  showExemptionWarning,
  fyEndInfo,
  remainingExemption,
  formatCurrency,
}) => (
  <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
      <select
        className="card"
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          cursor: 'pointer',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
        value={selectedFY}
        onChange={(e) => onFYChange(e.target.value)}
      >
        {recentFYs.map((fy) => (
          <option key={fy} value={fy}>
            Financial Year {fy}
          </option>
        ))}
      </select>
    </div>

    {hasSyntheticAnchors && (
      <div
        className="card"
        style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--warning-color)',
          marginBottom: '1.5rem',
          color: 'var(--warning-color)',
        }}
      >
        <div>
          <strong>Incomplete History:</strong> Realized gains and reports involve estimated
          acquisition dates from incomplete CAS histories. Figures are estimates and not
          strictly compliant for tax filing unless a from-inception CAS is uploaded.
        </div>
      </div>
    )}

    {showExemptionWarning && (
      <div
        className="card"
        style={{
          backgroundColor: 'rgba(234, 88, 12, 0.08)',
          border: '1px solid rgba(234, 88, 12, 0.3)',
          marginBottom: '1.5rem',
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <Clock size={20} style={{ color: '#ea580c', flexShrink: 0 }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
          <strong>{fyEndInfo.fyString} Section 112A Exemption Window:</strong>{' '}
          <span style={{ color: '#ea580c', fontWeight: 600 }}>
            {fyEndInfo.daysRemaining} {fyEndInfo.daysRemaining === 1 ? 'day' : 'days'} remaining
          </span>{' '}
          until March 31 IST. Unclaimed statutory tax-free exemption (
          {formatCurrency(remainingExemption)}) expires permanently at fiscal
          year-end and cannot be carried forward.
        </div>
      </div>
    )}
  </>
);
