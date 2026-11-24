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
  const startYear = parseInt(selectedFY.split('-')[0] ?? '', 10);
  const endYear = startYear + 1;

  const dueDates: Record<AdvanceTaxQuarter, string> = {
    [AdvanceTaxQuarter.Q1]: `15/06/${startYear}`,
    [AdvanceTaxQuarter.Q2A]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q2B]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q3]: `15/12/${startYear}`,
    [AdvanceTaxQuarter.Q4]: `15/03/${endYear}`,
    [AdvanceTaxQuarter.Q5]: `31/03/${endYear}`,
  };

  const quartersList = [
    AdvanceTaxQuarter.Q1,
    AdvanceTaxQuarter.Q2A,
    AdvanceTaxQuarter.Q2B,
    AdvanceTaxQuarter.Q3,
    AdvanceTaxQuarter.Q4,
    AdvanceTaxQuarter.Q5,
  ];

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Advance Tax Accrual Matrix
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Schedule CG Table F (Section 234C Interest Mitigation for FY {selectedFY})
        </span>
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
              <th>Est. Tax (with Cess)</th>
            </tr>
          </thead>
          <tbody>
            {quartersList.map((q) => {
              const qData = advanceTaxMatrix.quarters[q] || {
                stcg15: 0,
                stcg20: 0,
                ltcg10: 0,
                ltcg12_5: 0,
                debtLtcg12_5: 0,
                debtLtcg20: 0,
                slab: 0,
                totalGain: 0,
                taxBeforeCess: 0,
                cess: 0,
                estimatedTax: 0,
              };
              const debtTotal = (qData.debtLtcg12_5 || 0) + (qData.debtLtcg20 || 0);
              const qTotalGain =
                (qData.stcg15 || 0) +
                (qData.stcg20 || 0) +
                (qData.ltcg10 || 0) +
                (qData.ltcg12_5 || 0) +
                (qData.slab || 0) +
                debtTotal;

              return (
                <tr key={q}>
                  <td><strong>{q}</strong></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {dueDates[q]}
                  </td>
                  <td>{formatCurrency(qData.stcg15)}</td>
                  <td>{formatCurrency(qData.stcg20)}</td>
                  <td>{formatCurrency(qData.ltcg10)}</td>
                  <td>{formatCurrency(qData.ltcg12_5)}</td>
                  <td>{formatCurrency(qData.slab)}</td>
                  <td>{formatCurrency(debtTotal)}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(qTotalGain)}</td>
                  <td>{formatCurrency(qData.estimatedTax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
