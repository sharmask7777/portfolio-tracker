import {
  AdvanceTaxQuarter,
  TaxSectionName,
  type AdvanceTaxAccrualMatrix,
  type TableFQuarterData,
  type TaxCalculationsResult,
  type SimulationLot,
  type SimulationSellRequest,
  type SimulationSellResult,
  type MatchedLotResult,
  type HarvestOpportunity,
  type HarvestPlan,
  type DeemedCostParams,
  type HoldingHarvestInput,
  type LotAllocationCtx,
} from './tax-types';

import {
  calculateSection55DeemedCost,
  checkElssLockIn,
  getAdvanceTaxQuarter,
  classifyTaxSection,
  calculate112AExemption,
  applyCapitalLossSetOffWithSlab,
  computeTaxBreakdowns,
  buildAdvanceTaxMatrix,
} from './tax-calculations';

import { hasOpeningBalanceHistory } from './simulation-utils';

export {
  AdvanceTaxQuarter,
  TaxSectionName,
  calculateSection55DeemedCost,
  checkElssLockIn,
  getAdvanceTaxQuarter,
  classifyTaxSection,
  calculate112AExemption,
  applyCapitalLossSetOffWithSlab,
  computeTaxBreakdowns,
  buildAdvanceTaxMatrix,
  hasOpeningBalanceHistory,
};

export type {
  AdvanceTaxAccrualMatrix,
  TableFQuarterData,
  TaxCalculationsResult,
  SimulationLot,
  SimulationSellRequest,
  SimulationSellResult,
  MatchedLotResult,
  HarvestOpportunity,
  HarvestPlan,
  DeemedCostParams,
  HoldingHarvestInput,
  LotAllocationCtx,
};

function resolveLotTaxRate(
  ctx: LotAllocationCtx,
  holdingDays: number
): { taxType: 'STCG' | 'LTCG' | 'SLAB'; taxRate: number } {
  if (ctx.assetClass === 'DEBT') {
    return { taxType: 'SLAB', taxRate: ctx.taxSlab };
  }
  if (holdingDays >= 365) {
    return { taxType: 'LTCG', taxRate: ctx.sellDate >= '2024-07-23' ? 0.125 : 0.10 };
  }
  return { taxType: 'STCG', taxRate: ctx.sellDate >= '2024-07-23' ? 0.20 : 0.15 };
}

function matchSingleLot(
  lot: SimulationLot,
  unitsToTake: number,
  ctx: LotAllocationCtx
): MatchedLotResult & { exitLoad: number; actualCost: number } {
  const { sellPrice, sellDate, exitLoadRate, exitLoadDays } = ctx;
  const holdingDays = Math.max(0, (Date.parse(sellDate) - Date.parse(lot.buyDate)) / (1000 * 60 * 60 * 24));
  const isPre2018 = Date.parse(lot.buyDate) < Date.parse('2018-02-01');
  const deemedCostPerUnit = calculateSection55DeemedCost({
    cost: lot.buyPrice,
    fmv2018: lot.fmv2018,
    sellPrice,
    isPre2018,
  });

  const gross = unitsToTake * sellPrice;
  const deemedCost = unitsToTake * deemedCostPerUnit;
  const actualCost = unitsToTake * lot.buyPrice;
  const gain = gross - deemedCost;

  const { taxType, taxRate } = resolveLotTaxRate(ctx, holdingDays);
  const baseTax = Math.round(Math.max(0, gain) * taxRate * 100) / 100;
  const cess = Math.round(baseTax * 0.04 * 100) / 100;
  const exitLoad = (exitLoadRate && exitLoadDays && holdingDays < exitLoadDays) ? gross * exitLoadRate : 0;

  return {
    lotId: lot.lotId,
    units: unitsToTake,
    buyDate: lot.buyDate,
    holdingDays,
    taxType,
    taxRate,
    deemedCost,
    gain,
    baseTax,
    cess,
    totalTax: baseTax + cess,
    exitLoad,
    actualCost,
  };
}

function partitionLotsByLock(request: SimulationSellRequest): { unlocked: SimulationLot[]; lockedUnits: number } {
  const unlocked: SimulationLot[] = [];
  let lockedUnits = 0;

  for (const lot of request.lots) {
    const isLotElss = Boolean(lot.isElss || request.isElss);
    if (isLotElss && checkElssLockIn(lot.buyDate, request.sellDate)) {
      lockedUnits += lot.units;
    } else {
      unlocked.push(lot);
    }
  }

  unlocked.sort((a, b) => Date.parse(a.buyDate) - Date.parse(b.buyDate));
  return { unlocked, lockedUnits };
}

interface LotExecutionSummary {
  matchedLots: MatchedLotResult[];
  totalCost: number;
  totalDeemedCost: number;
  totalExitLoad: number;
}

function executeLotAllocations(unlocked: SimulationLot[], unitsSold: number, ctx: LotAllocationCtx): LotExecutionSummary {
  let remaining = unitsSold;
  const matchedLots: MatchedLotResult[] = [];
  let totalCost = 0;
  let totalDeemedCost = 0;
  let totalExitLoad = 0;

  for (const lot of unlocked) {
    if (remaining <= 0.000001) break;
    const take = Math.min(remaining, lot.units);
    const matched = matchSingleLot(lot, take, ctx);
    matchedLots.push(matched);
    totalCost += matched.actualCost;
    totalDeemedCost += matched.deemedCost;
    totalExitLoad += matched.exitLoad;
    remaining -= take;
  }

  return { matchedLots, totalCost, totalDeemedCost, totalExitLoad };
}

export function simulateSellRedemption(request: SimulationSellRequest): SimulationSellResult {
  const { unlocked, lockedUnits } = partitionLotsByLock(request);
  const totalUnlockedUnits = unlocked.reduce((sum, l) => sum + l.units, 0);
  const unitsSold = Math.min(request.unitsToSell, totalUnlockedUnits);
  const isLocked = lockedUnits > 0 && request.unitsToSell > totalUnlockedUnits;

  const warnings: string[] = [];
  if (lockedUnits > 0) {
    warnings.push(`${lockedUnits.toFixed(3)} units are locked under statutory 3-year ELSS restriction and cannot be redeemed.`);
  }

  const ctx: LotAllocationCtx = {
    sellPrice: request.sellPrice,
    sellDate: request.sellDate,
    assetClass: request.assetClass,
    taxSlab: request.taxSlab,
    exitLoadRate: request.exitLoadRate,
    exitLoadDays: request.exitLoadDays,
  };

  const summary = executeLotAllocations(unlocked, unitsSold, ctx);
  const grossValue = unitsSold * request.sellPrice;
  const baseTax = summary.matchedLots.reduce((s, l) => s + l.baseTax, 0);
  const cess = summary.matchedLots.reduce((s, l) => s + l.cess, 0);
  const totalTax = baseTax + cess;

  return {
    schemeName: request.schemeName,
    unitsRequested: request.unitsToSell,
    unitsSold,
    lockedUnits,
    isLocked,
    grossValue,
    totalCost: summary.totalCost,
    deemedCost: summary.totalDeemedCost,
    totalGain: grossValue - summary.totalDeemedCost,
    stcgGain: summary.matchedLots.filter(l => l.taxType === 'STCG').reduce((s, l) => s + l.gain, 0),
    ltcgGain: summary.matchedLots.filter(l => l.taxType === 'LTCG').reduce((s, l) => s + l.gain, 0),
    slabGain: summary.matchedLots.filter(l => l.taxType === 'SLAB').reduce((s, l) => s + l.gain, 0),
    exitLoad: summary.totalExitLoad,
    baseTax,
    cess,
    totalTax,
    netProceeds: grossValue - summary.totalExitLoad - totalTax,
    matchedLots: summary.matchedLots,
    warnings,
  };
}

function assessHoldingOpportunity(h: HoldingHarvestInput, currentDate: string): HarvestOpportunity | null {
  const eligibleLots = h.lots.filter(l => {
    const isElss = Boolean(l.isElss || h.isElss);
    if (isElss && checkElssLockIn(l.buyDate, currentDate)) return false;
    const days = (Date.parse(currentDate) - Date.parse(l.buyDate)) / (1000 * 60 * 60 * 24);
    return days >= 365 && h.currentNav > l.buyPrice;
  });

  if (eligibleLots.length === 0) return null;

  const totalEligibleUnits = eligibleLots.reduce((sum, l) => sum + l.units, 0);
  const totalInvested = eligibleLots.reduce((sum, l) => sum + l.units * l.buyPrice, 0);
  const costNav = totalInvested / totalEligibleUnits;
  const currentValue = totalEligibleUnits * h.currentNav;
  const unrealizedGain = currentValue - totalInvested;

  const dates = eligibleLots.map(l => l.buyDate).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  return {
    folioId: h.folioId,
    schemeName: h.schemeName,
    isin: h.isin,
    currentUnits: totalEligibleUnits,
    unitsToHarvest: totalEligibleUnits,
    currentNav: h.currentNav,
    costNav,
    currentValue,
    unrealizedGain,
    holdingDays: Math.floor((Date.parse(currentDate) - Date.parse(firstDate ?? currentDate)) / (1000 * 60 * 60 * 24)),
    lotsCount: eligibleLots.length,
    firstLotDate: firstDate,
    lastLotDate: lastDate,
  };
}

export function formatHarvestInstructions(plan: Omit<HarvestPlan, 'instructions'>): string {
  const lines: string[] = [
    '=============================================================',
    '  SECTION 112A TAX-FREE HARVESTING REDEMPTION INSTRUCTIONS',
    '=============================================================',
    `Financial Year: ${plan.fy} | Target: Sec 112A ₹1,25,000 Tax-Free LTCG`,
    `Remaining Statutory Exemption: ₹${plan.remainingExemption.toLocaleString('en-IN')}`,
    `Total Tax-Free Gains to Harvest: ₹${plan.totalPotentialHarvest.toLocaleString('en-IN')}`,
    `Estimated Tax Saved (12.5%): ₹${plan.estimatedTaxSavings.toLocaleString('en-IN')}`,
    'Execution Hub: MF Central / CAMS / KFintech (Redeem by Units)',
    '',
    `ACTIONABLE REDEMPTIONS (${plan.opportunities.length} Orders Needed):`,
  ];

  plan.opportunities.forEach((op, index) => {
    lines.push(
      `\n[ORDER ${index + 1} of ${plan.opportunities.length}]`,
      `• Scheme: ${op.schemeName}`,
      `• Folio No: ${op.folioId}`,
      `• Action: Redeem ${op.unitsToHarvest.toFixed(3)} units (Approx. Value: ₹${op.currentValue.toLocaleString('en-IN')})`,
      `• Tax-Free Gain Harvested: ₹${op.unrealizedGain.toLocaleString('en-IN')}`
    );
  });

  lines.push(
    '',
    '-------------------------------------------------------------',
    'REINVESTMENT ADVISORY:',
    '• Settled proceeds credit your bank in T+2 business days.',
    '• DO NOT repurchase into ELSS (avoids fresh 3-year statutory lock-in).',
    '• Reinvest into an open-ended equity fund to step-up tax cost basis.',
    'CBDT Sec 112A Compliant · Generated by Portfolio Tracker',
    '============================================================='
  );

  return lines.join('\n');
}

export function buildTaxHarvestPlan(
  holdings: HoldingHarvestInput[],
  realizedLtcgCurrentFY: number,
  currentDate: string = new Date().toISOString().split('T')[0] ?? '2024-09-01'
): HarvestPlan {
  const ltcgLimit = 125000;
  const remainingExemption = Math.max(0, ltcgLimit - realizedLtcgCurrentFY);

  let remainingQuota = remainingExemption;
  const opportunities: HarvestOpportunity[] = [];

  for (const h of holdings) {
    if (remainingQuota <= 0) break;
    const opp = assessHoldingOpportunity(h, currentDate);
    if (!opp) continue;

    const gainToTake = Math.min(opp.unrealizedGain, remainingQuota);
    const fraction = opp.unrealizedGain > 0 ? gainToTake / opp.unrealizedGain : 0;
    const unitsToHarvest = opp.currentUnits * fraction;

    opportunities.push({
      ...opp,
      unitsToHarvest,
      unrealizedGain: gainToTake,
      currentValue: unitsToHarvest * opp.currentNav,
    });

    remainingQuota -= gainToTake;
  }

  const totalPotentialHarvest = opportunities.reduce((s, o) => s + o.unrealizedGain, 0);
  const estimatedTaxSavings = Math.round(totalPotentialHarvest * 0.125 * 1.04);

  const planBase = {
    fy: '2024-25',
    ltcgLimit,
    realizedLtcgCurrentFY,
    remainingExemption,
    totalPotentialHarvest,
    estimatedTaxSavings,
    opportunities,
  };

  return {
    ...planBase,
    instructions: formatHarvestInstructions(planBase),
  };
}
