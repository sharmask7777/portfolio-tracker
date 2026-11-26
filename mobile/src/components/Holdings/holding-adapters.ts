/**
 * @file holding-adapters.ts
 * @description Helper functions to adapt mobile database entities and portfolio holdings into FolioInput for @portfolio/core-view.
 */

import type { FolioInput, FolioMetricsInput } from '@portfolio/core-view';
import type { EnrichedHolding } from '../../services/portfolio-service';
import type { FolioEntity } from '../../services/family-service';

function normalizeAssetClass(raw?: string | null): 'EQUITY' | 'DEBT' | 'HYBRID' | 'GOLD' {
  const upper = (raw || 'EQUITY').toUpperCase();
  if (upper === 'COMMODITY' || upper === 'GOLD') return 'GOLD';
  if (upper === 'DEBT' || upper === 'LIQUID' || upper === 'FIXED_INCOME') return 'DEBT';
  if (upper === 'HYBRID') return 'HYBRID';
  return 'EQUITY';
}

/**
 * Extended folio metrics including mobile-persisted net realizable value.
 */
export interface MobileFolioMetrics extends FolioMetricsInput {
  readonly netRealizableValue?: number | undefined;
}

/**
 * Extended folio input carrying {@link MobileFolioMetrics}.
 */
export interface MobileFolioInput extends FolioInput {
  readonly metrics?: MobileFolioMetrics | undefined;
}

/**
 * Builds a lookup map of folio numbers to FolioEntity records.
 *
 * @param folios - Array of folios with PAN associations.
 * @returns Map of folio number to FolioEntity.
 */
export function buildFolioEntityMap(
  folios: readonly FolioEntity[]
): Map<string, FolioEntity> {
  const map = new Map<string, FolioEntity>();
  for (const f of folios) {
    if (f.folio_number) {
      map.set(f.folio_number, f);
    }
  }
  return map;
}

function resolvePan(folioMeta?: FolioEntity): string | undefined {
  if (folioMeta?.pan && folioMeta.pan !== 'NA') {
    return folioMeta.pan;
  }
  return undefined;
}

function resolveAmcName(folioMeta?: FolioEntity): string | undefined {
  if (folioMeta?.amc_name && folioMeta.amc_name !== 'Unknown AMC') {
    return folioMeta.amc_name;
  }
  return undefined;
}

function buildFolioMetrics(holding: EnrichedHolding): MobileFolioMetrics {
  const fallbackAbsReturn = holding.gainLossPct !== undefined ? holding.gainLossPct / 100 : undefined;
  return {
    investedAmount: holding.invested_cost,
    currentValue: holding.current_value,
    dayChange: holding.dayChange,
    dayChangePercentage: holding.dayChangePct,
    currentPrice: holding.current_nav,
    totalGain: holding.total_gain ?? holding.gainLoss,
    absoluteReturn: holding.absolute_return ?? fallbackAbsReturn,
    xirr: holding.xirr ?? undefined,
    postTaxXirr: holding.post_tax_xirr ?? undefined,
    postTaxAbsoluteReturn: holding.post_tax_absolute_return ?? undefined,
    estimatedTax: holding.estimated_tax ?? undefined,
    netRealizableValue: holding.net_realizable_value ?? undefined,
  };
}

/**
 * Converts mobile EnrichedHolding and associated FolioEntity records into a FolioInput for core-view.
 *
 * @param holding - Enriched holding entity.
 * @param folioMeta - Optional folio metadata entity.
 * @returns FolioInput object.
 */
export function adaptHoldingToFolioInput(
  holding: EnrichedHolding,
  folioMeta?: FolioEntity
): MobileFolioInput {
  const pan = resolvePan(folioMeta);
  const amcName = resolveAmcName(folioMeta);

  return {
    id: holding.id,
    number: holding.folio_number,
    folioNumber: holding.folio_number,
    amcName,
    amc: amcName,
    units: holding.units,
    currentNav: holding.current_nav,
    pan,
    asset: {
      id: holding.id,
      name: holding.scheme_name,
      type: normalizeAssetClass(holding.asset_class),
      isin: holding.isin || undefined,
      amfiCode: holding.amfi_code || undefined,
      schemeCode: holding.amfi_code || undefined,
    },
    metrics: buildFolioMetrics(holding),
  };
}

/**
 * Converts a list of EnrichedHolding records into an array of FolioInput records.
 *
 * @param holdings - Array of enriched holdings.
 * @param folios - Array of stored folios.
 * @returns Array of FolioInput items.
 */
export function adaptHoldingsToFolioInputs(
  holdings: readonly EnrichedHolding[],
  folios: readonly FolioEntity[]
): MobileFolioInput[] {
  const folioMap = buildFolioEntityMap(folios);
  return holdings.map((h) => adaptHoldingToFolioInput(h, folioMap.get(h.folio_number)));
}
