import React from 'react';
import { computeAY } from '../../utils/itr-report-generator';

interface LtcgExemptionTrackerCardProps {
  selectedFY: string;
  ltcgExemptClaimed: number;
  ltcgLimit: number;
  ltcgUsed: number;
  ltcgPercent: number;
  formatCurrency: (val: number) => string;
}

export const LtcgExemptionTrackerCard: React.FC<LtcgExemptionTrackerCardProps> = ({
  selectedFY,
  ltcgExemptClaimed,
  ltcgLimit,
  ltcgUsed,
  ltcgPercent,
  formatCurrency,
}) => (
  <div className="card">
    <h3>
      LTCG Exemption Tracker (FY {selectedFY} / AY {computeAY(selectedFY)})
    </h3>
    <div style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>
          Used: {formatCurrency(ltcgExemptClaimed)}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Limit: {formatCurrency(ltcgLimit)}
        </span>
      </div>
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{
            width: `${ltcgPercent}%`,
            backgroundColor:
              ltcgPercent > 90 ? 'var(--danger-color)' : 'var(--success-color)',
          }}
        ></div>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
        {ltcgUsed >= ltcgLimit
          ? 'Limit exhausted against gains (exhausted 10% tranche first).'
          : `${formatCurrency(ltcgLimit - ltcgExemptClaimed)} of tax-free gains remaining.`}
      </p>
    </div>
  </div>
);
