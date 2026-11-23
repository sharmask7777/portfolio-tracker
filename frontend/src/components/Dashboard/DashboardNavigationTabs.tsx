import React from 'react';
import {
  LayoutDashboard,
  PieChart as PieChartIcon,
  Layers,
  ShieldCheck,
  BrainCircuit,
} from 'lucide-react';

export type DashboardTab = 'overview' | 'xray' | 'intersection' | 'tax' | 'insights';

interface DashboardNavigationTabsProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

/**
 * Top-level dashboard view tab bar (Overview, Portfolio X-Ray, Stock Intersection, Tax, Health & Goals).
 */
export const DashboardNavigationTabs: React.FC<DashboardNavigationTabsProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => onSelectTab('overview')}
      >
        <LayoutDashboard size={16} style={{ marginRight: '0.5rem' }} /> Overview
      </button>
      <button
        className={`tab ${activeTab === 'xray' ? 'active' : ''}`}
        onClick={() => onSelectTab('xray')}
      >
        <PieChartIcon size={16} style={{ marginRight: '0.5rem' }} /> Portfolio X-Ray
      </button>
      <button
        className={`tab ${activeTab === 'intersection' ? 'active' : ''}`}
        onClick={() => onSelectTab('intersection')}
      >
        <Layers size={16} style={{ marginRight: '0.5rem' }} /> Stock Intersection
      </button>
      <button
        className={`tab ${activeTab === 'tax' ? 'active' : ''}`}
        onClick={() => onSelectTab('tax')}
      >
        <ShieldCheck size={16} style={{ marginRight: '0.5rem' }} /> Tax Optimization
      </button>
      <button
        className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
        onClick={() => onSelectTab('insights')}
      >
        <BrainCircuit size={16} style={{ marginRight: '0.5rem' }} /> Health & Goals
      </button>
    </div>
  );
};
