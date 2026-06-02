import React from 'react';
import { XRayData } from './types';
import { ExpenseAnalysis } from './ExpenseAnalysis';
import { XRayDashboard } from './XRayDashboard';

interface XRayViewProps {
  data: XRayData;
}

export const XRayView: React.FC<XRayViewProps> = ({ data }) => {
  if (!data || !data.sectors) return <div className="loading-state">Loading X-Ray data...</div>;

  if (data.totalValue === 0) {
    return (
      <div className="empty-state">
        <h3>No X-Ray Data Available</h3>
        <p>Ensure your portfolio has active holdings with valid ISINs.</p>
      </div>
    );
  }

  return (
    <div className="xray-view animate-fade">
      <ExpenseAnalysis data={data} />
      <XRayDashboard data={data} title="Standard View" />
      {data.exArbitrage && data.exArbitrage.assetAllocation.arbitrage && data.exArbitrage.assetAllocation.arbitrage.value > 0 && (
        <XRayDashboard data={data.exArbitrage} title="Excluding Arbitrage (Black Box)" />
      )}
    </div>
  );
};
