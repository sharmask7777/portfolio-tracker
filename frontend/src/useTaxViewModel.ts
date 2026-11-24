/**
 * @file useTaxViewModel.ts
 * @module useTaxViewModel
 * @description Presentation controller hook for Tax tab, orchestrating FY selection, tax calculations, and ITR CSV export.
 */

import { useState } from 'react';
import type { ITRGainDetail, ITRSummary, AdvanceTaxAccrualMatrix } from './utils/itr-report-types';
import type { HarvestTicketResponse } from './types/generated/HarvestTicketResponse';
import {
  generateITRReportCSV,
  buildAdvanceTaxMatrix,
} from './utils/itr-report-generator';
import { computeAY } from './utils/tax-formatters';
import { computeTaxBreakdowns, type TaxCalculationsResult } from './utils/tax-calculations';
import { getDaysUntilFYEndIST, formatHarvestInstructions } from './components/Tax/tax-harvest-instructions';

function getRecentFYs(summary: ITRSummary | null | undefined): string[] {
  const set = new Set<string>();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let currStartYear = month >= 3 ? year : year - 1;
  for (let i = 0; i < 3; i++) {
    set.add(`${currStartYear}-${(currStartYear + 1).toString().slice(-2)}`);
    currStartYear--;
  }
  if (summary?.details) {
    for (const d of summary.details) {
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
  if (summary?.details && summary.details.length > 0) {
    let latestDate: Date | null = null;
    for (const d of summary.details) {
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

function downloadITRReport(summary: ITRSummary, selectedFY: string, filteredDetails: ITRGainDetail[]): void {
  if (filteredDetails.length === 0) {
    alert('No realized gains found for this period to export.');
    return;
  }
  const ay = computeAY(selectedFY);
  const advanceTaxMatrix = buildAdvanceTaxMatrix(filteredDetails);
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
  harvesting: HarvestTicketResponse | null
): TaxViewModel {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [clipboardText, setClipboardText] = useState('');

  const fyEndInfo = getDaysUntilFYEndIST();
  const recentFYs = getRecentFYs(summary);
  const [selectedFY, setSelectedFY] = useState<string>(() => getInitialFY(summary, recentFYs));

  const filteredDetails = filterDetailsByFY(summary?.details, selectedFY);
  const tax = computeTaxBreakdowns(filteredDetails, selectedFY);
  const advanceTaxMatrix = buildAdvanceTaxMatrix(filteredDetails);

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
      downloadITRReport(summary, selectedFY, filteredDetails);
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
