import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance } from '../db/client';
import { updateHoldingNav } from '../db/repository';
import type { HoldingEntity } from '../db/schema';
import type { NavUpdateResult, ValuationUpdateSummary } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidDateParts(day: number, month: number, year: number): boolean {
  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || year > 2100) {
    return false;
  }
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  return (
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day
  );
}

function formatIsoDate(day: number, month: number, year: number): string | null {
  if (!isValidDateParts(day, month, year)) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDmy(p0: string, p1: string, p2: string): string | null {
  if (p2.length === 4 && p0.length <= 2) {
    return formatIsoDate(parseInt(p0, 10), parseInt(p1, 10), parseInt(p2, 10));
  }
  return null;
}

function parseYmd(p0: string, p1: string, p2: string): string | null {
  if (p0.length === 4 && p2.length <= 2) {
    return formatIsoDate(parseInt(p2, 10), parseInt(p1, 10), parseInt(p0, 10));
  }
  return null;
}

/**
 * Parses an MFAPI date formatted as "DD-MM-YYYY" or "YYYY-MM-DD" into an ISO date "YYYY-MM-DD".
 */
export function parseMfApiDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) {
    return null;
  }
  const p0 = parts[0];
  const p1 = parts[1];
  const p2 = parts[2];
  if (!p0 || !p1 || !p2) {
    return null;
  }
  return parseDmy(p0, p1, p2) ?? parseYmd(p0, p1, p2);
}

function extractPreviousNav(record: unknown): number | null {
  if (!isRecord(record) || typeof record['nav'] !== 'string') {
    return null;
  }
  const parsed = parseFloat(record['nav']);
  return isNaN(parsed) ? null : parsed;
}

function calculateNavChange(
  latestNav: number,
  prevNav: number | null,
): { dayChange: number; dayGainPct: number } {
  if (prevNav === null || prevNav === 0) {
    return { dayChange: 0, dayGainPct: 0 };
  }
  const diff = latestNav - prevNav;
  const dayChange = Math.round(diff * 10000) / 10000;
  const pct = (diff / prevNav) * 100;
  const dayGainPct = Math.round(pct * 10000) / 10000;
  return { dayChange, dayGainPct };
}

function createErrorResult(amfiCode: string, errorMessage: string): NavUpdateResult {
  return {
    amfiCode,
    success: false,
    latestNav: 0,
    previousNav: null,
    navDate: '',
    dayChange: 0,
    dayGainPct: 0,
    error: errorMessage,
  };
}

function parseMfApiResponse(amfiCode: string, json: unknown): NavUpdateResult {
  if (!isRecord(json) || !Array.isArray(json['data'])) {
    return createErrorResult(amfiCode, 'Invalid response format from NAV service');
  }
  const data = json['data'] as unknown[];
  if (data.length === 0) {
    return createErrorResult(amfiCode, `No NAV records returned for ${amfiCode}`);
  }
  const first = data[0];
  if (!isRecord(first) || typeof first['nav'] !== 'string' || typeof first['date'] !== 'string') {
    return createErrorResult(amfiCode, 'Malformed NAV record in API response');
  }
  const latestNav = parseFloat(first['nav']);
  if (isNaN(latestNav)) {
    return createErrorResult(amfiCode, `Invalid latest NAV value: ${String(first['nav'])}`);
  }
  const navDate = parseMfApiDate(first['date']) ?? first['date'];
  const prevNav = data.length > 1 ? extractPreviousNav(data[1]) : null;
  const { dayChange, dayGainPct } = calculateNavChange(latestNav, prevNav);

  return {
    amfiCode,
    success: true,
    latestNav,
    previousNav: prevNav,
    navDate,
    dayChange,
    dayGainPct,
  };
}

/**
 * Fetches the latest NAV and calculates day gain/loss for a single mutual fund scheme.
 */
export async function fetchSchemeNav(
  amfiCode: string,
  baseUrl: string = 'https://api.mfapi.in',
): Promise<NavUpdateResult> {
  const trimmed = amfiCode ? amfiCode.trim() : '';
  if (!trimmed) {
    return createErrorResult(amfiCode, 'Invalid or empty AMFI code');
  }

  try {
    const response = await fetch(`${baseUrl}/mf/${trimmed}`);
    if (!response.ok) {
      return createErrorResult(
        trimmed,
        `HTTP ${response.status}: Failed to fetch NAV for ${trimmed}`,
      );
    }
    const json = (await response.json()) as unknown;
    return parseMfApiResponse(trimmed, json);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    return createErrorResult(trimmed, `Network error: ${message}`);
  }
}

/**
 * Batch refreshes NAVs for given AMFI codes and updates the local SQLite database.
 */
export async function refreshSchemeNavs(
  amfiCodes: string[],
  db?: SQLiteDatabase,
  baseUrl: string = 'https://api.mfapi.in',
): Promise<Map<string, NavUpdateResult>> {
  const targetDb = db ?? getDatabaseInstance();
  const results = new Map<string, NavUpdateResult>();
  const uniqueCodes = Array.from(new Set(amfiCodes.filter((code) => Boolean(code?.trim()))));

  const fetchResults = await Promise.all(
    uniqueCodes.map(async (code) => {
      const result = await fetchSchemeNav(code, baseUrl);
      return { code, result };
    }),
  );

  for (const { code, result } of fetchResults) {
    results.set(code, result);
    if (result.success && targetDb) {
      try {
        await updateHoldingNav(targetDb, code, {
          nav: result.latestNav,
          navDate: result.navDate,
        });
      } catch (dbError) {
        const message = dbError instanceof Error ? dbError.message : 'Database error';
        results.set(code, {
          ...result,
          success: false,
          error: `Failed to persist NAV: ${message}`,
        });
      }
    }
  }

  return results;
}

/**
 * Calculates total portfolio current value and day gain/loss summary using updated NAV results.
 */
export function calculateDayValuationChange(
  holdings: HoldingEntity[],
  updatedNavs: Map<string, NavUpdateResult>,
): ValuationUpdateSummary {
  let totalCurrentValue = 0;
  let totalDayGain = 0;
  let totalInvestedCost = 0;
  let updatedCount = 0;
  let previousTotalValue = 0;

  for (const holding of holdings) {
    totalInvestedCost += holding.invested_cost;
    const result = holding.amfi_code ? updatedNavs.get(holding.amfi_code) : undefined;

    if (result?.success) {
      updatedCount += 1;
      const currentValue = holding.units * result.latestNav;
      const dayGain = holding.units * result.dayChange;
      totalCurrentValue += currentValue;
      totalDayGain += dayGain;
      const prevNav = result.previousNav ?? result.latestNav;
      previousTotalValue += holding.units * prevNav;
    } else {
      totalCurrentValue += holding.current_value;
      previousTotalValue += holding.current_value;
    }
  }

  const roundedCurrentValue = Math.round(totalCurrentValue * 100) / 100;
  const roundedDayGain = Math.round(totalDayGain * 100) / 100;
  const roundedInvested = Math.round(totalInvestedCost * 100) / 100;
  const dayGainPct = previousTotalValue > 0
    ? Math.round((totalDayGain / previousTotalValue) * 100 * 10000) / 10000
    : 0;

  return {
    totalCurrentValue: roundedCurrentValue,
    totalDayGain: roundedDayGain,
    totalDayGainPct: dayGainPct,
    dayGain: roundedDayGain,
    dayGainPct,
    totalInvestedCost: roundedInvested,
    totalHoldings: holdings.length,
    updatedCount,
    failedCount: holdings.length - updatedCount,
  };
}
