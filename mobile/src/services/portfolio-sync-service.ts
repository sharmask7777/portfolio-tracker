import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AssetAllocationDto,
  PanBreakdownDto,
  SummaryMetrics,
} from '../types/generated';
import { getDatabaseInstance, initDatabase } from '../db/client';
import {
  reconcileServerSnapshot,
  getStoredSummaryBundle,
  saveScopedSummaryBundle,
  type PortfolioSnapshotInput,
  type StoredSummaryEnvelope,
} from '../db/repository';
import type { DashboardSummary } from './portfolio-service';
import type { FolioEntity, HoldingEntity, TransactionEntity } from '../db/schema';
import { syncPortfolioHistoryFromServer } from './history-service';
import { syncPortfolioAnalyticsFromServer } from './analytics-sync-service';
import {
  mapRawFolioToHolding,
  normalizeAssetClass,
  type ServerFolioData,
  type ServerTransactionData,
} from './portfolio-calculations';
import { saveFamilyProfiles, type FamilyProfile } from './family-service';

const cachedBundlesByScope = new Map<string, StoredSummaryEnvelope>();

function setCachedSummaryBundle(
  bundle: StoredSummaryEnvelope | null,
  scopeId: string = 'consolidated',
): void {
  if (bundle) {
    cachedBundlesByScope.set(scopeId, bundle);
  } else {
    cachedBundlesByScope.delete(scopeId);
  }
}

export async function getStoredDashboardBundle(
  db?: SQLiteDatabase,
  scopeId: string = 'consolidated',
): Promise<StoredSummaryEnvelope | null> {
  const memCached = cachedBundlesByScope.get(scopeId);
  if (memCached) return memCached;
  const targetDb = db ?? getDatabaseInstance() ?? (await initDatabase());
  if (!targetDb || typeof targetDb.getFirstAsync !== 'function') {
    return null;
  }
  const stored = await getStoredSummaryBundle(targetDb, scopeId);
  if (stored) {
    setCachedSummaryBundle(stored, scopeId);
  }
  return stored;
}

export function mergeServerMetricsIntoSummary(
  base: Omit<DashboardSummary, 'isOfflineFallback'>,
  serverMetrics: SummaryMetrics,
  backendAssetAllocation?: AssetAllocationDto[],
): DashboardSummary {
  const assetAllocation =
    backendAssetAllocation && backendAssetAllocation.length > 0
      ? backendAssetAllocation.map((item) => ({
          name: normalizeAssetClass(item.name, item.name),
          amount: item.amount,
          percentage: item.percentage,
          color: item.color,
        }))
      : base.assetAllocation;

  return {
    ...base,
    totalCurrentValue: serverMetrics.totalValue,
    totalInvestedCost: serverMetrics.totalInvested,
    unrealizedGain: serverMetrics.totalGain,
    unrealizedGainPct: serverMetrics.absoluteReturn * 100,
    dayGain: serverMetrics.dayChange,
    dayGainPct: serverMetrics.dayChangePercentage,
    overallXirr: serverMetrics.xirr,
    postTaxXirr: serverMetrics.postTaxXirr ?? null,
    netRealizableValue: serverMetrics.netRealizableValue ?? serverMetrics.postTaxTotalValue,
    postTaxTotalValue: serverMetrics.postTaxTotalValue,
    estimatedTax: serverMetrics.estimatedTax,
    realPostTaxXirr: serverMetrics.realPostTaxXirr ?? null,
    drags: serverMetrics.drags ?? null,
    assetAllocation,
    metrics: serverMetrics,
    isOfflineFallback: false,
  };
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

export interface SyncServerOptions {
  cpi?: number | undefined;
  taxBracket?: number | undefined;
  profileId?: string | undefined;
}

function isValidNum(val: number | undefined): val is number {
  return typeof val === 'number' && !Number.isNaN(val);
}

function buildSummaryUrl(trimmedBase: string, options?: SyncServerOptions): string {
  const params = new URLSearchParams();
  if (isValidNum(options?.cpi)) {
    params.set('cpiInflationRate', String(options.cpi));
  }
  if (isValidNum(options?.taxBracket)) {
    params.set('marginalTaxBracket', String(options.taxBracket));
  }
  const pid = options?.profileId?.trim();
  if (pid) {
    params.set('profileId', pid);
  }
  const qs = params.toString();
  return qs ? `${trimmedBase}/api/portfolio/summary?${qs}` : `${trimmedBase}/api/portfolio/summary`;
}

export interface SyncServerParams {
  serverUrl: string;
  token: string;
  targetDb: SQLiteDatabase;
  options?: SyncServerOptions | undefined;
}

function extractSummaryBundle(json: Record<string, unknown>): StoredSummaryEnvelope | null {
  if (!json['metrics'] || typeof json['metrics'] !== 'object') {
    return null;
  }
  return {
    metrics: json['metrics'] as SummaryMetrics,
    panBreakdowns: Array.isArray(json['panBreakdowns'])
      ? (json['panBreakdowns'] as PanBreakdownDto[])
      : undefined,
    assetAllocation: Array.isArray(json['assetAllocation'])
      ? (json['assetAllocation'] as AssetAllocationDto[])
      : undefined,
  };
}

export async function syncWithServerWithOptions({
  serverUrl,
  token,
  targetDb,
  options,
}: SyncServerParams): Promise<boolean> {
  const trimmed = serverUrl.trim().replace(/\/+$/, '');
  const url = buildSummaryUrl(trimmed, options);
  const profilesUrl = `${trimmed}/api/family/profiles`;
  const profileId = options?.profileId?.trim() || undefined;
  const scopeId = profileId ?? 'consolidated';

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as Record<string, unknown>;
    const bundle = extractSummaryBundle(json);
    if (bundle) {
      setCachedSummaryBundle(bundle, scopeId);
      await saveScopedSummaryBundle(targetDb, scopeId, bundle);
    }

    if (profileId) {
      const historyUrl = `${trimmed}/api/portfolio/${profileId}/history`;
      await syncPortfolioHistoryFromServer({ historyUrl, portfolioId: profileId, token, db: targetDb });
      return true;
    }

    const snapshot = parseServerPayload(json);
    await reconcileServerSnapshot(targetDb, snapshot, bundle ? JSON.stringify(bundle) : null);
    await syncFamilyProfilesFromServer(profilesUrl, token);
    const historyUrl = `${trimmed}/api/portfolio/${snapshot.portfolio.id}/history`;
    await syncPortfolioHistoryFromServer({ historyUrl, portfolioId: snapshot.portfolio.id, token, db: targetDb });
    await syncPortfolioAnalyticsFromServer({ serverUrl: trimmed, portfolioId: snapshot.portfolio.id, token, db: targetDb });
    return true;
  } catch {
    return false;
  }
}

