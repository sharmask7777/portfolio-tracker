/**
 * @file holding-adapters.ts
 * @description Helper functions to adapt mobile database entities and portfolio holdings into FolioInput for @portfolio/core-view.
 */

import type { FolioInput } from '@portfolio/core-view';
import type { EnrichedHolding } from '../../services/portfolio-service';
import type { FolioEntity } from '../../services/family-service';

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
): FolioInput {
  const pan = resolvePan(folioMeta);
  const amcName = resolveAmcName(folioMeta);
  const fallbackAbsReturn = holding.gainLossPct !== undefined ? holding.gainLossPct / 100 : undefined;
  const absoluteReturn = holding.absolute_return ?? fallbackAbsReturn;
  const xirr = holding.xirr ?? undefined;

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
      type: holding.asset_class || 'EQUITY',
      isin: holding.isin || undefined,
      amfiCode: holding.amfi_code || undefined,
      schemeCode: holding.amfi_code || undefined,
    },
    metrics: {
      investedAmount: holding.invested_cost,
      currentValue: holding.current_value,
      dayChange: holding.dayChange,
      dayChangePercentage: holding.dayChangePct,
      currentPrice: holding.current_nav,
      totalGain: holding.gainLoss,
      absoluteReturn,
      xirr,
    },
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
): FolioInput[] {
  const folioMap = buildFolioEntityMap(folios);
  return holdings.map((h) => adaptHoldingToFolioInput(h, folioMap.get(h.folio_number)));
}
