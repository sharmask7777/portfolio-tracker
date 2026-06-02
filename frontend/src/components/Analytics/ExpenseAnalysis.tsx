import React from 'react';
import { XRayData } from './types';

interface ExpenseAnalysisProps {
  data: XRayData;
}

export const ExpenseAnalysis: React.FC<ExpenseAnalysisProps> = ({ data }) => {
  if (!data || !data.expenseAnalysis) return null;
  const { totalAnnualFees, weightedAvgTer, categoryBreakdown } = data.expenseAnalysis;
  
  const formatCurrency = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };
  
  const formatPercent = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return `${val.toFixed(2)}%`;
  };

  return (
    <div className="card expense-card">
      <h3>Expense Analysis</h3>
      
      <div className="expense-summary">
        <div>
          <div className="expense-metric-label">Total Fees Paid (Annualized)</div>
          <div className="expense-metric-value">{formatCurrency(totalAnnualFees)}</div>
        </div>
        <div>
          <div className="expense-metric-label">Weighted Average TER</div>
          <div className="expense-metric-value">{formatPercent(weightedAvgTer)}</div>
        </div>
      </div>

      <h4>Fund Category Breakdown</h4>
      <div className="expense-table-container">
        <table className="expense-table">
          <thead>
            <tr>
              <th className="left">Category Name</th>
              <th className="right">Total Fees Paid</th>
              <th className="right">Average TER</th>
            </tr>
          </thead>
          <tbody>
            {(categoryBreakdown || []).map((cat, i) => (
              <tr key={i}>
                <td>{cat.category || 'Unknown'}</td>
                <td className="right">{formatCurrency(cat.totalFees)}</td>
                <td className="right">{formatPercent(cat.avgTer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
