/**
 * @file TaxView.tsx
 * @module components/Tax/TaxView
 * @description Pure presentation component rendering statutory capital gains tax breakdown, advance tax schedules, and loss harvesting.
 */

import React from 'react';
import type { ITRSummary } from '../../utils/itr-report-types';
import type { HarvestTicketResponse } from '../../types/generated/HarvestTicketResponse';
import { useTaxViewModel } from '../../useTaxViewModel';
import { TaxHeader } from './TaxHeader';
import { LtcgExemptionTrackerCard } from './LtcgExemptionTrackerCard';
import { TaxHarvestingSection } from './TaxHarvestingSection';
import { RealizedGainsSummaryTable } from './RealizedGainsSummaryTable';
import { AdvanceTaxMatrixTable } from './AdvanceTaxMatrixTable';
import { RecentTransactionsTable } from './RecentTransactionsTable';
import { ClipboardModal } from './ClipboardModal';

interface TaxViewProps {
  summary: ITRSummary;
  harvesting: HarvestTicketResponse | null;
  selectedFY?: string | null | undefined;
  onFYChange?: ((fy: string) => void) | undefined;
  onSimulateHarvest?: ((folioId: string, units: number) => void) | undefined;
}

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const TaxView: React.FC<TaxViewProps> = ({
  summary,
  harvesting,
  selectedFY: controlledFY,
  onFYChange,
  onSimulateHarvest,
}) => {
  const {
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
  } = useTaxViewModel(summary, harvesting, {
    selectedFY: controlledFY,
    onFYChange,
  });

  if (!summary) return <div>Loading tax data...</div>;

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
        exportCSV={handleDownloadReport}
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
