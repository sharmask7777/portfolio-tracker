import React from 'react';
import type { AdvanceTaxDisplayModel } from '../../useTaxViewModel';

/**
 * Props for {@link AdvanceTaxMatrixTable}.
 */
export interface AdvanceTaxMatrixTableProps {
  /** Pre-computed display-ready Schedule CG Table F rows, due dates, and cumulative totals */
  advanceTaxDisplay: AdvanceTaxDisplayModel;
  /** Currency formatting callback */
  formatCurrency: (val: number) => string;
}

/**
 * Pure presentation table rendering Schedule CG Table F quarterly advance tax accruals,
 * statutory due dates, and running cumulative gross pre-exemption tax liability.
 *
 * @param props - Display-ready matrix data and currency formatter
 * @returns React element rendering the Advance Tax Accrual Matrix card
 */
export const AdvanceTaxMatrixTable: React.FC<AdvanceTaxMatrixTableProps> = ({
  advanceTaxDisplay,
  formatCurrency,
}) => {
  const { fyLabel, rows, totalGains, totalTax } = advanceTaxDisplay;

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div
        style={{
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h3 id="advance-tax-matrix-heading" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Advance Tax Accrual Matrix
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Schedule CG Table F (Section 234C Interest Mitigation · {fyLabel})
          </span>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Gross Advance Tax (Pre-Exemption)
          </div>
          <div
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: totalTax > 0 ? 'var(--danger-color)' : 'var(--text-primary)',
            }}
          >
            {formatCurrency(totalTax)}
          </div>
        </div>
      </div>

      <div
        className="table-container"
        role="region"
        tabIndex={0}
        aria-label={`Advance Tax Accrual Matrix for ${fyLabel}`}
        style={{ overflowX: 'auto' }}
      >
        <table className="data-table" aria-labelledby="advance-tax-matrix-heading">
          <thead>
            <tr>
              <th scope="col">Quarter</th>
              <th scope="col">Due Date</th>
              <th scope="col">Sec 111A (15%)</th>
              <th scope="col">Sec 111A (20%)</th>
              <th scope="col">Sec 112A (10%)</th>
              <th scope="col">Sec 112A (12.5%)</th>
              <th scope="col">Sec 50AA (Slab)</th>
              <th scope="col">Sec 112 Debt</th>
              <th scope="col">Total Gains</th>
              <th scope="col">Quarter Tax (with Cess)</th>
              <th scope="col">Cumulative Payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quarter}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>
                  {row.quarter}
                </th>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {row.dueDate}
                </td>
                <td>{formatCurrency(row.stcg15)}</td>
                <td>{formatCurrency(row.stcg20)}</td>
                <td>{formatCurrency(row.ltcg10)}</td>
                <td>{formatCurrency(row.ltcg12_5)}</td>
                <td>{formatCurrency(row.slab)}</td>
                <td>{formatCurrency(row.debtTotal)}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(row.totalGain)}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(row.estimatedTax)}</td>
                <td
                  style={{
                    fontWeight: 700,
                    color: row.cumulativeTax > 0 ? 'var(--danger-color)' : 'var(--text-secondary)',
                  }}
                >
                  {formatCurrency(row.cumulativeTax)}
                  {row.isCombinedInstallmentDate && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.68rem',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Combined 15/09 total
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
              <td colSpan={8}>Total ({fyLabel})</td>
              <td>{formatCurrency(totalGains)}</td>
              <td>{formatCurrency(totalTax)}</td>
              <td style={{ color: totalTax > 0 ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                {formatCurrency(totalTax)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        Note: Quarterly figures reflect gross pre-exemption tax per lot (before Sec 112A ₹1.25L/₹1L annual exemption and Sec 70 loss set-off). Q2a (pre-Budget) and Q2b (post-Budget) share the 15/09 installment due date.
      </p>
    </div>
  );
};
