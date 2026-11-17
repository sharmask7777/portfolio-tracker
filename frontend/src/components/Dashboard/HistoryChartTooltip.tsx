import React from 'react';
import type { HistoryPoint } from '../../types/generated/HistoryPoint';

interface TooltipPayloadItem {
  payload: HistoryPoint;
}

export interface CustomTooltipProps {
  active?: boolean | undefined;
  payload?: TooltipPayloadItem[] | undefined;
  label?: string | undefined;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

const formatDate = (str: string) => {
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
};

export const HistoryChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  const firstItem = payload?.[0];
  if (!active || !firstItem) return null;

  const data = firstItem.payload;
  const gain = data.value - data.investedAmount;
  const gainPercent = data.investedAmount > 0 ? (gain / data.investedAmount) * 100 : 0;
  const isPositive = gain >= 0;

  return (
    <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', minWidth: '220px' }}>
      <p style={{ margin: '0 0 0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{label ? formatDate(label) : ''}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Current Value</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(data.value)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Invested Amount</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(data.investedAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Unrealized Gain</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isPositive ? 'var(--success-color)' : 'var(--danger-color)' }}>
            {formatCurrency(gain)} ({gainPercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
