import { HarvestingService } from '../services/harvesting.service';
import { prisma, cleanupDatabase } from '../services/db.service';
import { AssetType } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { MarketDataService } from '../services/market-data.service';

jest.mock('../services/market-data.service', () => ({
  MarketDataService: {
    getLatestNAV: jest.fn().mockResolvedValue(150), // Always return 150 (gain of 50)
  }
}));

describe('HarvestingService Isolation', () => {
  let userId: string;
  let member1Id: string;
  let member2Id: string;
  let portfolio1Id: string;
  let portfolio2Id: string;

  beforeAll(async () => {
    // Create User
    const user = await prisma.user.create({
      data: {
        email: `harvest-test-${Date.now()}@example.com`,
        password: 'password',
      },
    });
    userId = user.id;

    // Create Member 1
    const m1 = await prisma.managedProfile.create({
      data: { userId, name: 'Member 1', pan: 'M1PAN1234F' },
    });
    member1Id = m1.id;

    // Create Member 2
    const m2 = await prisma.managedProfile.create({
      data: { userId, name: 'Member 2', pan: 'M2PAN1234F' },
    });
    member2Id = m2.id;

    // Create Asset for Member 1
    const amfi1 = `TEST_${Date.now()}_1`;
    const asset1 = await prisma.asset.create({
      data: { type: AssetType.MUTUAL_FUND, name: 'Member 1 Fund', amfiCode: amfi1 },
    });

    // Create Asset for Member 2 (Axis Fund)
    const amfi2 = `TEST_${Date.now()}_2`;
    const asset2 = await prisma.asset.create({
      data: { type: AssetType.MUTUAL_FUND, name: 'Axis Large Cap Fund', amfiCode: amfi2 },
    });

    // Create Portfolio 1 for Member 1
    const p1 = await prisma.portfolio.create({
      data: { userId, managedProfileId: member1Id, name: 'P1' },
    });
    portfolio1Id = p1.id;

    // Add holdings to Portfolio 1 (Member 1 Fund)
    const f1 = await prisma.folio.create({
      data: { number: 'F1', portfolioId: portfolio1Id, assetId: asset1.id },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        type: 'BUY',
        amount: 5000,
        units: 100,
        nav: 50, // Low buy price = Guaranteed gain
        balance: 100,
        folioId: f1.id
      }
    });

    // Add a CLOSED folio to Portfolio 1 (Axis Legacy Fund)
    const amfiLegacy = `TEST_LEGACY_${Date.now()}`;
    const assetLegacy = await prisma.asset.create({
      data: { type: AssetType.MUTUAL_FUND, name: 'Axis Legacy Fund', amfiCode: amfiLegacy },
    });
    const fLegacy = await prisma.folio.create({
      data: { number: 'F_LEGACY', portfolioId: portfolio1Id, assetId: assetLegacy.id },
    });
    // Buy
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000),
        type: 'BUY',
        amount: 5000,
        units: 100,
        nav: 50,
        balance: 100,
        folioId: fLegacy.id
      }
    });
    // Sell All
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        type: 'SELL',
        amount: 15000,
        units: 100,
        nav: 150,
        balance: 0,
        folioId: fLegacy.id
      }
    });

    // Add a BROKEN folio (Mismatch between balance and lots - e.g. unrecognized redemption type)
    const amfiBroken = `TEST_BROKEN_${Date.now()}`;
    const assetBroken = await prisma.asset.create({
      data: { type: AssetType.MUTUAL_FUND, name: 'Axis Broken Fund', amfiCode: amfiBroken },
    });
    const fBroken = await prisma.folio.create({
      data: { number: 'F_BROKEN', portfolioId: portfolio1Id, assetId: assetBroken.id },
    });
    // Buy
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000),
        type: 'BUY',
        amount: 5000,
        units: 100,
        nav: 50,
        balance: 100,
        folioId: fBroken.id
      }
    });
    // Transfer Out (Updates balance to 0, but might not be matched by FIFO logic if type unknown)
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        type: 'UNKNOWN_REDEEM_TYPE', 
        amount: 0,
        units: 100,
        nav: 0,
        balance: 0,
        folioId: fBroken.id
      }
    });

    // Create Portfolio 2 for Member 2
    const p2 = await prisma.portfolio.create({
      data: { userId, managedProfileId: member2Id, name: 'P2' },
    });
    portfolio2Id = p2.id;

    // Add holdings to Portfolio 2 (Axis Fund)
    const f2 = await prisma.folio.create({
      data: { number: 'F2', portfolioId: portfolio2Id, assetId: asset2.id },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        type: 'BUY',
        amount: 5000,
        units: 100,
        nav: 50,
        balance: 100,
        folioId: f2.id
      }
    });

    // Create Portfolio 3 (Primary - managedProfileId: null)
    const p3 = await prisma.portfolio.create({
      data: { userId, managedProfileId: null, name: 'Primary P' },
    });
    const amfi3 = `TEST_${Date.now()}_3`;
    const asset3 = await prisma.asset.create({
      data: { type: AssetType.MUTUAL_FUND, name: 'Primary Fund', amfiCode: amfi3 },
    });
    const f3 = await prisma.folio.create({
      data: { number: 'F3', portfolioId: p3.id, assetId: asset3.id },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        type: 'BUY',
        amount: 5000,
        units: 100,
        nav: 50,
        balance: 100,
        folioId: f3.id
      }
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { folio: { portfolio: { userId } } } });
    await prisma.folio.deleteMany({ where: { portfolio: { userId } } });
    await prisma.portfolio.deleteMany({ where: { userId } });
    await prisma.managedProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await CacheService.disconnect();
    await cleanupDatabase();
  });

  it('should only recommend harvesting for assets owned by the selected member', async () => {
    const result = await HarvestingService.getHarvestingOpportunities(member1Id, userId);
    
    expect(result.opportunities).toBeDefined();
    // Should NOT include Axis (Member 2), Primary Fund, Axis Legacy (Closed), or Axis Broken
    const names = result.opportunities.map(o => o.schemeName);
    expect(names).toContain('Member 1 Fund');
    expect(names).not.toContain('Axis Large Cap Fund');
    expect(names).not.toContain('Primary Fund');
    expect(names).not.toContain('Axis Legacy Fund');
    expect(names).not.toContain('Axis Broken Fund');
  });

  it('should only recommend primary funds when primary portfolio is selected', async () => {
    // If scopeId is the primary portfolio ID
    const result = await HarvestingService.getHarvestingOpportunities(portfolio1Id, userId);
    const names = result.opportunities.map(o => o.schemeName);
    expect(names).toContain('Member 1 Fund');
    expect(names).not.toContain('Axis Large Cap Fund');
  });

  it('should recommend all funds when consolidated is selected', async () => {
    const result = await HarvestingService.getHarvestingOpportunities('consolidated', userId);
    const names = result.opportunities.map(o => o.schemeName);
    expect(names).toContain('Member 1 Fund');
    expect(names).toContain('Axis Large Cap Fund');
    expect(names).toContain('Primary Fund');
  });
});
