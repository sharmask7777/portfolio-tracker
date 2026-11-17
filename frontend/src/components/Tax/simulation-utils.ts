import type { FolioView } from '../../types/generated';

const BUY_TYPES = ['buy', 'purchase', 'sip', 'switch_in', 'reinvestment', 'opening_balance', 'bonus'];
const SELL_TYPES = ['sell', 'redemption', 'switch_out', 'transfer_out', 'off_market'];

function isBuyType(type: string): boolean {
  return BUY_TYPES.some((prefix) => type.includes(prefix));
}

function isSellType(type: string): boolean {
  return SELL_TYPES.some((prefix) => type.includes(prefix));
}

function processSell(lots: { type: string; units: number }[], sellUnits: number): void {
  let remaining = sellUnits;
  while (remaining > 0.000001 && lots.length > 0) {
    const head = lots[0];
    if (!head) break;
    const sold = Math.min(remaining, head.units);
    head.units -= sold;
    remaining -= sold;
    if (head.units <= 0.000001) lots.shift();
  }
}

export function hasOpeningBalanceHistory(folio: FolioView): boolean {
  const sorted = [...(folio.transactions || [])].sort(
    (a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0)
  );
  const lots: { type: string; units: number }[] = [];

  for (const tx of sorted) {
    const rawUnits = tx.units;
    if (rawUnits === undefined || rawUnits === null || isNaN(rawUnits)) continue;
    const units = Math.abs(rawUnits);
    if (units <= 0.000001) continue;

    const type = (tx.type || '').toLowerCase();
    if (!type) continue;

    if (isBuyType(type)) {
      lots.push({ type: tx.type || '', units });
    } else if (isSellType(type)) {
      processSell(lots, units);
    }
  }

  return lots.some(
    lot =>
      ((lot.type || '').toLowerCase().includes('opening_balance') ||
        lot.type === 'OPENING_BALANCE') &&
      lot.units > 0.000001
  );
}
