import React from 'react';
import { Download } from 'lucide-react';

interface RealizedGainsSummaryTableProps {
  exportCSV: () => void;
  totalEquityLTCG: number;
  ltcg10Gain: number;
  ltcg12_5Gain: number;
  ltcgTotalTax: number;
  ltcgLimit: number;
  ltcgExemptClaimed: number;
  totalSTCG111A: number;
  stcg15Gain: number;
  stcg20Gain: number;
  stcgTotalTax: number;
  totalDebtLTCG: number;
  debtTotalTax: number;
  slabGain: number;
  slabTaxBeforeCess: number;
  slabTotalTax: number;
  baseTaxTotal: number;
  cessTotal: number;
  grandTotalTax: number;
  formatCurrency: (val: number) => string;
}

const TableFooter: React.FC<{
  baseTaxTotal: number;
  cessTotal: number;
  grandTotalTax: number;
  formatCurrency: (val: number) => string;
}> = ({ baseTaxTotal, cessTotal, grandTotalTax, formatCurrency }) => (
  <tfoot>
    <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
      <td>Estimated Tax Summary</td>
      <td>Base Tax: {formatCurrency(baseTaxTotal)}</td>
      <td colSpan={2}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span>Health & Education Cess (4%): {formatCurrency(cessTotal)}</span>
          <span style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>
            Total Tax Payable: {formatCurrency(grandTotalTax)}
          </span>
        </div>
      </td>
    </tr>
  </tfoot>
);

export const RealizedGainsSummaryTable: React.FC<RealizedGainsSummaryTableProps> = ({
  exportCSV,
  totalEquityLTCG,
  ltcg10Gain,
  ltcg12_5Gain,
  ltcgTotalTax,
  ltcgLimit,
  ltcgExemptClaimed,
  totalSTCG111A,
  stcg15Gain,
  stcg20Gain,
  stcgTotalTax,
  totalDebtLTCG,
  debtTotalTax,
  slabGain,
  slabTaxBeforeCess,
  slabTotalTax,
  baseTaxTotal,
  cessTotal,
  grandTotalTax,
  formatCurrency,
}) => (
  <div className="card" style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
      <div>
        <h3>Realized Gains Summary</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Schedule CG Compliant (Finance (No. 2) Act, 2024 / Budget 2024)
        </span>
      </div>
      <button className="btn btn-primary" onClick={exportCSV} style={{ fontSize: '0.75rem' }}>
        <Download size={14} /> Export ITR Report (CSV)
      </button>
    </div>

    <table className="data-table">
      <thead>
        <tr>
          <th>Type / Section</th>
          <th>Realized Gain</th>
          <th>Estimated Tax</th>
          <th>Compliance Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span className="badge badge-lt">112A (10% vs 12.5%)</span></td>
          <td>
            {formatCurrency(totalEquityLTCG)}
            {totalEquityLTCG > 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Pre: {formatCurrency(ltcg10Gain)} @ 10% | Post: {formatCurrency(ltcg12_5Gain)} @ 12.5%
              </div>
            )}
          </td>
          <td>{formatCurrency(ltcgTotalTax)}</td>
          <td style={{ fontSize: '0.75rem' }}>
            Exempt up to ₹{formatCurrency(ltcgLimit).replace('₹', '')} (Exempted: {formatCurrency(ltcgExemptClaimed)})
          </td>
        </tr>
        <tr>
          <td><span className="badge badge-st">111A (15% vs 20%)</span></td>
          <td>
            {formatCurrency(totalSTCG111A)}
            {totalSTCG111A > 0 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Pre: {formatCurrency(stcg15Gain)} @ 15% | Post: {formatCurrency(stcg20Gain)} @ 20%
              </div>
            )}
          </td>
          <td>{formatCurrency(stcgTotalTax)}</td>
          <td style={{ fontSize: '0.75rem' }}>Taxed at 15% (Pre 23-Jul) / 20% (Post 23-Jul)</td>
        </tr>
        <tr>
          <td>
            <span className="badge badge-slab" style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}>
              112 Debt (12.5% or 20% indexed)
            </span>
          </td>
          <td>{formatCurrency(totalDebtLTCG)}</td>
          <td>{formatCurrency(debtTotalTax)}</td>
          <td style={{ fontSize: '0.75rem' }}>20% Indexed (Pre-2023) / 12.5% Unindexed (Post-2024)</td>
        </tr>
        <tr>
          <td><span className="badge badge-slab">50AA (Slab)</span></td>
          <td>{formatCurrency(slabGain)}</td>
          <td>{slabTaxBeforeCess > 0 ? formatCurrency(slabTotalTax) : '---'}</td>
          <td style={{ fontSize: '0.75rem' }}>Taxed at Applicable Slab Rate</td>
        </tr>
      </tbody>
      <TableFooter
        baseTaxTotal={baseTaxTotal}
        cessTotal={cessTotal}
        grandTotalTax={grandTotalTax}
        formatCurrency={formatCurrency}
      />
    </table>
  </div>
);
