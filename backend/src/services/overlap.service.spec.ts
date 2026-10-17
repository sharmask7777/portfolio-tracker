import { OverlapService } from './overlap.service';
import { MarketDataService } from './market-data.service';
import { FamilyService } from './family.service';
import { AlternativeAssetService } from './alternative-assets.service';
import { prismaMock } from '@src/test/db.mock';

// Mock db.service per AGENTS.md instructions
jest.mock('./db.service', () => {
  const { prismaMock } = require('@src/test/db.mock');
  return {
    __esModule: true,
    prisma: prismaMock,
    cleanupDatabase: jest.fn(),
  };
});
jest.mock('@src/services/db.service', () => {
  const { prismaMock } = require('@src/test/db.mock');
  return {
    __esModule: true,
    prisma: prismaMock,
    cleanupDatabase: jest.fn(),
  };
});
jest.mock('./market-data.service');
jest.mock('./family.service');
jest.mock('./alternative-assets.service');

describe('OverlapService Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFundOverlap', () => {
    it('should calculate common holdings percentage and common stocks correctly', async () => {
      (MarketDataService.getHoldings as jest.Mock).mockImplementation((isin) => {
        if (isin === 'ISIN1') {
          return Promise.resolve({
            schemeName: 'Fund A',
            holdings: [
              { name: 'HDFC Bank Ltd.', weightage: '10' },
              { name: 'Infosys Ltd.', weightage: '20' },
            ],
          });
        }
        return Promise.resolve({
          schemeName: 'Fund B',
          holdings: [
            { name: 'HDFC Bank Limited', weightage: '5' }, // Normalized match!
            { name: 'Tata Motors Ltd.', weightage: '15' },
          ],
        });
      });

      const result = await OverlapService.getFundOverlap('ISIN1', 'ISIN2');
      expect(result?.overlapPercentage).toBe(5); // min(10, 5) = 5
      expect(result?.commonStocks.length).toBe(1);
      expect(result?.commonStocks[0].name).toBe('HDFC Bank Ltd.');
      expect(result?.commonStocks[0].weightA).toBe(10);
      expect(result?.commonStocks[0].weightB).toBe(5);
    });

    it('should return 0% overlap without throwing an error when one or both funds have no holdings', async () => {
      (MarketDataService.getHoldings as jest.Mock).mockImplementation((isin) => {
        if (isin === 'ISIN_DEBT') {
          return Promise.resolve({
            schemeName: 'Liquid Debt Fund',
            holdings: [],
          });
        }
        return Promise.resolve(null);
      });

      const result = await OverlapService.getFundOverlap('ISIN_DEBT', 'ISIN_UNKNOWN');
      expect(result.overlapPercentage).toBe(0);
      expect(result.commonStocks).toEqual([]);
      expect(result.fundA).toBe('Liquid Debt Fund');
      expect(result.fundB).toBe('ISIN_UNKNOWN');
    });
  });

  describe('getPortfolioExposures Scope Resolution & Security', () => {
    it('should fetch single portfolio exposures when user is the verified owner', async () => {
      prismaMock.familyMember.findFirst.mockResolvedValue(null);
      prismaMock.portfolio.findFirst.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'My Portfolio',
        createdAt: new Date(),
        updatedAt: new Date(),
        managedProfileId: null,
        folios: [
          {
            id: 'f1',
            portfolioId: 'p1',
            assetId: 'a1',
            createdAt: new Date(),
            updatedAt: new Date(),
            asset: {
              id: 'a1',
              isin: 'INF123',
              amfiCode: '101',
              name: 'HDFC Flexi Cap Fund',
              type: 'MUTUAL_FUND',
              symbol: null,
              exitLoadMetadata: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            transactions: [{ id: 't1', folioId: 'f1', type: 'PURCHASE', units: 100, balance: 100, nav: 10, amount: 1000, date: new Date(), createdAt: new Date(), updatedAt: new Date() }],
          },
        ],
      } as any);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(10);
      (MarketDataService.getHoldings as jest.Mock).mockResolvedValue({
        schemeName: 'HDFC Flexi Cap Fund',
        holdings: [
          { name: 'HDFC Bank Ltd.', weightage: '50', sector: 'Financial Services' },
        ],
      });

      const exposures = await OverlapService.getPortfolioExposures('p1', 'u1');
      expect(prismaMock.portfolio.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1', userId: 'u1' } })
      );
      expect(exposures.length).toBe(1);
      expect(exposures[0].name).toBe('HDFC Bank Ltd.');
      expect(exposures[0].sector).toBe('Financial Services');
      expect(exposures[0].absoluteValue).toBe(500); // 100 units * 10 nav * 50% = 500
      expect(exposures[0].percentage).toBe(0.5);
    });

    it('should prevent unauthorized IDOR access to foreign portfolio and return []', async () => {
      // User 'attacker' tries to access 'p_victim'
      prismaMock.familyMember.findFirst.mockResolvedValue(null);
      prismaMock.portfolio.findFirst.mockResolvedValue(null); // Not found for attacker
      prismaMock.portfolio.findMany.mockResolvedValue([]); // No managed profiles

      const exposures = await OverlapService.getPortfolioExposures('p_victim', 'attacker');
      expect(exposures).toEqual([]);
    });

    it('should resolve family group scope when user is an authorized member', async () => {
      prismaMock.familyMember.findFirst.mockResolvedValue({
        id: 'fm1',
        groupId: 'fam_1',
        userId: 'u1',
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (FamilyService.getFamilyPortfolios as jest.Mock).mockResolvedValue([
        {
          id: 'p_member',
          userId: 'u2',
          folios: [
            {
              id: 'f2',
              portfolioId: 'p_member',
              assetId: 'a2',
              asset: {
                id: 'a2',
                isin: 'INF999',
                amfiCode: '202',
                name: 'Parag Parikh Flexi Cap Fund',
                type: 'MUTUAL_FUND',
              },
              transactions: [{ type: 'PURCHASE', units: 50, balance: 50, nav: 20, amount: 1000, date: new Date() }],
            },
          ],
        },
      ]);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(20);
      (MarketDataService.getHoldings as jest.Mock).mockResolvedValue({
        schemeName: 'Parag Parikh Flexi Cap Fund',
        holdings: [
          { name: 'ITC Ltd.', weightage: '40', sector: 'Consumer Defensive' },
        ],
      });

      const exposures = await OverlapService.getPortfolioExposures('fam_1', 'u1');
      expect(FamilyService.getFamilyPortfolios).toHaveBeenCalledWith('fam_1');
      expect(exposures.length).toBe(1);
      expect(exposures[0].name).toBe('ITC Ltd.');
      expect(exposures[0].absoluteValue).toBe(400); // 50 * 20 * 40% = 400
      expect(exposures[0].percentage).toBe(0.4);
    });

    it('should reject unauthorized family group IDOR attempt and return []', async () => {
      prismaMock.familyMember.findFirst.mockResolvedValue(null); // User is NOT a member
      prismaMock.portfolio.findFirst.mockResolvedValue(null);
      prismaMock.portfolio.findMany.mockResolvedValue([]);

      const exposures = await OverlapService.getPortfolioExposures('foreign_fam_group', 'unauthorized_user');
      expect(FamilyService.getFamilyPortfolios).not.toHaveBeenCalled();
      expect(exposures).toEqual([]);
    });

    it('should resolve consolidated scope across all portfolios owned by user', async () => {
      prismaMock.portfolio.findMany.mockResolvedValue([
        {
          id: 'p_all_1',
          userId: 'u1',
          folios: [
            {
              id: 'f_all_1',
              asset: {
                id: 'a_all_1',
                isin: 'INF111',
                amfiCode: '301',
                name: 'Large Cap Fund',
                type: 'MUTUAL_FUND',
              },
              transactions: [{ type: 'PURCHASE', units: 10, balance: 10, nav: 100, amount: 1000, date: new Date() }],
            },
          ],
        },
      ] as any);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(100);
      (MarketDataService.getHoldings as jest.Mock).mockResolvedValue({
        schemeName: 'Large Cap Fund',
        holdings: [
          { name: 'Reliance Industries Ltd.', weightage: '10', sector: 'Energy' },
        ],
      });

      const exposures = await OverlapService.getPortfolioExposures('consolidated', 'u1');
      expect(prismaMock.portfolio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } })
      );
      expect(exposures.length).toBe(1);
      expect(exposures[0].name).toBe('Reliance Industries Ltd.');
    });
  });

  describe('Deduplication & Cross-Fund Merging', () => {
    it('should merge stock exposures across funds and direct stock with name normalization', async () => {
      prismaMock.familyMember.findFirst.mockResolvedValue(null);
      prismaMock.portfolio.findFirst.mockResolvedValue({
        id: 'p_multi',
        userId: 'u1',
        folios: [
          {
            id: 'f_mf1',
            asset: { isin: 'INF_A', amfiCode: '1', name: 'Fund A', type: 'MUTUAL_FUND' },
            transactions: [{ type: 'PURCHASE', units: 100, balance: 100, nav: 10, amount: 1000, date: new Date() }],
          },
          {
            id: 'f_mf2',
            asset: { isin: 'INF_B', amfiCode: '2', name: 'Fund B', type: 'MUTUAL_FUND' },
            transactions: [{ type: 'PURCHASE', units: 100, balance: 100, nav: 10, amount: 1000, date: new Date() }],
          },
          {
            id: 'f_direct',
            asset: { isin: null, symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'STOCK' },
            transactions: [{ type: 'PURCHASE', units: 10, balance: 10, nav: 100, amount: 1000, date: new Date() }],
          },
        ],
      } as any);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(10);
      (MarketDataService.getHoldings as jest.Mock).mockImplementation((isin) => {
        if (isin === 'INF_A') {
          return Promise.resolve({
            schemeName: 'Fund A',
            holdings: [
              { name: 'HDFC Bank Ltd.', weightage: '10', sector: 'Financial Services' }, // 1000 * 10% = 100
            ],
          });
        }
        if (isin === 'INF_B') {
          return Promise.resolve({
            schemeName: 'Fund B',
            holdings: [
              { name: 'HDFC Bank Limited', weightage: '20', sector: 'Financial Services' }, // 1000 * 20% = 200
            ],
          });
        }
        return Promise.resolve(null);
      });

      // Total portfolio value = 1000 (Fund A) + 1000 (Fund B) + 1000 (Direct Stock) = 3000
      // Total HDFC Bank value = 100 + 200 + 1000 = 1300
      // Total HDFC Bank percentage = 1300 / 3000 = 43.33%
      const exposures = await OverlapService.getPortfolioExposures('p_multi', 'u1');

      expect(exposures.length).toBe(1); // Merged into single entry!
      expect(exposures[0].name).toBe('HDFC Bank Ltd.');
      expect(exposures[0].sector).toBe('Financial Services');
      expect(exposures[0].absoluteValue).toBe(1300);
      expect(exposures[0].percentage).toBeCloseTo(1300 / 3000, 4);
      expect(exposures[0].contributions.length).toBe(3);
    });

    it('should accurately incorporate Alternative Assets in the total portfolio denominator', async () => {
      prismaMock.familyMember.findFirst.mockResolvedValue(null);
      prismaMock.portfolio.findFirst.mockResolvedValue({
        id: 'p_alt',
        userId: 'u1',
        folios: [
          {
            id: 'f_mf',
            asset: { isin: 'INF_A', amfiCode: '1', name: 'Fund A', type: 'MUTUAL_FUND' },
            transactions: [{ type: 'PURCHASE', units: 100, balance: 100, nav: 10, amount: 1000, date: new Date() }],
          },
          {
            id: 'f_ppf',
            asset: { isin: null, name: 'Public Provident Fund', type: 'PPF' },
            transactions: [{ type: 'DEPOSIT', units: 9000, balance: 9000, nav: 1, amount: 9000, date: new Date() }],
          },
        ],
      } as any);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(10);
      (AlternativeAssetService.calculateValue as jest.Mock).mockResolvedValue({
        currentValue: 9000,
        accruedInterest: 0,
        annualRate: 0.071,
      });

      (MarketDataService.getHoldings as jest.Mock).mockResolvedValue({
        schemeName: 'Fund A',
        holdings: [
          { name: 'Infosys Ltd.', weightage: '50', sector: 'Technology' }, // 1000 * 50% = 500
        ],
      });

      // Total portfolio value = 1000 (MF) + 9000 (PPF) = 10000
      // Infosys absolute = 500
      // Infosys percentage = 500 / 10000 = 5% (0.05)
      const exposures = await OverlapService.getPortfolioExposures('p_alt', 'u1');

      expect(exposures.length).toBe(1);
      expect(exposures[0].name).toBe('Infosys Ltd.');
      expect(exposures[0].absoluteValue).toBe(500);
      expect(exposures[0].percentage).toBe(0.05);
    });

    it('should return [] safely without NaN or crash when portfolio has 0 total value', async () => {
      prismaMock.familyMember.findFirst.mockResolvedValue(null);
      prismaMock.portfolio.findFirst.mockResolvedValue({
        id: 'p_zero',
        userId: 'u1',
        folios: [
          {
            id: 'f_closed',
            asset: { isin: 'INF_A', amfiCode: '1', name: 'Fund A', type: 'MUTUAL_FUND' },
            transactions: [
              { type: 'PURCHASE', units: 100, balance: 100, nav: 10, amount: 1000, date: new Date() },
              { type: 'REDEMPTION', units: -100, balance: 0, nav: 12, amount: -1200, date: new Date() },
            ],
          },
        ],
      } as any);

      const exposures = await OverlapService.getPortfolioExposures('p_zero', 'u1');
      expect(exposures).toEqual([]);
    });
  });
});
