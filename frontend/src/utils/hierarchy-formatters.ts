import { formatIndianRupee as coreFormatIndianRupee } from '@portfolio/core-view';
import type { IndianRupeeFormatOptions, PaletteColor } from './hierarchy-types';

export const SECTOR_PALETTE: Record<string, PaletteColor> = {
  'Financial Services': {
    bg: '#1d4ed8',
    text: '#ffffff',
    darkBg: '#2563eb',
    darkText: '#ffffff',
  },
  'Technology': {
    bg: '#0284c7',
    text: '#ffffff',
    darkBg: '#0ea5e9',
    darkText: '#0f172a',
  },
  'Healthcare': {
    bg: '#059669',
    text: '#ffffff',
    darkBg: '#10b981',
    darkText: '#0f172a',
  },
  'Consumer Cyclical': {
    bg: '#d97706',
    text: '#0f172a',
    darkBg: '#f59e0b',
    darkText: '#0f172a',
  },
  'Consumer Defensive': {
    bg: '#e11d48',
    text: '#ffffff',
    darkBg: '#f43f5e',
    darkText: '#ffffff',
  },
  'Energy': {
    bg: '#b45309',
    text: '#ffffff',
    darkBg: '#d97706',
    darkText: '#0f172a',
  },
  'Industrials': {
    bg: '#4f46e5',
    text: '#ffffff',
    darkBg: '#6366f1',
    darkText: '#ffffff',
  },
  'Basic Materials': {
    bg: '#7c3aed',
    text: '#ffffff',
    darkBg: '#8b5cf6',
    darkText: '#ffffff',
  },
  'Communication Services': {
    bg: '#0891b2',
    text: '#ffffff',
    darkBg: '#06b6d4',
    darkText: '#0f172a',
  },
  'Utilities': {
    bg: '#0f766e',
    text: '#ffffff',
    darkBg: '#14b8a6',
    darkText: '#0f172a',
  },
  'Real Estate': {
    bg: '#9333ea',
    text: '#ffffff',
    darkBg: '#a855f7',
    darkText: '#ffffff',
  },
  'Other': {
    bg: '#475569',
    text: '#ffffff',
    darkBg: '#64748b',
    darkText: '#ffffff',
  },
};

export const ASSET_CLASS_PALETTE: Record<string, PaletteColor> = {
  equity: {
    bg: '#2563eb',
    text: '#ffffff',
    darkBg: '#3b82f6',
    darkText: '#ffffff',
  },
  debt: {
    bg: '#7c3aed',
    text: '#ffffff',
    darkBg: '#8b5cf6',
    darkText: '#ffffff',
  },
  cash: {
    bg: '#059669',
    text: '#ffffff',
    darkBg: '#10b981',
    darkText: '#0f172a',
  },
  gold: {
    bg: '#d97706',
    text: '#0f172a',
    darkBg: '#f59e0b',
    darkText: '#0f172a',
  },
  arbitrage: {
    bg: '#0d9488',
    text: '#ffffff',
    darkBg: '#14b8a6',
    darkText: '#0f172a',
  },
  other: {
    bg: '#64748b',
    text: '#ffffff',
    darkBg: '#94a3b8',
    darkText: '#0f172a',
  },
};

export function getSectorColor(sectorName: string, isDarkMode = false): PaletteColor {
  const entry = SECTOR_PALETTE[sectorName] ?? SECTOR_PALETTE['Other'] ?? {
    bg: '#475569',
    text: '#ffffff',
  };

  if (isDarkMode && entry.darkBg && entry.darkText) {
    return {
      bg: entry.darkBg,
      text: entry.darkText,
      border: entry.border,
    };
  }

  return entry;
}

export function getAssetClassColor(assetClass: string, isDarkMode = false): PaletteColor {
  const normalizedKey = assetClass.toLowerCase().replace(/[^a-z]/g, '');
  const entry = ASSET_CLASS_PALETTE[normalizedKey] ?? ASSET_CLASS_PALETTE['other'] ?? {
    bg: '#64748b',
    text: '#ffffff',
  };

  if (isDarkMode && entry.darkBg && entry.darkText) {
    return {
      bg: entry.darkBg,
      text: entry.darkText,
      border: entry.border,
    };
  }

  return entry;
}

export function distributeBasisPoints(weights: number[], targetSumBps = 10000): number[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (totalWeight <= 0 || targetSumBps <= 0) return weights.map(() => 0);

  const quotas = weights.map(w => ((w > 0 ? w : 0) / totalWeight) * targetSumBps);
  const floors = quotas.map(q => Math.floor(q));
  const remainders = quotas.map((q, idx) => ({ index: idx, remainder: q - (floors[idx] ?? 0) }));

  let discrepancy = targetSumBps - floors.reduce((sum, f) => sum + f, 0);
  remainders.sort((a, b) => {
    const diff = b.remainder - a.remainder;
    return Math.abs(diff) > 1e-9 ? diff : a.index - b.index;
  });

  const result = [...floors];
  for (let i = 0; i < remainders.length && discrepancy > 0; i++) {
    const item = remainders[i];
    if (item) {
      result[item.index] = (result[item.index] ?? 0) + 1;
      discrepancy--;
    }
  }

  return result;
}

export function formatPercentagesWithParity(weights: number[]): string[] {
  const bps = distributeBasisPoints(weights, 10000);
  return bps.map(bp => `${(bp / 100).toFixed(2)}%`);
}

export function formatIndianRupee(value: number, options?: IndianRupeeFormatOptions): string {
  return coreFormatIndianRupee(value, options);
}
