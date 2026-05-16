import { prisma } from '../src/services/db.service';
import { PerformanceService } from '../src/services/performance.service';
import { PortfolioUtils } from '../src/utils/portfolio.utils';

async function evaluate() {
  const folios = await prisma.folio.findMany({
    include: { asset: true, transactions: { orderBy: { date: 'asc' } } }
  });

  let redFlags = 0;

  for (const folio of folios) {
    const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
    
    // Filter out auxiliary txs to get the true last tx for logic checks
    const activeTxs = folio.transactions.filter(tx => {
       const type = tx.type.toLowerCase();
       return !type.includes('tax') && !type.includes('duty') && !type.includes('charge') && !type.includes('stt');
    });
    
    const lastTx = activeTxs[activeTxs.length - 1];
    
    // Skip empty folios with no transactions
    if (!lastTx) continue;

    // Skip testing/mock folios to avoid false positives in 'Invested == 0' checks
    if (folio.asset.name === 'TRACE_SCHEME' || folio.asset.name === 'LOG_SCHEME' || folio.asset.name === 'Test Fund') continue;

    const metrics = PerformanceService.getMetrics(folio.transactions, lastTx.nav || 100, currentUnits);

    if (metrics.xirr > 1) {
      console.log(`[WARNING] XIRR > 100% for folio ${folio.id} (${folio.asset.name})`);
    }

    // If only OPENING_BALANCE and no amount was available from CAS, it's not an anomaly.
    const isOnlyZeroCostOpening = activeTxs.every(tx => tx.type === 'OPENING_BALANCE' && tx.amount === 0);
    if (metrics.investedAmount === 0 && metrics.currentValue > 0 && !isOnlyZeroCostOpening) {
      console.log(`[RED FLAG] Invested == 0 AND Current Value > 0 for folio ${folio.id} (${folio.asset.name})`);
      redFlags++;
    }

    // Since we fixed closed positions to have investedAmount = 0
    if (metrics.investedAmount !== 0 && currentUnits === 0) {
      console.log(`[RED FLAG] Invested != 0 AND Current Units == 0 for folio ${folio.id} (${folio.asset.name})`);
      redFlags++;
    }

    if (metrics.currentValue < 0) {
      console.log(`[RED FLAG] Net Worth < 0 for folio ${folio.id} (${folio.asset.name})`);
      redFlags++;
    }
  }

  // Duplicate Folios check (per portfolio)
  const portfolios = await prisma.portfolio.findMany({ include: { folios: { include: { asset: true } } } });
  for (const portfolio of portfolios) {
    const schemeCounts = new Map<string, number>();
    for (const folio of portfolio.folios) {
      const key = `${folio.number}-${folio.asset.name}`;
      schemeCounts.set(key, (schemeCounts.get(key) || 0) + 1);
    }
    for (const [key, count] of schemeCounts.entries()) {
      if (count > 1) {
        console.log(`[RED FLAG] Duplicate Folios for scheme ${key} in portfolio ${portfolio.id}`);
        redFlags++;
      }
    }
  }

  console.log(`Evaluation complete. Found ${redFlags} red flags.`);
  if (redFlags > 0) {
    process.exit(1);
  }
}

evaluate().catch(console.error);