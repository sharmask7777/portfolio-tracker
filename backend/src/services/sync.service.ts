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
    const investor = parsedData.investor_info || parsedData.investor || {};

    // 2. Loop through Folios and Transactions
    // casparser JSON structure: { folios: [ { folio: "...", amc: "...", schemes: [ { isin: "...", transactions: [...] } ] } ] }
    for (const folioData of parsedData.folios || []) {
      for (const schemeData of folioData.schemes || []) {
        const fundName = schemeData.scheme || schemeData.name;
        // Upsert Asset
        const asset = await prisma.asset.upsert({
          where: { isin: schemeData.isin || schemeData.amfi || fundName },
          update: {
            name: fundName,
            amfiCode: schemeData.amfi,
          },
          create: {
            type: 'MUTUAL_FUND',
            name: fundName,
            isin: schemeData.isin,
            amfiCode: schemeData.amfi,
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
            pan: investor.pan,
          },
          create: {
            number: folioData.folio,
            amc: folioData.amc,
            pan: investor.pan,
            assetId: asset.id,
            portfolioId: portfolio.id,
          },
        });

        // Add Transactions
        const transactions = schemeData.transactions || [];
        
        // Handle Summary CAS: If no transactions but there is a balance/valuation, create a synthetic transaction
        if (transactions.length === 0 && (schemeData.close > 0 || schemeData.valuation?.value > 0)) {
          const balanceDate = schemeData.valuation?.date ? new Date(schemeData.valuation.date) : new Date();
          transactions.push({
            date: balanceDate.toISOString().split('T')[0],
            type: 'BALANCE_STMT',
            description: 'Summary Balance',
            amount: schemeData.valuation?.cost || (schemeData.close * (schemeData.valuation?.nav || 0)),
            units: schemeData.close,
            nav: schemeData.valuation?.nav || 0,
            balance: schemeData.close,
          });
        }

        for (const tx of transactions) {
          // Generate a deterministic hash for deduplication
          // Include folio and asset identifiers to make it more unique
          const txString = `${folioData.folio}-${schemeData.isin}-${tx.date}-${tx.type}-${tx.amount}-${tx.units}-${tx.nav}-${tx.balance}`;
          const externalId = crypto.createHash('md5').update(txString).digest('hex');

          await prisma.transaction.upsert({
            where: { externalId },
            update: {
               // Update balance/nav even if tx exists, in case of summary refreshes
               nav: parseFloat(tx.nav) || 0,
               balance: parseFloat(tx.balance) || 0,
            },
            create: {
              date: new Date(tx.date),
              type: tx.type,
              amount: parseFloat(tx.amount) || 0,
              units: parseFloat(tx.units) || 0,
              nav: parseFloat(tx.nav) || 0,
              balance: parseFloat(tx.balance) || 0,
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
