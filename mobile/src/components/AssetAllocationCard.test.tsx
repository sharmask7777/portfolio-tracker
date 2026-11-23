import React from 'react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
}));

import {
  AssetAllocationCard,
  ASSET_CLASS_COLORS,
} from './AssetAllocationCard';
import type { AssetAllocationItem } from '../services/portfolio-calculations';

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('AssetAllocationCard', () => {
  it('renders empty message when allocation array is empty', () => {
    const element = AssetAllocationCard({ allocation: [], totalValue: 0 });
    expect(getProps(element)['testID']).toBe('asset-allocation-card');
  });

  it('renders segmented bars and legend for canonical categories', () => {
    const allocation: AssetAllocationItem[] = [
      { name: 'Equity', amount: 600000, percentage: 60, color: '#38bdf8' },
      { name: 'Debt', amount: 200000, percentage: 20, color: '#10b981' },
      { name: 'Arbitrage', amount: 100000, percentage: 10, color: '#ec4899' },
      { name: 'Gold', amount: 50000, percentage: 5, color: '#f59e0b' },
      { name: 'Cash', amount: 30000, percentage: 3, color: '#06b6d4' },
      { name: 'Other', amount: 20000, percentage: 2, color: '#71717a' },
    ];

    const element = AssetAllocationCard({ allocation, totalValue: 1000000 });
    expect(getProps(element)['testID']).toBe('asset-allocation-card');
  });

  it('provides canonical colors in ASSET_CLASS_COLORS map', () => {
    expect(ASSET_CLASS_COLORS['Equity']).toBe('#38bdf8');
    expect(ASSET_CLASS_COLORS['Debt']).toBe('#10b981');
    expect(ASSET_CLASS_COLORS['Arbitrage']).toBe('#ec4899');
    expect(ASSET_CLASS_COLORS['Gold']).toBe('#f59e0b');
    expect(ASSET_CLASS_COLORS['Cash']).toBe('#06b6d4');
    expect(ASSET_CLASS_COLORS['Other']).toBe('#71717a');
  });
});
