import { describe, it, expect } from 'vitest';
import { computeAY, classifySection } from './tax-formatters';
import { TaxSectionName } from './itr-report-types';

describe('tax-formatters', () => {
  describe('computeAY', () => {
    it('correctly maps FY to AY across boundary years', () => {
      expect(computeAY('2024-25')).toBe('2025-26');
      expect(computeAY('2023-24')).toBe('2024-25');
      expect(computeAY('2025-26')).toBe('2026-27');
    });
  });

  describe('classifySection', () => {
    it('returns explicit section if already set', () => {
      expect(classifySection({ section: '111A (15%)' })).toBe('111A (15%)');
    });

    it('classifies STCG pre and post budget', () => {
      expect(classifySection({ taxType: 'STCG', taxRate: 0.15 })).toBe(TaxSectionName.SEC_111A_15);
      expect(classifySection({ taxType: 'STCG', taxRate: 0.20 })).toBe(TaxSectionName.SEC_111A_20);
      expect(classifySection({ taxType: 'STCG', sellDate: '2024-08-01' })).toBe(TaxSectionName.SEC_111A_20);
    });

    it('classifies LTCG equity and debt', () => {
      expect(classifySection({ taxType: 'LTCG', taxRate: 0.10 })).toBe(TaxSectionName.SEC_112A_10);
      expect(classifySection({ taxType: 'LTCG', taxRate: 0.125 })).toBe(TaxSectionName.SEC_112A_12_5);
      expect(classifySection({ taxType: 'LTCG', assetClass: 'DEBT', taxRate: 0.125 })).toBe(TaxSectionName.SEC_112_DEBT_12_5);
      expect(classifySection({ taxType: 'LTCG', assetClass: 'DEBT', taxRate: 0.20, isGrandfathered: true })).toBe(TaxSectionName.SEC_112_DEBT_20);
    });

    it('classifies SLAB and 50AA', () => {
      expect(classifySection({ taxType: 'SLAB' })).toBe(TaxSectionName.SEC_50AA);
      expect(classifySection({})).toBe(TaxSectionName.SLAB);
    });
  });
});
