import { SyncService } from '../services/sync.service';
import { prisma } from '../services/db.service';

describe('SyncService CAS Splitting', () => {
  const userId = 'sync-test-user-' + Date.now();

  afterAll(async () => {
    // Cleanup with proper dependency order
    const folios = await prisma.folio.findMany({
        where: { portfolio: { userId } }
    });
    for (const folio of folios) {
        await prisma.transaction.deleteMany({ where: { folioId: folio.id } });
    }
    await prisma.folio.deleteMany({ where: { portfolio: { userId } } });
    await prisma.portfolio.deleteMany({ where: { userId } });
    await prisma.managedProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('should split CAS into separate portfolios based on PAN', async () => {
    const mockCAS = {
      investor_info: { pan: 'OWNERPAN' },
      folios: [
        {
          folio: 'FOLIO1',
          amc: 'AMC1',
          schemes: [
            {
              scheme: 'Fund A',
              isin: 'ISIN1',
              pan: 'PAN1', // Different PAN
              close: 10,
              valuation: { nav: 100, cost: 900 },
              transactions: [
                { date: '2024-01-01', type: 'PURCHASE', units: 10, amount: 900, nav: 90, balance: 10 }
              ]
            }
          ]
        },
        {
          folio: 'FOLIO2',
          amc: 'AMC2',
          schemes: [
            {
              scheme: 'Fund B',
              isin: 'ISIN2',
              pan: 'PAN2', // Another PAN
              close: 20,
              valuation: { nav: 200, cost: 3500 },
              transactions: [
                { date: '2024-01-01', type: 'PURCHASE', units: 20, amount: 3500, nav: 175, balance: 20 }
              ]
            }
          ]
        }
      ]
    };

    const result = await SyncService.syncPortfolio(userId, mockCAS);
    expect(result.status).toBe('success');

    // Verify Managed Profiles
    const profiles = await prisma.managedProfile.findMany({ where: { userId } });
    expect(profiles.length).toBe(2);
    expect(profiles.some(p => p.pan === 'PAN1')).toBe(true);
    expect(profiles.some(p => p.pan === 'PAN2')).toBe(true);

    // Verify Portfolios
    const portfolios = await prisma.portfolio.findMany({ 
        where: { userId },
        include: { folios: true }
    });
    expect(portfolios.length).toBe(2);
    
    const p1 = portfolios.find(p => p.managedProfileId === profiles.find(mp => mp.pan === 'PAN1')!.id);
    const p2 = portfolios.find(p => p.managedProfileId === profiles.find(mp => mp.pan === 'PAN2')!.id);
    
    expect(p1!.folios.length).toBe(1);
    expect(p1!.folios[0].number).toBe('FOLIO1');
    
    expect(p2!.folios.length).toBe(1);
    expect(p2!.folios[0].number).toBe('FOLIO2');
  });
});
