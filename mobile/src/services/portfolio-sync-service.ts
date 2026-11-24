import type { SQLiteDatabase } from 'expo-sqlite';
import type { DragDecompositionDto } from '../types/generated';
import {
  savePortfolioSnapshot,
  type PortfolioSnapshotInput,
} from '../db/repository';
import type { FolioEntity, HoldingEntity, TransactionEntity } from '../db/schema';
import { syncPortfolioHistoryFromServer } from './history-service';
import { syncPortfolioAnalyticsFromServer } from './analytics-sync-service';
import {
  mapRawFolioToHolding,
  type ServerFolioData,
  type ServerTransactionData,
} from './portfolio-calculations';
import { saveFamilyProfiles, type FamilyProfile } from './family-service';

let cachedDrags: DragDecompositionDto | null = null;

export function setCachedDrags(drags: DragDecompositionDto | null): void {
  cachedDrags = drags;
}

export function getCachedDrags(): DragDecompositionDto | null {
  return cachedDrags;
}

function extractFolioEntities(foliosList: ServerFolioData[], now: string): FolioEntity[] {
  return foliosList.map((f) => ({
    folio_number: f.number || f.folioNumber || 'UNKNOWN',
    amc_name: f.amc || f.amcName || 'Unknown AMC',
    pan: f.pan || 'NA',
    updated_at: now,
  }));
}

function extractHoldingEntities(foliosList: ServerFolioData[], now: string): HoldingEntity[] {
  return foliosList
    .map((f) => mapRawFolioToHolding(f, now))
    .filter((h): h is HoldingEntity => h !== null);
}

function mapFolioTx(
  folioNum: string,
  txList: ServerTransactionData[],
  now: string,
): TransactionEntity[] {
  return txList.map((t, idx) => ({
    id: t.id || `${folioNum}-${t.date || now}-${idx}`,
    folio_number: folioNum,
    date: t.date || now.split('T')[0] || now,
    type: t.type || 'PURCHASE',
    units: Number(t.units || 0),
    nav: Number(t.nav || 0),
    amount: Number(t.amount || 0),
    created_at: now,
  }));
}

function extractTransactionEntities(foliosList: ServerFolioData[], now: string): TransactionEntity[] {
  const result: TransactionEntity[] = [];
  for (const f of foliosList) {
    const folioNum = f.number || f.folioNumber || 'UNKNOWN';
    if (f.transactions && Array.isArray(f.transactions)) {
      result.push(...mapFolioTx(folioNum, f.transactions, now));
    }
  }
  return result;
}

export function parseServerPayload(data: Record<string, unknown>): PortfolioSnapshotInput {
  const activeFolios = (data['folios'] as ServerFolioData[]) || [];
  const closedFolios =
    (data['closedFolios'] as ServerFolioData[]) ||
    (data['closed_folios'] as ServerFolioData[]) ||
    [];
  const allFolios = [...activeFolios, ...closedFolios];
  const now = new Date().toISOString();
  return {
    portfolio: {
      id: typeof data['id'] === 'string' ? data['id'] : 'consolidated',
      name: typeof data['name'] === 'string' ? data['name'] : 'Consolidated Portfolio',
      updated_at: now,
    },
    folios: extractFolioEntities(allFolios, now),
    holdings: extractHoldingEntities(allFolios, now),
    transactions: extractTransactionEntities(allFolios, now),
  };
}

async function syncFamilyProfilesFromServer(profilesUrl: string, token: string): Promise<void> {
  try {
    const profRes = await fetch(profilesUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!profRes.ok) return;
    const rawProfiles = (await profRes.json()) as Array<{
      id: string;
      name: string;
      pan: string;
      relationship?: string;
      isPrimary?: boolean;
      notes?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
    if (Array.isArray(rawProfiles)) {
      const mapped: FamilyProfile[] = rawProfiles.map((p, idx) => ({
        id: p.id,
        name: p.name,
        pan: p.pan,
        relationship: p.relationship || (idx === 0 ? 'Self' : 'Member'),
        isPrimary: p.isPrimary ?? idx === 0,
        notes: p.notes,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));
      await saveFamilyProfiles(mapped);
    }
  } catch {
    // Retain existing profiles if endpoint fails
  }
}

export async function syncWithServer(
  serverUrl: string,
  token: string,
  targetDb: SQLiteDatabase,
): Promise<boolean> {
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  const url = `${trimmed}/api/portfolio/summary`;
  const profilesUrl = `${trimmed}/api/family/profiles`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as Record<string, unknown>;
    const snapshot = parseServerPayload(json);
    if (json['metrics'] && typeof json['metrics'] === 'object') {
      const metrics = json['metrics'] as Record<string, unknown>;
      if (metrics['drags']) {
        setCachedDrags(metrics['drags'] as DragDecompositionDto);
      }
    }
    await savePortfolioSnapshot(targetDb, snapshot);
    await syncFamilyProfilesFromServer(profilesUrl, token);
    const historyUrl = `${trimmed}/api/portfolio/${snapshot.portfolio.id}/history`;
    await syncPortfolioHistoryFromServer({ historyUrl, portfolioId: snapshot.portfolio.id, token, db: targetDb });
    await syncPortfolioAnalyticsFromServer({ serverUrl: trimmed, portfolioId: snapshot.portfolio.id, token, db: targetDb });
    return true;
  } catch {
    return false;
  }
}
