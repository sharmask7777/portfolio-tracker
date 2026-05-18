import React from 'react';
import { Download, TrendingDown } from 'lucide-react';

interface TaxViewProps {
  summary: any;
  harvesting: any;
  onSimulateHarvest?: (folioId: string, units: number) => void;
}

export const TaxView: React.FC<TaxViewProps> = ({ summary, harvesting, onSimulateHarvest }) => {
  const [selectedFY, setSelectedFY] = React.useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 3 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  });

  if (!summary) return <div>Loading tax data...</div>;

  const getRecentFYs = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    let startYear = month >= 3 ? year : year - 1;
    const fys = [];
    for (let i = 0; i < 3; i++) {
      fys.push(`${startYear}-${(startYear + 1).toString().slice(-2)}`);
      startYear--;
    }
    return fys;
  };

  const recentFYs = getRecentFYs();

  const getFYDates = (fy: string) => {
    const startYear = parseInt(fy.split('-')[0]);
    return {
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31, 23, 59, 59)
    };
  };

  const dates = getFYDates(selectedFY);
  const filteredDetails = summary.details.filter((g: any) => {
    const sellDate = new Date(g.sellDate);
    return sellDate >= dates.start && sellDate <= dates.end;
  });

  const realizedLTCG = filteredDetails.filter((g: any) => g.taxType === 'LTCG' && !g.isGrandfathered).reduce((acc: number, g: any) => acc + g.gain, 0);
  const realizedSTCG = filteredDetails.filter((g: any) => g.taxType === 'STCG').reduce((acc: number, g: any) => acc + g.gain, 0);
  const realizedSlab = filteredDetails.filter((g: any) => g.taxType === 'SLAB').reduce((acc: number, g: any) => acc + g.gain, 0);
  
  // Separate Grandfathered Equity (Pre-2018) and Grandfathered Debt (Pre-2023)
  // Note: Backend currently sets isGrandfathered for both
  const realizedGrandfatheredDebt = filteredDetails.filter((g: any) => g.isGrandfathered && g.taxType === 'LTCG' && g.taxRate === 0.20).reduce((acc: number, g: any) => acc + g.gain, 0);
  const realizedGrandfatheredEquity = filteredDetails.filter((g: any) => g.isGrandfathered && g.taxType === 'LTCG' && g.taxRate === 0.10).reduce((acc: number, g: any) => acc + g.gain, 0);

  // Total Equity LTCG includes both standard and grandfathered
  const totalLTCGEquity = realizedLTCG + realizedGrandfatheredEquity;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const exportCSV = () => {
    if (filteredDetails.length === 0) return;
    
    const headers = ['Scheme Name', 'Buy Date', 'Sell Date', 'Units', 'Buy NAV', 'Sell NAV', 'Gain', 'Tax Type', 'Grandfathered'];
    const rows = filteredDetails.map((g: any) => [
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
    link.setAttribute("download", `capital_gains_report_FY_${selectedFY}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // LTCG limit changed from 1L to 1.25L in Budget 2024
  const ltcgLimit = selectedFY >= '2024-25' ? 125000 : 100000;
  const ltcgUsed = Math.max(0, realizedLTCG);
  const ltcgPercent = Math.min(100, (ltcgUsed / ltcgLimit) * 100);

  return (
    <div className="tax-view animate-fade">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <select 
          className="card" 
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          value={selectedFY}
          onChange={(e) => setSelectedFY(e.target.value)}
        >
          {recentFYs.map(fy => <option key={fy} value={fy}>Financial Year {fy}</option>)}
        </select>
      </div>

      <div className="xray-grid">
        <div className="card">
          <h3>LTCG Exemption Tracker (FY {selectedFY})</h3>
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

        {selectedFY === recentFYs[0] && harvesting && harvesting.opportunities.length > 0 && (
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
                <div 
                  key={i} 
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0', borderTop: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }}
                  onClick={() => onSimulateHarvest && onSimulateHarvest(op.folioId, op.unitsToHarvest)}
                >
                  <span className="btn-link">{op.schemeName}: Sell {op.unitsToHarvest.toFixed(3)} units</span>
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
              <td>{formatCurrency(totalLTCGEquity)}</td>
              <td>{formatCurrency(Math.max(0, (totalLTCGEquity - ltcgLimit) * 0.125))}</td>
              <td style={{ fontSize: '0.75rem' }}>Exempt up to ₹{formatCurrency(ltcgLimit).replace('₹', '')}</td>
            </tr>
            <tr>
              <td><span className="badge badge-st">STCG (Equity)</span></td>
              <td>{formatCurrency(realizedSTCG)}</td>
              <td>{formatCurrency(Math.max(0, realizedSTCG * (selectedFY >= '2024-25' ? 0.20 : 0.15)))}</td>
              <td style={{ fontSize: '0.75rem' }}>Taxed at {selectedFY >= '2024-25' ? '20%' : '15%'}</td>
            </tr>
            <tr>
              <td><span className="badge badge-slab" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}>Grandfathered Debt</span></td>
              <td>{formatCurrency(realizedGrandfatheredDebt)}</td>
              <td>{formatCurrency(Math.max(0, realizedGrandfatheredDebt * 0.20))}</td>
              <td style={{ fontSize: '0.75rem' }}>20% with Indexation (Pre-2023)</td>
            </tr>
            <tr>
              <td><span className="badge badge-slab">Other Slab Assets</span></td>
              <td>{formatCurrency(realizedSlab)}</td>
              <td>---</td>
              <td style={{ fontSize: '0.75rem' }}>Taxed at Slab Rate</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Recent Tax-Impactful Transactions (FY {selectedFY})</h3>
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
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No realized gains found for this period.</td>
                </tr>
              ) : (
                filteredDetails.slice(0, 20).map((g: any, i: number) => (
                  <tr key={i}>
                    <td>{g.assetName}</td>
                    <td>{g.units.toFixed(2)}</td>
                    <td>{new Date(g.sellDate).toLocaleDateString()}</td>
                    <td className={g.gain >= 0 ? 'positive' : 'negative'}>{formatCurrency(g.gain)}</td>
                    <td><span className={`badge badge-${g.taxType.toLowerCase()}${g.isGrandfathered ? '-grandfathered' : ''}`}>{g.isGrandfathered ? 'GF-' : ''}{g.taxType}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
