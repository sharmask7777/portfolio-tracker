const BUY_TYPES = ['buy', 'purchase', 'sip', 'switch_in', 'reinvestment', 'opening_balance', 'bonus'];
const SELL_TYPES = ['sell', 'redemption', 'switch_out', 'transfer_out', 'off_market'];

function processSellLots(lots: { type: string; units: number }[], sellUnits: number): void {
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

function isValidTx(tx: { units?: number | undefined; type?: string | undefined }): boolean {
  if (tx.units === undefined || isNaN(tx.units)) return false;
  return Math.abs(tx.units) > 0.000001 && Boolean(tx.type);
}

export function hasOpeningBalanceHistory(folio: {
  transactions?: Array<{ type?: string | undefined; units?: number | undefined; date?: string | undefined }> | undefined;
}): boolean {
  const txs = folio.transactions;
  if (!txs || txs.length === 0) return false;

  const sorted = [...txs].sort((a, b) => (Date.parse(a.date ?? '') || 0) - (Date.parse(b.date ?? '') || 0));
  const lots: { type: string; units: number }[] = [];

  for (const tx of sorted) {
    if (!isValidTx(tx)) continue;
    const units = Math.abs(tx.units!);
    const type = tx.type!.toLowerCase();

    if (BUY_TYPES.some(p => type.includes(p))) {
      lots.push({ type: tx.type!, units });
    } else if (SELL_TYPES.some(p => type.includes(p))) {
      processSellLots(lots, units);
    }
  }

  return lots.some(l => l.type.toLowerCase().includes('opening_balance') && l.units > 0.000001);
}
