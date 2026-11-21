import { describe, it, expect } from 'vitest';
import {
  formatIndianRupee,
  formatCompactInr,
  parseCurrency,
} from './currency';

describe('currency formatters', () => {
  describe('formatIndianRupee', () => {
    it('formats values in Crores with default settings', () => {
      expect(formatIndianRupee(15000000)).toBe('₹1.50 Cr');
      expect(formatIndianRupee(23456789)).toBe('₹2.35 Cr');
      expect(formatIndianRupee(10000000)).toBe('₹1.00 Cr');
    });

    it('formats values in Lakhs with default settings', () => {
      expect(formatIndianRupee(450000)).toBe('₹4.50 L');
      expect(formatIndianRupee(100000)).toBe('₹1.00 L');
      expect(formatIndianRupee(999000)).toBe('₹9.99 L');
    });

    it('formats values under 1 Lakh in standard Indian notation', () => {
      expect(formatIndianRupee(45000)).toBe('₹45,000');
      expect(formatIndianRupee(1234)).toBe('₹1,234');
      expect(formatIndianRupee(500)).toBe('₹500');
      expect(formatIndianRupee(0)).toBe('₹0');
    });

    it('handles negative values correctly', () => {
      expect(formatIndianRupee(-15000000)).toBe('-₹1.50 Cr');
      expect(formatIndianRupee(-45000)).toBe('-₹45,000');
    });

    it('respects includeSymbol: false', () => {
      expect(formatIndianRupee(15000000, { includeSymbol: false })).toBe('1.50 Cr');
      expect(formatIndianRupee(45000, { includeSymbol: false })).toBe('45,000');
    });

    it('respects compact: false', () => {
      expect(formatIndianRupee(15000000, { compact: false })).toBe('₹1,50,00,000');
    });

    it('respects custom decimal places', () => {
      expect(formatIndianRupee(450000, { decimals: 1 })).toBe('₹4.5 L');
    });

    it('handles non-finite values safely', () => {
      expect(formatIndianRupee(NaN)).toBe('₹0');
      expect(formatIndianRupee(Infinity)).toBe('₹0');
      expect(formatIndianRupee(NaN, { includeSymbol: false })).toBe('0');
    });
  });

  describe('formatCompactInr', () => {
    it('produces compact INR strings directly', () => {
      expect(formatCompactInr(12000000)).toBe('₹1.20 Cr');
      expect(formatCompactInr(550000, 1)).toBe('₹5.5 L');
      expect(formatCompactInr(3500)).toBe('₹3,500');
    });
  });

  describe('parseCurrency', () => {
    it('parses numbers directly', () => {
      expect(parseCurrency(12345)).toBe(12345);
      expect(parseCurrency(0)).toBe(0);
      expect(parseCurrency(NaN)).toBe(0);
    });

    it('parses formatted currency strings', () => {
      expect(parseCurrency('₹1,50,000')).toBe(150000);
      expect(parseCurrency('₹ 45,000.50')).toBe(45000.5);
      expect(parseCurrency('1,234')).toBe(1234);
    });

    it('handles null, undefined, or empty strings', () => {
      expect(parseCurrency(null)).toBe(0);
      expect(parseCurrency(undefined)).toBe(0);
      expect(parseCurrency('')).toBe(0);
      expect(parseCurrency('invalid')).toBe(0);
    });
  });
});
