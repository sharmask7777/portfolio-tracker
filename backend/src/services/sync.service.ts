import { prisma } from './db.service';
import crypto from 'crypto';

export class SyncService {
  public static async syncPortfolio(userId: string, parsedData: any) {
    // 1. Ensure User and Portfolio exist
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // For now, auto-create a user if it doesn't exist (mocking auth)
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          password: 'mock-password',
        },
      });
    }

    let portfolio = await prisma.portfolio.findFirst({
      where: { userId },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: {
          name: 'Default Portfolio',
          userId,
        },
      });
    }

    const results = [];

    // 2. Loop through Folios and Transactions
    // casparser JSON structure: { folios: [ { folio: "...", amc: "...", schemes: [ { isin: "...", transactions: [...] } ] } ] }
    for (const folioData of parsedData.folios || []) {
      for (const scheme of folioData.schemes || []) {
        // Upsert Asset
        const asset = await prisma.asset.upsert({
          where: { isin: scheme.isin || scheme.amfi || scheme.name },
          update: {
            name: scheme.name,
            amfiCode: scheme.amfi,
          },
          create: {
            type: 'MUTUAL_FUND',
            name: scheme.name,
            isin: scheme.isin,
            amfiCode: scheme.amfi,
          },
        });

        // Upsert Folio
        const folio = await prisma.folio.upsert({
          where: {
            number_assetId_portfolioId: {
              number: folioData.folio,
              assetId: asset.id,
              portfolioId: portfolio.id,
            },
          },
          update: {
            amc: folioData.amc,
            pan: parsedData.investor_info?.pan,
          },
          create: {
            number: folioData.folio,
            amc: folioData.amc,
            pan: parsedData.investor_info?.pan,
            assetId: asset.id,
            portfolioId: portfolio.id,
          },
        });

        // Add Transactions
        for (const tx of scheme.transactions || []) {
          // Generate a deterministic hash for deduplication
          const txString = `${tx.date}-${tx.type}-${tx.amount}-${tx.units}-${tx.nav}-${tx.balance}`;
          const externalId = crypto.createHash('md5').update(txString).digest('hex');

          await prisma.transaction.upsert({
            where: { externalId },
            update: {}, // No update needed if it exists
            create: {
              date: new Date(tx.date),
              type: tx.type,
              amount: parseFloat(tx.amount),
              units: parseFloat(tx.units),
              nav: parseFloat(tx.nav),
              balance: parseFloat(tx.balance),
              folioId: folio.id,
              externalId,
            },
          });
        }
      }
    }

    return { status: 'success', portfolioId: portfolio.id };
  }
}
