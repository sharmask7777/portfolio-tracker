import React from 'react';
import { classifySection } from '../../utils/itr-report-generator';
import type { ITRGainDetail } from '../../utils/itr-report-generator';

interface RecentTransactionsTableProps {
  selectedFY: string;
  filteredDetails: ITRGainDetail[];
  formatCurrency: (val: number) => string;
}

export const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = ({
  selectedFY,
  filteredDetails,
  formatCurrency,
}) => (
  <div className="card">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3>Recent Tax-Impactful Transactions (FY {selectedFY})</h3>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Showing {Math.min(20, filteredDetails.length)} of {filteredDetails.length} transactions
      </span>
    </div>
    <div
      className="table-container"
      style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>Scheme</th>
            <th>Section</th>
            <th>Quarter</th>
            <th>Units</th>
            <th>Buy Date</th>
            <th>Sell Date</th>
            <th>Gain / (Loss)</th>
            <th>Tax</th>
          </tr>
        </thead>
        <tbody>
          {filteredDetails.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No realized gains found for this period.
              </td>
            </tr>
          ) : (
            filteredDetails.slice(0, 20).map((g: ITRGainDetail, i: number) => {
              const section = classifySection(g);
              return (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{g.assetName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Folio: {g.folioNumber || 'N/A'} | ISIN: {g.isin || 'N/A'}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-lt" style={{ fontSize: '0.7rem' }}>
                      {section}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{g.advanceTaxQuarter || '---'}</td>
                  <td>{typeof g.units === 'number' && Number.isFinite(g.units) ? g.units.toFixed(2) : '0.00'}</td>
                  <td>
                    {new Date(g.buyDate).toLocaleDateString()}
                    {g.isAnchorDependent && (
                      <span
                        title="Estimated from Synthetic Anchor"
                        style={{ color: 'var(--warning-color)', marginLeft: '4px' }}
                      >
                        *
                      </span>
                    )}
                  </td>
                  <td>{new Date(g.sellDate).toLocaleDateString()}</td>
                  <td className={g.gain >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(g.gain)}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${(g.taxType || 'unknown').toLowerCase()}${
                        g.isGrandfathered ? '-grandfathered' : ''
                      }`}
                    >
                      {g.isGrandfathered ? 'GF-' : ''}
                      {g.taxType || '---'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
);
