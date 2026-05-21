import { TaxAnalyzerService } from '../services/tax-analyzer.service';
import { TaxService } from '../services/tax.service';
import { AssetType } from '@prisma/client';
import { prisma } from '../services/db.service';

describe('Tax Simulation & Grandfathering Logic', () => {
  const mockUserId = 'tax-user-' + Date.now();
  let folioId: string;

  beforeAll(async () => {
    // 1. Create User
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: `${mockUserId}@example.com`,
        password: 'password'
      }
    });

    // 2. Create Profile
    const profile = await prisma.managedProfile.create({
      data: {
        userId: mockUserId,
        pan: 'TESTPAN123',
        name: 'Test User'
      }
    });

    // 3. Create Portfolio
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: mockUserId,
        managedProfileId: profile.id,
        name: 'Test Portfolio'
      }
    });

    // 4. Create Asset
    const asset = await prisma.asset.create({
      data: {
        type: AssetType.MUTUAL_FUND,
        name: 'Older Debt Fund',
        isin: 'DEBT_ISIN_' + Date.now()
      }
    });

    // 5. Create Folio
    const folio = await prisma.folio.create({
      data: {
        number: 'FOLIO_DEBT_' + Date.now(),
        portfolioId: portfolio.id,
        assetId: asset.id
      }
    });

    folioId = folio.id;

    // 6. Add Purchase Transaction (Bought at 50)
    await prisma.transaction.create({
      data: {
        date: new Date('2022-01-01'),
        type: 'PURCHASE',
        amount: 50000,
        units: 1000,
        nav: 50,
        balance: 1000,
        folioId: folio.id,
        externalId: 'tx_debt_old_' + Date.now()
      }
    });

    // 7. Add a newer dummy transaction to set the current NAV to 100
    await prisma.transaction.create({
      data: {
        date: new Date('2026-05-15'),
        type: 'BALANCE_STMT',
        amount: 0,
        units: 0,
        nav: 100,
        balance: 1000,
        folioId: folio.id,
        externalId: 'tx_nav_marker_' + Date.now()
      }
    });
  });

  describe('TaxService Grandfathering', () => {
    it('should identify debt bought before April 2023 as grandfathered', () => {
      const lot = {
        date: new Date('2022-01-01'),
        units: 1000,
        nav: 100,
        originalUnits: 1000
      };
      
      const gain = TaxService.calculateGain(
        'Older Debt Fund',
        AssetType.MUTUAL_FUND,
        lot,
        1000,
        150,
        new Date('2025-05-18')
      );

      expect(gain.isGrandfathered).toBe(true);
      expect(gain.taxType).toBe('LTCG');
    });

    it('should identify debt bought after April 2023 as SLAB (not grandfathered)', () => {
      const lot = {
        date: new Date('2023-05-01'),
        units: 1000,
        nav: 100,
        originalUnits: 1000
      };
      
      const gain = TaxService.calculateGain(
        'Newer Debt Fund',
        AssetType.MUTUAL_FUND,
        lot,
        1000,
        150,
        new Date('2025-05-18')
      );

      expect(gain.isGrandfathered).toBe(false);
      expect(gain.taxType).toBe('SLAB');
    });
  });

  describe('TaxAnalyzerService Simulation', () => {
    it('should successfully simulate a sell with tax slab', async () => {
      const result = await TaxAnalyzerService.simulateSell(folioId, 500, 0.30);
      
      console.log('Simulation Result:', JSON.stringify(result, null, 2));
      
      expect(result).toBeDefined();
      expect(result.unitsToSell).toBe(500);
      expect(result.taxBreakdown.totalTax).toBeGreaterThan(0);
    });

    it('should fail simulation if units are insufficient', async () => {
      await expect(TaxAnalyzerService.simulateSell(folioId, 2000, 0.30))
        .rejects.toThrow('Insufficient sellable units');
    });

    it('should correctly identify ELSS lock-in units', async () => {
       // Create an ELSS asset
       const elssAsset = await prisma.asset.create({
         data: {
           type: AssetType.MUTUAL_FUND,
           name: 'Axis ELSS Tax Saver Fund',
           isin: 'ELSS_ISIN_' + Date.now()
         }
       });

       const elssFolio = await prisma.folio.create({
         data: {
           number: 'FOLIO_ELSS_' + Date.now(),
           portfolioId: (await prisma.portfolio.findFirst({ where: { userId: mockUserId } }))!.id,
           assetId: elssAsset.id
         }
       });

       // Add a recent transaction (locked)
       await prisma.transaction.create({
         data: {
           date: new Date(),
           type: 'PURCHASE',
           amount: 10000,
           units: 100,
           nav: 100,
           balance: 100,
           folioId: elssFolio.id,
           externalId: 'tx_elss_locked_' + Date.now()
         }
       });

       // Simulation should fail even though total units = 100, because they are locked
       await expect(TaxAnalyzerService.simulateSell(elssFolio.id, 50, 0.30))
         .rejects.toThrow('units are locked (ELSS 3yr)');
    });
  });

  describe('Exit Load Metadata Parsing', () => {
    it('should parse exit load from metadata (Parag Parikh style)', () => {
      const metadata = "2.00% if redeemed within 365 days. 1.00% if redeemed between 365 and 730 days. Nil after 730 days.";
      const buyDate = new Date();
      const sellDate = new Date();
      
      // Test 1: Within 365 days
      buyDate.setTime(sellDate.getTime() - 100 * 24 * 60 * 60 * 1000);
      let load = TaxService.getExitLoad('Any Fund', AssetType.MUTUAL_FUND, buyDate, sellDate, 10000, metadata);
      expect(load).toBe(200); // 2%

      // Test 2: Between 365 and 730 days
      buyDate.setTime(sellDate.getTime() - 400 * 24 * 60 * 60 * 1000);
      load = TaxService.getExitLoad('Any Fund', AssetType.MUTUAL_FUND, buyDate, sellDate, 10000, metadata);
      expect(load).toBe(100); // 1%

      // Test 3: After 730 days
      buyDate.setTime(sellDate.getTime() - 800 * 24 * 60 * 60 * 1000);
      load = TaxService.getExitLoad('Any Fund', AssetType.MUTUAL_FUND, buyDate, sellDate, 10000, metadata);
      expect(load).toBe(0); // Nil
    });

    it('should fallback to heuristics if metadata parsing fails', () => {
      const metadata = "Random text with no clear numbers";
      const buyDate = new Date();
      const sellDate = new Date();
      buyDate.setTime(sellDate.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Should use Arbitrage heuristic (0.25% < 30 days)
      const load = TaxService.getExitLoad('Kotak Arbitrage Fund', AssetType.MUTUAL_FUND, buyDate, sellDate, 10000, metadata);
      expect(load).toBe(25); // 0.25%
    });
  });
});
