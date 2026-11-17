import React from 'react';
import type { HarvestOpportunityDto } from '../../types/generated/HarvestOpportunityDto';

interface HarvestOpportunitiesTableProps {
  opportunities: HarvestOpportunityDto[];
  onSimulateHarvest?: ((folioId: string, units: number) => void) | undefined;
  formatCurrency: (val: number) => string;
}

export const HarvestOpportunitiesTable: React.FC<HarvestOpportunitiesTableProps> = ({
  opportunities,
  onSimulateHarvest,
  formatCurrency,
}) => (
  <div className="table-container" style={{ marginTop: '0.75rem', maxHeight: '260px', overflowY: 'auto' }}>
    <table className="data-table" style={{ fontSize: '0.75rem' }}>
      <thead>
        <tr>
          <th>Scheme & Folio</th>
          <th style={{ textAlign: 'right' }}>Redeem Units</th>
          <th style={{ textAlign: 'right' }}>Est. Value</th>
          <th style={{ textAlign: 'right' }}>Gain</th>
          {onSimulateHarvest && <th style={{ textAlign: 'center' }}>Action</th>}
        </tr>
      </thead>
      <tbody>
        {opportunities.map((op: HarvestOpportunityDto, i: number) => {
          const unitsStr =
            typeof op.unitsToHarvest === 'number' && Number.isFinite(op.unitsToHarvest)
              ? op.unitsToHarvest.toFixed(3)
              : '0.000';
          return (
            <tr key={i}>
              <td>
                <div style={{ fontWeight: 500 }}>
                  <span
                    className="btn-link"
                    style={{
                      cursor: onSimulateHarvest ? 'pointer' : 'default',
                      textDecoration: onSimulateHarvest ? 'underline' : 'none',
                    }}
                    onClick={() =>
                      onSimulateHarvest && onSimulateHarvest(op.folioId ?? '', op.unitsToHarvest)
                    }
                  >
                    {op.schemeName}
                  </span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.15rem' }}>
                  <span>Folio: {op.folioNumber || op.folioId || 'Primary Folio'}</span>
                  {op.lotsCount && op.lotsCount > 1 ? (
                    <span
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.625rem',
                      }}
                    >
                      {op.lotsCount} SIP lots consolidated
                    </span>
                  ) : null}
                </div>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                {unitsStr} units
              </td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(op.currentValue ?? 0)}</td>
              <td style={{ textAlign: 'right', color: 'var(--success-color)', fontWeight: 600 }}>
                +{formatCurrency(op.unrealizedGain ?? 0)}
              </td>
              {onSimulateHarvest && (
                <td style={{ textAlign: 'center' }}>
                  <button
                    className="btn btn-secondary btn-link"
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', cursor: 'pointer' }}
                    onClick={() => onSimulateHarvest(op.folioId ?? '', op.unitsToHarvest)}
                  >
                    Simulate
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
