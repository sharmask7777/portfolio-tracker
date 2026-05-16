import React from 'react';

interface IntersectionViewProps {
  exposures: any[];
}

export const IntersectionView: React.FC<IntersectionViewProps> = ({ exposures }) => {
  if (!exposures) return <div>Loading intersection data...</div>;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
  };

  return (
    <div className="intersection-view">
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Stock Name</th>
              <th>Sector</th>
              <th>Total Exposure (%)</th>
              <th>Total Value</th>
              <th>Contributing Funds</th>
            </tr>
          </thead>
          <tbody>
            {exposures.slice(0, 20).map((item, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td>{item.sector}</td>
                <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                  {formatPercent(item.percentage)}
                </td>
                <td>{formatCurrency(item.absoluteValue)}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {item.contributions.map((c: any, cIdx: number) => (
                      <span key={cIdx} className="contribution-tag" title={`${formatPercent(c.weight / 100)} weight in fund`}>
                        {c.schemeName} ({formatPercent(c.weight / 100)})
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
