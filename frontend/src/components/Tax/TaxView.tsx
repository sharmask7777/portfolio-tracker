import React, { useState } from 'react';
import {
  generateITRReportCSV,
  computeAY,
  buildAdvanceTaxMatrix,
} from '../../utils/itr-report-generator';
import type { ITRGainDetail, ITRSummary } from '../../utils/itr-report-generator';
import type { HarvestTicketResponse } from '../../types/generated/HarvestTicketResponse';
import { getDaysUntilFYEndIST, formatHarvestInstructions } from './tax-harvest-instructions';
import { computeTaxBreakdowns } from './tax-calculations';
import { TaxHeader } from './TaxHeader';
import { LtcgExemptionTrackerCard } from './LtcgExemptionTrackerCard';
import { TaxHarvestingSection } from './TaxHarvestingSection';
import { RealizedGainsSummaryTable } from './RealizedGainsSummaryTable';
import { AdvanceTaxMatrixTable } from './AdvanceTaxMatrixTable';
import { RecentTransactionsTable } from './RecentTransactionsTable';
import { ClipboardModal } from './ClipboardModal';

export { getDaysUntilFYEndIST, formatHarvestInstructions };

interface TaxViewProps {
  summary: ITRSummary;
  harvesting: HarvestTicketResponse | null;
  onSimulateHarvest?: ((folioId: string, units: number) => void) | undefined;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

function getRecentFYs(summary: ITRSummary): string[] {
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

function getInitialFY(summary: ITRSummary, recentFYs: string[]): string {
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

export const TaxView: React.FC<TaxViewProps> = ({ summary, harvesting, onSimulateHarvest }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [clipboardText, setClipboardText] = useState('');

  const fyEndInfo = getDaysUntilFYEndIST();
  const recentFYs = getRecentFYs(summary);
  const [selectedFY, setSelectedFY] = useState<string>(() => getInitialFY(summary, recentFYs));

  if (!summary) return <div>Loading tax data...</div>;

  const filteredDetails = filterDetailsByFY(summary.details, selectedFY);
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

  const showExemptionWarning =
    selectedFY === recentFYs[0] &&
    (harvesting?.remainingExemption ?? 0) > 0 &&
    fyEndInfo.daysRemaining <= 90;

  return (
    <div className="tax-view animate-fade">
      <TaxHeader
        selectedFY={selectedFY}
        onFYChange={setSelectedFY}
        recentFYs={recentFYs}
        hasSyntheticAnchors={summary.hasSyntheticAnchors}
        showExemptionWarning={showExemptionWarning}
        fyEndInfo={fyEndInfo}
        remainingExemption={harvesting?.remainingExemption ?? 0}
        formatCurrency={formatCurrency}
      />

      <div className="xray-grid">
        <LtcgExemptionTrackerCard
          selectedFY={selectedFY}
          ltcgExemptClaimed={tax.ltcgExemptClaimed}
          ltcgLimit={tax.ltcgLimit}
          ltcgUsed={tax.ltcgUsed}
          ltcgPercent={tax.ltcgPercent}
          formatCurrency={formatCurrency}
        />

        {selectedFY === recentFYs[0] && harvesting && (
          <TaxHarvestingSection
            harvesting={harvesting}
            copySuccess={copySuccess}
            onCopyInstructions={handleCopyInstructions}
            onSimulateHarvest={onSimulateHarvest}
            formatCurrency={formatCurrency}
          />
        )}
      </div>

      <RealizedGainsSummaryTable
        exportCSV={() => downloadITRReport(summary, selectedFY, filteredDetails)}
        totalEquityLTCG={tax.totalEquityLTCG}
        ltcg10Gain={tax.ltcg10Gain}
        ltcg12_5Gain={tax.ltcg12_5Gain}
        ltcgTotalTax={tax.ltcgTotalTax}
        ltcgLimit={tax.ltcgLimit}
        ltcgExemptClaimed={tax.ltcgExemptClaimed}
        totalSTCG111A={tax.totalSTCG111A}
        stcg15Gain={tax.stcg15Gain}
        stcg20Gain={tax.stcg20Gain}
        stcgTotalTax={tax.stcgTotalTax}
        totalDebtLTCG={tax.totalDebtLTCG}
        debtTotalTax={tax.debtTotalTax}
        slabGain={tax.slabGain}
        slabTaxBeforeCess={tax.slabTaxBeforeCess}
        slabTotalTax={tax.slabTotalTax}
        baseTaxTotal={tax.baseTaxTotal}
        cessTotal={tax.cessTotal}
        grandTotalTax={tax.grandTotalTax}
        formatCurrency={formatCurrency}
      />

      <AdvanceTaxMatrixTable
        selectedFY={selectedFY}
        advanceTaxMatrix={advanceTaxMatrix}
        formatCurrency={formatCurrency}
      />

      <RecentTransactionsTable
        selectedFY={selectedFY}
        filteredDetails={filteredDetails}
        formatCurrency={formatCurrency}
      />

      <ClipboardModal
        showCopyModal={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        clipboardText={clipboardText}
      />
    </div>
  );
};
