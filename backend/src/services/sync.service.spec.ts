import { SyncService } from './sync.service';
import { prisma } from './db.service';
import { MockCASGenerator } from '../../test-utils/MockCASGenerator';

describe('SyncService Ingestion Logic', () => {
  const userId = 'test-user-cas-sync';

  const cleanup = async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const portfolios = await prisma.portfolio.findMany({ where: { userId } });
      for (const p of portfolios) {
        const folios = await prisma.folio.findMany({ where: { portfolioId: p.id } });
        for (const f of folios) {
          await prisma.transaction.deleteMany({ where: { folioId: f.id } });
        }
        await prisma.folio.deleteMany({ where: { portfolioId: p.id } });
        await prisma.goal.deleteMany({ where: { portfolioId: p.id } });
      }
      await prisma.portfolio.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  };

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('should correctly sync a complex mock CAS statement', async () => {
    const mockData = MockCASGenerator.generate({
      numFolios: 2,
      numSchemesPerFolio: 2,
      numTransactionsPerScheme: 5,
    });

    const result = await SyncService.syncPortfolio(userId, mockData);
    expect(result.status).toBe('success');
    expect(result.portfolioId).toBeDefined();

    // Verify data in DB
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId },
      include: {
        folios: {
          include: {
            asset: true,
            transactions: true,
          },
        },
      },
    });

    expect(portfolio).toBeDefined();
    expect(portfolio?.folios.length).toBe(4); // 2 folios * 2 schemes each
    
    const totalTxs = portfolio?.folios.reduce((acc, f) => acc + f.transactions.length, 0);
    expect(totalTxs).toBe(20); // 4 schemes * 5 txs each
  });

  it('should handle duplicate imports gracefully (idempotency)', async () => {
    const mockData = MockCASGenerator.generate({
      numFolios: 1,
      numSchemesPerFolio: 1,
      numTransactionsPerScheme: 3,
    });

    // First import
    await SyncService.syncPortfolio(userId, mockData);
    
    // Second import (same data)
    const result = await SyncService.syncPortfolio(userId, mockData);
    expect(result.status).toBe('success');

    const portfolio = await prisma.portfolio.findFirst({
      where: { userId },
      include: {
        folios: {
          include: { transactions: true },
        },
      },
    });

    // Should not have double transactions
    const totalTxs = portfolio?.folios.reduce((acc, f) => acc + f.transactions.length, 0);
    // 20 from previous test + 3 from this test = 23
    // Wait, the beforeAll cleaned up. So it should be exactly 3.
    // Actually, I should probably check for a specific folio.
    const latestFolio = portfolio?.folios.find(f => f.number === mockData.folios[0].folio);
    expect(latestFolio?.transactions.length).toBe(3);
  });
});
