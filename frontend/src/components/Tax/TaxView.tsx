import React from 'react';
import { Download, TrendingDown } from 'lucide-react';

interface TaxViewProps {
  summary: any;
  harvesting: any;
}

export const TaxView: React.FC<TaxViewProps> = ({ summary, harvesting }) => {
  if (!summary) return <div>Loading tax data...</div>;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const exportCSV = () => {
    if (!summary.details || summary.details.length === 0) return;
    
    const headers = ['Scheme Name', 'Buy Date', 'Sell Date', 'Units', 'Buy NAV', 'Sell NAV', 'Gain', 'Tax Type', 'Grandfathered'];
    const rows = summary.details.map((g: any) => [
      g.assetName,
      new Date(g.buyDate).toLocaleDateString(),
      new Date(g.sellDate).toLocaleDateString(),
      g.units.toFixed(3),
      g.buyNav.toFixed(4),
      g.sellNav.toFixed(4),
      g.gain.toFixed(2),
      g.taxType,
      g.isGrandfathered ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "capital_gains_report.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ltcgUsed = summary.realized.ltcg;
  const ltcgLimit = 125000;
  const ltcgPercent = Math.min(100, (ltcgUsed / ltcgLimit) * 100);

  return (
    <div className="tax-view">
      <div className="xray-grid">
        <div className="card">
          <h3>LTCG Exemption Tracker (FY 2024-25)</h3>
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Used: {formatCurrency(ltcgUsed)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>Limit: {formatCurrency(ltcgLimit)}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${ltcgPercent}%`, backgroundColor: ltcgPercent > 90 ? 'var(--danger-color)' : 'var(--success-color)' }}></div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {ltcgUsed >= ltcgLimit ? "Limit exhausted." : `${formatCurrency(ltcgLimit - ltcgUsed)} of tax-free gains remaining.`}
            </p>
          </div>
        </div>

        {harvesting && harvesting.opportunities.length > 0 && (
          <div className="card harvest-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingDown size={20} /> Tax Harvesting Opportunity
            </h3>
            <p style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>
              You can realize <strong>{formatCurrency(harvesting.totalPotentialHarvest)}</strong> in LTCG tax-free.
            </p>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Estimated Tax Savings: <span className="positive" style={{ fontWeight: 700 }}>{formatCurrency(harvesting.estimatedTaxSavings)}</span>
            </div>
            <div style={{ marginTop: '1rem' }}>
              {harvesting.opportunities.slice(0, 2).map((op: any, i: number) => (
                <div key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  {op.schemeName}: Sell {op.unitsToHarvest.toFixed(3)} units
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Realized Gains Summary</h3>
          <button className="btn btn-primary" onClick={exportCSV} style={{ fontSize: '0.75rem' }}>
            <Download size={14} /> Export ITR Report (CSV)
          </button>
        </div>
        
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Realized Gain</th>
              <th>Estimated Tax</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="badge badge-lt">LTCG (Equity)</span></td>
              <td>{formatCurrency(summary.realized.ltcg)}</td>
              <td>{formatCurrency(Math.max(0, (summary.realized.ltcg - 125000) * 0.125))}</td>
              <td style={{ fontSize: '0.75rem' }}>Exempt up to ₹1.25L</td>
            </tr>
            <tr>
              <td><span className="badge badge-st">STCG (Equity)</span></td>
              <td>{formatCurrency(summary.realized.stcg)}</td>
              <td>{formatCurrency(summary.realized.stcg * 0.20)}</td>
              <td style={{ fontSize: '0.75rem' }}>Taxed at 20%</td>
            </tr>
            <tr>
              <td><span className="badge badge-slab">Debt / Others</span></td>
              <td>{formatCurrency(summary.realized.slab)}</td>
              <td>---</td>
              <td style={{ fontSize: '0.75rem' }}>Taxed at Slab Rate</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Recent Tax-Impactful Transactions</h3>
        <div className="table-container" style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Units</th>
                <th>Date</th>
                <th>Gain</th>
                <th>Tax</th>
              </tr>
            </thead>
            <tbody>
              {summary.details.slice(0, 10).map((g: any, i: number) => (
                <tr key={i}>
                  <td>{g.assetName}</td>
                  <td>{g.units.toFixed(2)}</td>
                  <td>{new Date(g.sellDate).toLocaleDateString()}</td>
                  <td className={g.gain >= 0 ? 'positive' : 'negative'}>{formatCurrency(g.gain)}</td>
                  <td><span className={`badge badge-${g.taxType.toLowerCase()}`}>{g.taxType}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
