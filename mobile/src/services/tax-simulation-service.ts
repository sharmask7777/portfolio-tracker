import type { SimulationSellRequest } from '../types/generated/SimulationSellRequest';
import type { SimulationSellResponse } from '../types/generated/SimulationSellResponse';
import type { RealizedGain } from '../types/generated/RealizedGain';
import {
  simulateSellRedemption,
  type SimulationLot,
  type SimulationSellResult,
  type MatchedLotResult,
} from './tax-harvesting';
import { getStoredCredentials, normalizeServerUrl } from './auth-service';
import { checkServerReachable } from './portfolio-service';

/**
 * Input parameters for simulating a mutual fund withdrawal / sale.
 */
export interface WithdrawalSimulationParams {
  folioId?: string | undefined;
  schemeName?: string | undefined;
  assetClass?: ('EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER') | undefined;
  isElss?: boolean | undefined;
  unitsToSell: number;
  currentNav: number;
  taxSlab?: number | undefined;
  lots?: SimulationLot[] | undefined;
}

/**
 * Error thrown when the backend rejects a simulation request with HTTP 400 or 422
 * (for example, ELSS statutory lock-in or insufficient units).
 */
export class SimulationBackendError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SimulationBackendError';
    this.status = status;
  }
}

function mapTaxType(taxType: string): 'STCG' | 'LTCG' | 'SLAB' {
  const upper = taxType.toUpperCase();
  if (upper.includes('LTCG')) return 'LTCG';
  if (upper.includes('STCG')) return 'STCG';
  return 'SLAB';
}

function mapRealizedGainToMatchedLot(rg: RealizedGain, index: number): MatchedLotResult {
  return {
    lotId: `LOT-${index + 1}`,
    units: rg.units,
    buyDate: rg.buyDate,
    holdingDays: rg.holdingPeriodDays,
    taxType: mapTaxType(rg.taxType),
    taxRate: rg.taxRate,
    deemedCost: rg.deemedCostOfAcquisition,
    gain: rg.gain,
    baseTax: rg.taxBeforeCess,
    cess: rg.cess,
    totalTax: rg.estimatedTax,
  };
}

function computeTotalCost(matchedLots: RealizedGain[], fallbackCost: number): number {
  if (matchedLots.length === 0) return fallbackCost;
  return matchedLots.reduce((acc, rg) => acc + rg.costOfAcquisition, 0);
}

function computeDeemedCost(matchedLots: MatchedLotResult[], fallbackCost: number): number {
  if (matchedLots.length === 0) return fallbackCost;
  return matchedLots.reduce((acc, lot) => acc + lot.deemedCost, 0);
}

function convertResponseToResult(
  response: SimulationSellResponse,
  params: WithdrawalSimulationParams,
): SimulationSellResult {
  const matchedLots = response.matchedLots.map(mapRealizedGainToMatchedLot);
  const unitsRequested = params.unitsToSell;
  const unitsSold = response.unitsToSell;
  const lockedUnits = Math.max(0, unitsRequested - unitsSold);
  const isLocked = lockedUnits > 0;
  const grossValue = response.estimatedValue;
  const exitLoad = response.exitLoad;
  const totalTax = response.estimatedTax;
  const netProceeds = grossValue - exitLoad - totalTax;

  const fallbackDeemedCost = Math.max(0, grossValue - response.totalGain);
  const deemedCost = computeDeemedCost(matchedLots, fallbackDeemedCost);
  const totalCost = computeTotalCost(response.matchedLots, deemedCost);

  const baseTax = response.taxBreakdown.stcg.tax + response.taxBreakdown.ltcg.tax + response.taxBreakdown.slab.tax;
  const cess = response.taxBreakdown.stcg.cess + response.taxBreakdown.ltcg.cess + response.taxBreakdown.slab.cess;

  const warnings: string[] = [];
  if (lockedUnits > 0) {
    warnings.push(`${lockedUnits.toFixed(3)} units are locked under statutory lock-in and cannot be redeemed.`);
  }

  return {
    schemeName: response.assetName || params.schemeName || 'Mutual Fund Scheme',
    unitsRequested,
    unitsSold,
    lockedUnits,
    isLocked,
    grossValue,
    totalCost,
    deemedCost,
    totalGain: response.totalGain,
    stcgGain: response.taxBreakdown.stcg.amount,
    ltcgGain: response.taxBreakdown.ltcg.amount,
    slabGain: response.taxBreakdown.slab.amount,
    exitLoad,
    baseTax,
    cess,
    totalTax,
    netProceeds,
    matchedLots,
    warnings,
  };
}

function mapAssetClass(assetClass?: ('EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER') | undefined): string {
  if (assetClass === 'DEBT') return 'DEBT';
  return 'MUTUAL_FUND';
}

function buildSimulationRequestBody(
  params: WithdrawalSimulationParams,
  today: string,
): SimulationSellRequest {
  return {
    folioId: params.folioId ?? null,
    assetName: params.schemeName ?? null,
    assetType: mapAssetClass(params.assetClass),
    units: params.unitsToSell,
    currentPrice: params.currentNav,
    taxSlab: params.taxSlab ?? 0.30,
    sellDate: today,
  };
}

async function extractBackendErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string } | null;
    if (body?.error) return body.error;
    if (body?.message) return body.message;
  } catch {
    // Ignore JSON parse errors on error body
  }
  return `Simulation rejected by server (HTTP ${response.status})`;
}

async function executeBackendSimulation(
  serverUrl: string,
  token: string,
  params: WithdrawalSimulationParams,
): Promise<SimulationSellResult | null> {
  const baseUrl = normalizeServerUrl(serverUrl);
  const today = new Date().toISOString().split('T')[0] ?? '2026-11-23';
  const requestBody = buildSimulationRequestBody(params, today);

  const response = await fetch(`${baseUrl}/api/tax/simulate-sell`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 400 || response.status === 422) {
    const msg = await extractBackendErrorMessage(response);
    throw new SimulationBackendError(msg, response.status);
  }

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as SimulationSellResponse;
  return convertResponseToResult(data, params);
}

function resolveOfflineLots(params: WithdrawalSimulationParams): SimulationLot[] {
  if (params.lots && params.lots.length > 0) {
    return params.lots;
  }
  return [
    {
      lotId: 'LOT-SIM-FALLBACK-1',
      buyDate: params.isElss ? '2024-01-01' : '2023-01-01',
      units: params.unitsToSell,
      buyPrice: params.currentNav * 0.7,
      isElss: params.isElss ?? false,
    },
  ];
}

function runOfflineSimulation(params: WithdrawalSimulationParams): SimulationSellResult {
  const activeLots = resolveOfflineLots(params);
  const today = new Date().toISOString().split('T')[0] ?? '2026-11-23';

  return simulateSellRedemption({
    folioId: params.folioId ?? 'FOLIO-1',
    schemeName: params.schemeName ?? 'Mutual Fund Scheme',
    isElss: params.isElss ?? false,
    assetClass: params.assetClass ?? 'EQUITY',
    lots: activeLots,
    unitsToSell: params.unitsToSell,
    sellPrice: params.currentNav,
    sellDate: today,
    taxSlab: params.taxSlab ?? 0.30,
  });
}

/**
 * Simulates mutual fund withdrawal and capital gains tax impact.
 *
 * Connects to backend API POST /api/tax/simulate-sell when server is reachable
 * to run statutory FIFO lot allocation with CBDT Budget 2024 tax rules.
 * Gracefully falls back to offline local simulation when disconnected.
 *
 * @param params - Withdrawal simulation inputs
 * @returns Comprehensive simulation result with tax breakdowns, exit loads, and net proceeds
 */
export async function simulateWithdrawal(
  params: WithdrawalSimulationParams,
): Promise<SimulationSellResult> {
  try {
    const creds = await getStoredCredentials();
    if (creds.serverUrl && creds.token) {
      const isReachable = await checkServerReachable(creds.serverUrl);
      if (isReachable) {
        const result = await executeBackendSimulation(creds.serverUrl, creds.token, params);
        if (result) {
          return result;
        }
      }
    }
  } catch (err) {
    if (err instanceof SimulationBackendError) {
      throw err;
    }
    // Graceful offline fallback on any network/parsing failure
  }

  return runOfflineSimulation(params);
}
