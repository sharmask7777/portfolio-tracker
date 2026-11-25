/**
 * @file useTaxViewModel.ts
 * @module useTaxViewModel
 * @description Presentation controller hook for Tax tab, orchestrating FY selection, tax calculations, and ITR CSV export.
 */

import { useState, useEffect } from 'react';
import {
  TaxSectionName,
  type ITRGainDetail,
  type ITRSummary,
  type AdvanceTaxAccrualMatrix,
  type SectionTotalData,
} from './utils/itr-report-types';
import type { HarvestTicketResponse } from './types/generated/HarvestTicketResponse';
import {
  generateITRReportCSV,
  buildAdvanceTaxMatrix,
} from './utils/itr-report-generator';
import { computeAY } from './utils/tax-formatters';
import { computeTaxBreakdowns, type TaxCalculationsResult } from './utils/tax-calculations';
import { getDaysUntilFYEndIST, formatHarvestInstructions } from './components/Tax/tax-harvest-instructions';

function getRecentFYs(summary: ITRSummary | null | undefined, selectedFY?: string | null): string[] {
  const set = new Set<string>();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let currStartYear = month >= 3 ? year : year - 1;
  for (let i = 0; i < 3; i++) {
    set.add(`${currStartYear}-${(currStartYear + 1).toString().slice(-2)}`);
    currStartYear--;
  }
  if (selectedFY) {
    set.add(selectedFY);
  }
  const details = summary?.details ?? summary?.realized?.details;
  if (details) {
    for (const d of details) {
      if (d.sellDate) {
        const sd = new Date(d.sellDate);
        if (!isNaN(sd.getTime())) {
          const y = sd.getFullYear();
          const m = sd.getMonth();
          const sy = m >= 3 ? y : y - 1;
          set.add(`${sy}-${(sy + 1).toString().slice(-2)}`);
        }
      }
    }
  }
  return Array.from(set).sort().reverse();
}

function getInitialFY(summary: ITRSummary | null | undefined, recentFYs: string[]): string {
  const details = summary?.details ?? summary?.realized?.details;
  if (details && details.length > 0) {
    let latestDate: Date | null = null;
    for (const d of details) {
      const sd = new Date(d.sellDate);
      if (!isNaN(sd.getTime()) && (!latestDate || sd > latestDate)) {
        latestDate = sd;
      }
    }
    if (latestDate) {
      const y = latestDate.getFullYear();
      const m = latestDate.getMonth();
      const sy = m >= 3 ? y : y - 1;
      return `${sy}-${(sy + 1).toString().slice(-2)}`;
    }
  }
  return recentFYs[0] || '2024-25';
}

function getFYDates(fy: string) {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59),
  };
}

function filterDetailsByFY(details: ITRGainDetail[] | undefined, fy: string): ITRGainDetail[] {
  const dates = getFYDates(fy);
  return (details || []).filter((g: ITRGainDetail) => {
    if (!g.sellDate) return false;
    const sellDate = new Date(g.sellDate);
    if (isNaN(sellDate.getTime())) return false;
    return sellDate >= dates.start && sellDate <= dates.end;
  });
}

/**
 * Maps backend-computed `sectionTotals` and `realized` fields into `TaxCalculationsResult`
 * without duplicating statutory tax math on the client.
 */
function buildTaxBreakdownsFromBackend(
  sectionTotals: Record<string, SectionTotalData>,
  realized: ITRSummary['realized'],
  selectedFY: string
): TaxCalculationsResult {
  const sec111a15 = sectionTotals[TaxSectionName.SEC_111A_15];
  const sec111a20 = sectionTotals[TaxSectionName.SEC_111A_20];
  const sec112a10 = sectionTotals[TaxSectionName.SEC_112A_10];
  const sec112a12_5 = sectionTotals[TaxSectionName.SEC_112A_12_5];
  const sec112Debt12_5 = sectionTotals[TaxSectionName.SEC_112_DEBT_12_5];
  const sec112Debt20 = sectionTotals[TaxSectionName.SEC_112_DEBT_20];
  const sec50aa = sectionTotals[TaxSectionName.SEC_50AA];
  const secSlab = sectionTotals[TaxSectionName.SLAB];

  const stcg15Gain = sec111a15?.totalGain ?? 0;
  const stcg20Gain = sec111a20?.totalGain ?? 0;
  const ltcg10Gain = sec112a10?.totalGain ?? 0;
  const ltcg12_5Gain = sec112a12_5?.totalGain ?? 0;
  const debtLtcg12_5Gain = sec112Debt12_5?.totalGain ?? 0;
  const debtLtcg20Gain = sec112Debt20?.totalGain ?? 0;
  const slabGain =
    realized?.taxableSlab ??
    (sec50aa?.totalGain ?? 0) + (secSlab?.totalGain ?? 0);

  const totalEquityLTCG = ltcg10Gain + ltcg12_5Gain;
  const totalSTCG111A = stcg15Gain + stcg20Gain;
  const totalDebtLTCG = debtLtcg20Gain + debtLtcg12_5Gain;

  const ltcgLimit =
    realized?.sec112aExemptionLimit ?? (selectedFY >= '2024-25' ? 125000 : 100000);
  const ltcgExemptClaimed = realized?.sec112aExemption ?? 0;

  const ltcgTaxBeforeCess =
    (sec112a10?.taxBeforeCess ?? 0) + (sec112a12_5?.taxBeforeCess ?? 0);
  const ltcgCess = (sec112a10?.cess ?? 0) + (sec112a12_5?.cess ?? 0);
  const ltcgTotalTax =
    (sec112a10?.totalTax ?? 0) + (sec112a12_5?.totalTax ?? 0);

  const stcgTaxBeforeCess =
    (sec111a15?.taxBeforeCess ?? 0) + (sec111a20?.taxBeforeCess ?? 0);
  const stcgCess = (sec111a15?.cess ?? 0) + (sec111a20?.cess ?? 0);
  const stcgTotalTax =
    (sec111a15?.totalTax ?? 0) + (sec111a20?.totalTax ?? 0);

  const debtTaxBeforeCess =
    (sec112Debt12_5?.taxBeforeCess ?? 0) + (sec112Debt20?.taxBeforeCess ?? 0);
  const debtCess =
    (sec112Debt12_5?.cess ?? 0) + (sec112Debt20?.cess ?? 0);
  const debtTotalTax =
    (sec112Debt12_5?.totalTax ?? 0) + (sec112Debt20?.totalTax ?? 0);

  const slabTaxBeforeCess =
    (sec50aa?.taxBeforeCess ?? 0) + (secSlab?.taxBeforeCess ?? 0);
  const slabCess = (sec50aa?.cess ?? 0) + (secSlab?.cess ?? 0);
  const slabTotalTax = (sec50aa?.totalTax ?? 0) + (secSlab?.totalTax ?? 0);

  const baseTaxTotal =
    ltcgTaxBeforeCess + stcgTaxBeforeCess + debtTaxBeforeCess + slabTaxBeforeCess;
  const cessTotal = ltcgCess + stcgCess + debtCess + slabCess;
  const grandTotalTax = ltcgTotalTax + stcgTotalTax + debtTotalTax + slabTotalTax;

  const ltcgUsed = Math.max(0, totalEquityLTCG);
  const ltcgPercent = ltcgLimit > 0 ? Math.min(100, (ltcgUsed / ltcgLimit) * 100) : 0;

  return {
    totalEquityLTCG,
    totalSTCG111A,
    totalDebtLTCG,
    ltcg10Gain,
    ltcg12_5Gain,
    stcg15Gain,
    stcg20Gain,
    debtLtcg20Gain,
    debtLtcg12_5Gain,
    slabGain,
    ltcgLimit,
    ltcgExemptClaimed,
    ltcgTaxBeforeCess,
    ltcgTotalTax,
    stcgTotalTax,
    debtTotalTax,
    slabTaxBeforeCess,
    slabTotalTax,
    baseTaxTotal,
    cessTotal,
    grandTotalTax,
    ltcgUsed,
    ltcgPercent,
  };
}

function downloadITRReport(
  summary: ITRSummary,
  selectedFY: string,
  filteredDetails: ITRGainDetail[],
  advanceTaxMatrix: AdvanceTaxAccrualMatrix
): void {
  if (filteredDetails.length === 0) {
    alert('No realized gains found for this period to export.');
    return;
  }
  const ay = computeAY(selectedFY);
  const csvContent = generateITRReportCSV({
    assesseeName:
      summary.assesseeName ||
      summary.userName ||
      filteredDetails[0]?.panName ||
      'Portfolio Investor',
    pan: summary.pan || filteredDetails[0]?.pan || '',
    fy: selectedFY,
    ay,
    details: filteredDetails,
    summary,
    advanceTaxMatrix,
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `capital_gains_report_FY_${selectedFY}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface UseTaxViewModelOptions {
  selectedFY?: string | null | undefined;
  onFYChange?: ((fy: string) => void) | undefined;
}

export interface TaxViewModel {
  selectedFY: string;
  setSelectedFY: (fy: string) => void;
  recentFYs: string[];
  filteredDetails: ITRGainDetail[];
  tax: TaxCalculationsResult;
  advanceTaxMatrix: AdvanceTaxAccrualMatrix;
  fyEndInfo: { daysRemaining: number; fyString: string };
  showExemptionWarning: boolean;
  copySuccess: boolean;
  showCopyModal: boolean;
  setShowCopyModal: (show: boolean) => void;
  clipboardText: string;
  handleCopyInstructions: () => Promise<void>;
  handleDownloadReport: () => void;
}

export function useTaxViewModel(
  summary: ITRSummary | null | undefined,
  harvesting: HarvestTicketResponse | null,
  options?: UseTaxViewModelOptions
): TaxViewModel {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [clipboardText, setClipboardText] = useState('');

  const fyEndInfo = getDaysUntilFYEndIST();
  const recentFYs = getRecentFYs(summary, options?.selectedFY);
  const [internalFY, setInternalFY] = useState<string>(() => getInitialFY(summary, recentFYs));
  const selectedFY = options?.selectedFY ?? internalFY;

  const onFYChange = options?.onFYChange;

  useEffect(() => {
    if (!options?.selectedFY && onFYChange) {
      onFYChange(internalFY);
    }
  }, [options?.selectedFY, internalFY, onFYChange]);

  const setSelectedFY = (fy: string) => {
    setInternalFY(fy);
    options?.onFYChange?.(fy);
  };

  const backendSectionTotals = summary?.sectionTotals ?? summary?.realized?.sectionTotals;
  const backendTableF = summary?.tableF ?? summary?.realized?.tableF;
  const hasBackendTaxModel = Boolean(backendSectionTotals && backendTableF);

  const rawDetails = summary?.details ?? summary?.realized?.details;
  const filteredDetails = hasBackendTaxModel
    ? (rawDetails ?? [])
    : filterDetailsByFY(rawDetails, selectedFY);

  const tax = backendSectionTotals
    ? buildTaxBreakdownsFromBackend(backendSectionTotals, summary?.realized, selectedFY)
    : computeTaxBreakdowns(filteredDetails, selectedFY);

  const advanceTaxMatrix = backendTableF ?? buildAdvanceTaxMatrix(filteredDetails);

  const handleCopyInstructions = async () => {
    if (!harvesting) return;
    const instructions = formatHarvestInstructions(harvesting);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(instructions);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      setClipboardText(instructions);
      setShowCopyModal(true);
    }
  };

  const handleDownloadReport = () => {
    if (summary) {
      downloadITRReport(summary, selectedFY, filteredDetails, advanceTaxMatrix);
    }
  };

  const showExemptionWarning =
    selectedFY === recentFYs[0] &&
    (harvesting?.remainingExemption ?? 0) > 0 &&
    fyEndInfo.daysRemaining <= 90;

  return {
    selectedFY,
    setSelectedFY,
    recentFYs,
    filteredDetails,
    tax,
    advanceTaxMatrix,
    fyEndInfo,
    showExemptionWarning,
    copySuccess,
    showCopyModal,
    setShowCopyModal,
    clipboardText,
    handleCopyInstructions,
    handleDownloadReport,
  };
}
