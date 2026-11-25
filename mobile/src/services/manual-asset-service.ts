import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  savePortfolioSnapshot,
  type PortfolioSnapshotInput,
} from '../db/repository';
import type { HoldingEntity, TransactionEntity } from '../db/schema';
import { getStoredCredentials } from './auth-service';

/**
 * Input parameters for creating a manual asset.
 */
export interface AddManualAssetPayload {
  type: 'EPF' | 'PPF' | 'SGB' | 'PHYSICAL_GOLD' | 'REAL_ESTATE' | 'FIXED_DEPOSIT';
  name: string;
  units: number;
  balanceDate: string;
  pan?: string | undefined;
  profileId?: string | undefined;
}

function resolveAssetClass(type: string): string {
  if (type === 'SGB' || type === 'PHYSICAL_GOLD') return 'GOLD';
  if (type === 'REAL_ESTATE') return 'REAL_ESTATE';
  return 'DEBT';
}

function buildManualHolding(
  folioNumber: string,
  payload: AddManualAssetPayload,
  now: string,
): HoldingEntity {
  const nav = 1;
  const val = payload.units;

  return {
    id: `holding-${folioNumber}`,
    folio_number: folioNumber,
    amfi_code: null,
    scheme_name: payload.name,
    isin: null,
    units: payload.units,
    invested_cost: val,
    current_nav: nav,
    current_value: val,
    asset_class: resolveAssetClass(payload.type),
    nav_date: payload.balanceDate,
    updated_at: now,
  };
}

function buildManualTransaction(
  folioNumber: string,
  payload: AddManualAssetPayload,
  holding: HoldingEntity,
): TransactionEntity {
  return {
    id: `tx-${folioNumber}`,
    folio_number: folioNumber,
    date: payload.balanceDate,
    type: 'PURCHASE',
    units: payload.units,
    nav: holding.current_nav,
    amount: holding.current_value,
    created_at: holding.updated_at,
  };
}

async function postToServerIfReachable(
  payload: AddManualAssetPayload,
): Promise<{ folioNumber?: string } | null> {
  const creds = await getStoredCredentials();
  if (!creds.serverUrl || !creds.token) return null;
  const trimmed = creds.serverUrl.trim().replace(/\/+$/, '');
  try {
    const res = await fetch(`${trimmed}/api/portfolio/manual-asset`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: payload.type,
        name: payload.name,
        units: payload.units,
        balanceDate: payload.balanceDate,
        profileId: payload.profileId ?? null,
      }),
    });
    if (res.ok && typeof res.json === 'function') {
      return (await res.json().catch(() => null)) as { folioNumber?: string } | null;
    }
  } catch {
    // Offline fallback: local snapshot is still saved
  }
  return null;
}

/**
 * Onboards an alternative asset into local SQLite holdings and syncs to server if reachable.
 *
 * @param payload Manual asset details
 * @param db Optional SQLite database
 */
export async function addManualAsset(
  payload: AddManualAssetPayload,
  db?: SQLiteDatabase,
): Promise<void> {
  const targetDb = db ?? getDatabaseInstance() ?? (await initDatabase());
  const now = new Date().toISOString();
  const nowTs = Date.now();
  const serverResult = await postToServerIfReachable(payload);
  const folioNumber = serverResult?.folioNumber ?? `MANUAL_${nowTs}`;
  const pan = payload.pan || 'NA';

  const holding = buildManualHolding(folioNumber, payload, now);
  const tx = buildManualTransaction(folioNumber, payload, holding);

  const snapshot: PortfolioSnapshotInput = {
    portfolio: {
      id: 'consolidated',
      name: 'Consolidated Portfolio',
      updated_at: now,
    },
    folios: [{
      folio_number: folioNumber,
      amc_name: payload.type,
      pan,
      updated_at: now,
    }],
    holdings: [holding],
    transactions: [tx],
  };

  await savePortfolioSnapshot(targetDb, snapshot);
}
