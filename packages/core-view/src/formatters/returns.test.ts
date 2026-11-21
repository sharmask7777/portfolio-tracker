import { describe, it, expect } from 'vitest';
import { sanitizeReturnRate, formatPercent } from './returns';

describe('returns formatters', () => {
  describe('sanitizeReturnRate', () => {
    it('returns rate unchanged when within bounds', () => {
      expect(sanitizeReturnRate(0.15)).toBe(0.15);
      expect(sanitizeReturnRate(-0.5)).toBe(-0.5);
      expect(sanitizeReturnRate(5.0)).toBe(5.0);
    });

    it('clamps values below -1.0 (-100%)', () => {
      expect(sanitizeReturnRate(-1.5)).toBe(-1.0);
      expect(sanitizeReturnRate(-10.0)).toBe(-1.0);
    });

    it('clamps values above 10.0 (+1000%)', () => {
      expect(sanitizeReturnRate(15.0)).toBe(10.0);
      expect(sanitizeReturnRate(100.0)).toBe(10.0);
    });

    it('returns fallback on null, undefined, or NaN', () => {
      expect(sanitizeReturnRate(null, 0.2)).toBe(0.2);
      expect(sanitizeReturnRate(undefined, 0.1)).toBe(0.1);
      expect(sanitizeReturnRate(NaN, 0.05)).toBe(0.05);
      expect(sanitizeReturnRate(Infinity, 0)).toBe(0);
      expect(sanitizeReturnRate(null)).toBe(0);
    });
  });

  describe('formatPercent', () => {
    it('formats decimal rates into percentage strings', () => {
      expect(formatPercent(0.1543)).toBe('15.43%');
      expect(formatPercent(0.05)).toBe('5.00%');
      expect(formatPercent(-0.1234)).toBe('-12.34%');
    });

    it('supports custom decimals', () => {
      expect(formatPercent(0.1543, { decimals: 1 })).toBe('15.4%');
      expect(formatPercent(0.1543, { decimals: 0 })).toBe('15%');
    });

    it('supports showSign option for positive values', () => {
      expect(formatPercent(0.15, { showSign: true })).toBe('+15.00%');
      expect(formatPercent(-0.15, { showSign: true })).toBe('-15.00%');
      expect(formatPercent(0, { showSign: true })).toBe('0.00%');
    });

    it('handles null, undefined, or NaN with fallback', () => {
      expect(formatPercent(null)).toBe('N/A');
      expect(formatPercent(undefined)).toBe('N/A');
      expect(formatPercent(NaN)).toBe('N/A');
      expect(formatPercent(null, { fallback: '-' })).toBe('-');
    });
  });
});
