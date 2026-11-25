import React from 'react';
import { AdvanceTaxQuarter, type AdvanceTaxAccrualMatrix } from '../../utils/itr-report-types';

interface AdvanceTaxMatrixTableProps {
  selectedFY: string;
  advanceTaxMatrix: AdvanceTaxAccrualMatrix;
  formatCurrency: (val: number) => string;
}

export const AdvanceTaxMatrixTable: React.FC<AdvanceTaxMatrixTableProps> = ({
  selectedFY,
  advanceTaxMatrix,
  formatCurrency,
}) => {
  const yearMatch = selectedFY.match(/(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1] ?? '', 10) : NaN;
  const hasValidYear = Number.isFinite(startYear);
  const endYear = hasValidYear ? startYear + 1 : NaN;

  const dueDates: Record<AdvanceTaxQuarter, string> = {
    [AdvanceTaxQuarter.Q1]: hasValidYear ? `15/06/${startYear}` : '15/06',
    [AdvanceTaxQuarter.Q2A]: hasValidYear ? `15/09/${startYear}` : '15/09',
    [AdvanceTaxQuarter.Q2B]: hasValidYear ? `15/09/${startYear}` : '15/09',
    [AdvanceTaxQuarter.Q3]: hasValidYear ? `15/12/${startYear}` : '15/12',
    [AdvanceTaxQuarter.Q4]: hasValidYear ? `15/03/${endYear}` : '15/03',
    [AdvanceTaxQuarter.Q5]: hasValidYear ? `31/03/${endYear}` : '31/03',
  };

  const toNum = (val: unknown): number => {
    const n = typeof val === 'number' ? val : Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  const quartersList = [
    AdvanceTaxQuarter.Q1,
    AdvanceTaxQuarter.Q2A,
    AdvanceTaxQuarter.Q2B,
    AdvanceTaxQuarter.Q3,
    AdvanceTaxQuarter.Q4,
    AdvanceTaxQuarter.Q5,
  ];

  let runningCumulativeTax = 0;
  const rows = quartersList.map((q) => {
    const qData = advanceTaxMatrix.quarters[q];
    const stcg15 = toNum(qData?.stcg15);
    const stcg20 = toNum(qData?.stcg20);
    const ltcg10 = toNum(qData?.ltcg10);
    const ltcg12_5 = toNum(qData?.ltcg12_5);
    const slab = toNum(qData?.slab);
    const debtTotal = toNum(qData?.debtLtcg12_5) + toNum(qData?.debtLtcg20);
    const qTotalGain = stcg15 + stcg20 + ltcg10 + ltcg12_5 + slab + debtTotal;
    const estimatedTax = toNum(qData?.estimatedTax);
    runningCumulativeTax += estimatedTax;
    return {
      q,
      dueDate: dueDates[q],
      stcg15,
      stcg20,
      ltcg10,
      ltcg12_5,
      slab,
      debtTotal,
      qTotalGain,
      estimatedTax,
      cumulativeTax: runningCumulativeTax,
    };
  });

  const totalGainsAllQuarters = rows.reduce((sum, r) => sum + r.qTotalGain, 0);
  const totalTaxAllQuarters = runningCumulativeTax;

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Advance Tax Accrual Matrix
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Schedule CG Table F (Section 234C Interest Mitigation for FY {selectedFY})
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Advance Tax Payable
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: totalTaxAllQuarters > 0 ? 'var(--danger-color)' : 'var(--text-primary)' }}>
            {formatCurrency(totalTaxAllQuarters)}
          </div>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Due Date</th>
              <th>Sec 111A (15%)</th>
              <th>Sec 111A (20%)</th>
              <th>Sec 112A (10%)</th>
              <th>Sec 112A (12.5%)</th>
              <th>Sec 50AA (Slab)</th>
              <th>Sec 112 Debt</th>
              <th>Total Gains</th>
              <th>Quarter Tax (with Cess)</th>
              <th>Cumulative Payable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.q}>
                <td><strong>{row.q}</strong></td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {row.dueDate}
                </td>
                <td>{formatCurrency(row.stcg15)}</td>
                <td>{formatCurrency(row.stcg20)}</td>
                <td>{formatCurrency(row.ltcg10)}</td>
                <td>{formatCurrency(row.ltcg12_5)}</td>
                <td>{formatCurrency(row.slab)}</td>
                <td>{formatCurrency(row.debtTotal)}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(row.qTotalGain)}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(row.estimatedTax)}</td>
                <td style={{ fontWeight: 700, color: row.cumulativeTax > 0 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
                  {formatCurrency(row.cumulativeTax)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
              <td colSpan={8}>Total FY {selectedFY}</td>
              <td>{formatCurrency(totalGainsAllQuarters)}</td>
              <td>{formatCurrency(totalTaxAllQuarters)}</td>
              <td style={{ color: totalTaxAllQuarters > 0 ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                {formatCurrency(totalTaxAllQuarters)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
