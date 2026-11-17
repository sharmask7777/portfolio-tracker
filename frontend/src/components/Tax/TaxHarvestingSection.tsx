import React from 'react';
import { TrendingDown, Copy, Check } from 'lucide-react';
import type { HarvestTicketResponse } from '../../types/generated/HarvestTicketResponse';
import { HarvestOpportunitiesTable } from './HarvestOpportunitiesTable';

interface TaxHarvestingSectionProps {
  harvesting: HarvestTicketResponse;
  copySuccess: boolean;
  onCopyInstructions: () => void;
  onSimulateHarvest?: ((folioId: string, units: number) => void) | undefined;
  formatCurrency: (val: number) => string;
}

export const TaxHarvestingSection: React.FC<TaxHarvestingSectionProps> = ({
  harvesting,
  copySuccess,
  onCopyInstructions,
  onSimulateHarvest,
  formatCurrency,
}) => (
  <div className="card harvest-card">
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}
    >
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <TrendingDown size={20} /> Tax Harvesting Opportunity
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
          CBDT Sec 112A Compliant (₹1.25L Tax-Free LTCG)
        </span>
      </div>
      {harvesting.opportunities && harvesting.opportunities.length > 0 && (
        <button
          className="btn btn-secondary"
          onClick={onCopyInstructions}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', padding: '0.35rem 0.65rem', cursor: 'pointer' }}
          title="Copy redemption instructions for MF Central, CAMS, or KFintech"
        >
          {copySuccess ? <Check size={14} style={{ color: 'var(--success-color)' }} /> : <Copy size={14} />}
          <span>{copySuccess ? 'Copied Instructions!' : 'Copy MF Central Instructions'}</span>
        </button>
      )}
    </div>

    <p style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>
      You can realize{' '}
      <strong className="positive">{formatCurrency(harvesting.totalPotentialHarvest ?? 0)}</strong>{' '}
      in LTCG tax-free.
    </p>

    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
      <div>
        Unutilized Runway:{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(harvesting.remainingExemption ?? 0)}</strong>
      </div>
      <div>
        Est. Tax Savings (12.5%):{' '}
        <span className="positive" style={{ fontWeight: 700 }}>
          {formatCurrency(harvesting.estimatedTaxSavings ?? 0)}
        </span>
      </div>
    </div>

    {harvesting.opportunities && harvesting.opportunities.length > 0 ? (
      <HarvestOpportunitiesTable
        opportunities={harvesting.opportunities}
        onSimulateHarvest={onSimulateHarvest}
        formatCurrency={formatCurrency}
      />
    ) : (
      <div
        style={{
          marginTop: '0.75rem',
          padding: '0.875rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '6px',
          border: '1px dashed var(--border-color)',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          lineHeight: 1.45,
        }}
      >
        {(harvesting.remainingExemption ?? 0) > 0 ? (
          <span>
            You have <strong>{formatCurrency(harvesting.remainingExemption ?? 0)}</strong> of
            statutory tax-free exemption runway remaining this fiscal year, but no eligible
            equity holdings currently meet the 365-day holding threshold, zero-exit-load
            window, or statutory lock-in periods (e.g., ELSS 3-year lock-in).
          </span>
        ) : (
          <span>
            The statutory Section 112A tax-free LTCG exemption of ₹1.25 Lakh has already
            been fully claimed or exhausted for this fiscal year. Any additional redemptions
            will incur 12.5% LTCG tax.
          </span>
        )}
      </div>
    )}
  </div>
);
