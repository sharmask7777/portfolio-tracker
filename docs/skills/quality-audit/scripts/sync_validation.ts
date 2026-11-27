import fs from 'fs';
import path from 'path';
import { SyncService } from '../../../../backend/src/services/sync.service';

async function run() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('FAILURE: JSON path required');
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const userId = 'audit-user-' + Date.now();
    const result = await SyncService.syncPortfolio(userId, data);
    console.log(`SUCCESS: Ingested ${jsonPath} for user ${userId}. Portfolio: ${result.portfolioId}`);
    process.exit(0);
  } catch (err) {
    console.error(`FAILURE: Sync failed: ${err.message}`);
    process.exit(1);
  }
}

run();
