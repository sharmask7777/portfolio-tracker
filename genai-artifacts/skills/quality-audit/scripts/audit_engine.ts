import { PrismaClient, AssetType } from '@prisma/client';
import { PerformanceService } from '../../../../backend/src/services/performance.service';
import { PortfolioUtils } from '../../../../backend/src/utils/portfolio.utils';

// We use the project's prisma instance
import { prisma } from '../../../../backend/src/services/db.service';

async function audit() {
  const folios = await prisma.folio.findMany({
    include: { 
      asset: true, 
      transactions: { orderBy: { date: 'asc' } } 
    }
  });

  const issues: string[] = [];

  for (const folio of folios) {
    const transactions = folio.transactions;
    if (transactions.length === 0) continue;

    const currentUnits = PortfolioUtils.getLatestUnits(transactions);
    const activeTxs = transactions.filter(tx => {
       const type = tx.type.toLowerCase();
       return !type.includes('tax') && !type.includes('duty') && !type.includes('charge') && !type.includes('stt');
    });
    
    const lastTx = activeTxs[activeTxs.length - 1];
    if (!lastTx) continue;

    if (folio.asset.name.includes('Test') || folio.asset.name.includes('TRACE')) continue;

    const currentPrice = lastTx.nav || 0;
    const metrics = PerformanceService.getMetrics(transactions, currentPrice, {
        currentUnitsOverride: currentUnits,
        taxSlab: 0.3,
        assetType: folio.asset.type as AssetType,
        assetName: folio.asset.name
    });

    // 1. Mathematical Anomalies
    if (metrics.xirr > 10) issues.push(`[CRITICAL] Astronomical XIRR: ${folio.asset.name} (${(metrics.xirr * 100).toFixed(2)}%)`);
    if (metrics.investedAmount === 0 && metrics.currentValue > 0 && !activeTxs.every(tx => tx.type === 'OPENING_BALANCE')) {
      issues.push(`[BLOCKER] Zero Cost Basis: ${folio.asset.name} has value but 0 invested.`);
    }
    if (Math.abs(currentUnits) < 0.001 && Math.abs(metrics.investedAmount) > 0.1) {
      issues.push(`[ERROR] Basis Erasure: ${folio.asset.name} has 0 units but ₹${metrics.investedAmount.toFixed(2)} remaining cost.`);
    }
    if (metrics.postTaxXirr !== undefined && metrics.postTaxXirr > metrics.xirr + 0.0001) {
      issues.push(`[INVARIANT] Tax Violation: Post-Tax XIRR > Pre-Tax XIRR for ${folio.asset.name}`);
    }
  }

  // 2. Structural Anomalies
  const portfolios = await prisma.portfolio.findMany({ include: { folios: { include: { asset: true } } } });
  for (const p of portfolios) {
    const keys = new Set();
    for (const f of p.folios) {
      const key = `${f.number}-${f.asset.name}`;
      if (keys.has(key)) issues.push(`[DUPLICATE] Folio collision: ${key}`);
      keys.add(key);
    }
  }

  if (issues.length === 0) {
    console.log("SUCCESS: Portfolio Audit Passed. Zero red flags found.");
    process.exit(0);
  } else {
    console.log(`FAILURE: Audit found ${issues.length} issues:`);
    issues.forEach(i => console.log(`- ${i}`));
    process.exit(1);
  }
}

audit().catch(err => {
  console.log(`ERROR: Audit failed to execute: ${err.message}`);
  process.exit(1);
});
