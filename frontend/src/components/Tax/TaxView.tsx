import React from 'react';
import { Download, TrendingDown } from 'lucide-react';
import {
  generateITRReportCSV,
  computeAY,
  buildAdvanceTaxMatrix,
  calculate112AExemption,
  classifySection,
  AdvanceTaxQuarter,
  TaxSectionName,
} from '../../utils/itrReportGenerator';
import type { ITRGainDetail, ITRSummary } from '../../utils/itrReportGenerator';

export interface HarvestingOpportunity {
  folioId: string;
  unitsToHarvest: number;
  schemeName: string;
}

export interface HarvestingData {
  totalPotentialHarvest?: number;
  estimatedTaxSavings?: number;
  opportunities?: HarvestingOpportunity[];
}

interface TaxViewProps {
  summary: ITRSummary;
  harvesting: HarvestingData | null;
  onSimulateHarvest?: (folioId: string, units: number) => void;
}

export const TaxView: React.FC<TaxViewProps> = ({ summary, harvesting, onSimulateHarvest }) => {
  const getRecentFYs = () => {
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
  };

  const recentFYs = getRecentFYs();

  const [selectedFY, setSelectedFY] = React.useState<string>(() => {
    if (summary?.details && summary.details.length > 0) {
      let latestDate: Date | null = null;
      for (const d of summary.details) {
        const sd = new Date(d.sellDate);
        if (!isNaN(sd.getTime())) {
          if (!latestDate || sd > latestDate) {
            latestDate = sd;
          }
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
  });

  if (!summary) return <div>Loading tax data...</div>;

  const getFYDates = (fy: string) => {
    const startYear = parseInt(fy.split('-')[0], 10);
    return {
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31, 23, 59, 59),
    };
  };

  const dates = getFYDates(selectedFY);
  const filteredDetails = (summary.details || []).filter((g: ITRGainDetail) => {
    const sellDate = new Date(g.sellDate);
    return sellDate >= dates.start && sellDate <= dates.end;
  });

  // Categorize sections using Budget 2024 rules
  let stcg15Gain = 0;
  let stcg20Gain = 0;
  let ltcg10Gain = 0;
  let ltcg12_5Gain = 0;
  let debtLtcg20Gain = 0;
  let debtLtcg12_5Gain = 0;
  let slabGain = 0;

  let stcg15TaxBeforeCess = 0;
  let stcg20TaxBeforeCess = 0;
  let debtTaxBeforeCess = 0;
  let slabTaxBeforeCess = 0;

  for (const g of filteredDetails) {
    const section = classifySection(g);
    const tbCess = g.taxBeforeCess !== undefined ? g.taxBeforeCess : 0;

    if (section === TaxSectionName.SEC_111A_15) {
      stcg15Gain += g.gain;
      stcg15TaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.15;
    } else if (section === TaxSectionName.SEC_111A_20) {
      stcg20Gain += g.gain;
      stcg20TaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.20;
    } else if (section === TaxSectionName.SEC_112A_10) {
      ltcg10Gain += g.gain;
    } else if (section === TaxSectionName.SEC_112A_12_5) {
      ltcg12_5Gain += g.gain;
    } else if (section === TaxSectionName.SEC_112_DEBT_20) {
      debtLtcg20Gain += g.gain;
      debtTaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.20;
    } else if (section === TaxSectionName.SEC_112_DEBT_12_5) {
      debtLtcg12_5Gain += g.gain;
      debtTaxBeforeCess += tbCess || Math.max(0, g.gain) * 0.125;
    } else {
      slabGain += g.gain;
      const rate = g.taxRate ?? 0.30;
      slabTaxBeforeCess += tbCess || Math.max(0, g.gain) * rate;
    }
  }

  const totalEquityLTCG = ltcg10Gain + ltcg12_5Gain;
  const totalSTCG111A = stcg15Gain + stcg20Gain;
  const totalDebtLTCG = debtLtcg20Gain + debtLtcg12_5Gain;

  // 112A sequential exemption (exhaust against 10% tranche first, then 12.5%)
  const exemptionRes = calculate112AExemption(ltcg10Gain, ltcg12_5Gain, selectedFY);
  const ltcgLimit = selectedFY >= '2024-25' ? 125000 : 100000;
  const ltcgExemptClaimed = exemptionRes.totalExemption;
  const ltcgTaxBeforeCess = exemptionRes.taxable10 * 0.10 + exemptionRes.taxable12_5 * 0.125;
  const ltcgCess = ltcgTaxBeforeCess * 0.04;
  const ltcgTotalTax = ltcgTaxBeforeCess + ltcgCess;

  const stcgTotalTaxBeforeCess = stcg15TaxBeforeCess + stcg20TaxBeforeCess;
  const stcgCess = stcgTotalTaxBeforeCess * 0.04;
  const stcgTotalTax = stcgTotalTaxBeforeCess + stcgCess;

  const debtCess = debtTaxBeforeCess * 0.04;
  const debtTotalTax = debtTaxBeforeCess + debtCess;

  const slabCess = slabTaxBeforeCess * 0.04;
  const slabTotalTax = slabTaxBeforeCess + slabCess;

  const baseTaxTotal =
    ltcgTaxBeforeCess + stcgTotalTaxBeforeCess + debtTaxBeforeCess + slabTaxBeforeCess;
  const cessTotal = baseTaxTotal * 0.04;
  const grandTotalTax = baseTaxTotal + cessTotal;

  // Build Advance Tax Matrix
  const advanceTaxMatrix = buildAdvanceTaxMatrix(filteredDetails);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const exportCSV = () => {
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
      pan: summary.pan || filteredDetails[0]?.pan || 'ABCDE1234F',
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
  };

  const ltcgUsed = Math.max(0, totalEquityLTCG);
  const ltcgPercent = Math.min(100, (ltcgUsed / ltcgLimit) * 100);

  const startYear = parseInt(selectedFY.split('-')[0], 10);
  const endYear = startYear + 1;

  const dueDates: Record<AdvanceTaxQuarter, string> = {
    [AdvanceTaxQuarter.Q1]: `15/06/${startYear}`,
    [AdvanceTaxQuarter.Q2A]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q2B]: `15/09/${startYear}`,
    [AdvanceTaxQuarter.Q3]: `15/12/${startYear}`,
    [AdvanceTaxQuarter.Q4]: `15/03/${endYear}`,
    [AdvanceTaxQuarter.Q5]: `31/03/${endYear}`,
  };

  const quartersList = [
    AdvanceTaxQuarter.Q1,
    AdvanceTaxQuarter.Q2A,
    AdvanceTaxQuarter.Q2B,
    AdvanceTaxQuarter.Q3,
    AdvanceTaxQuarter.Q4,
    AdvanceTaxQuarter.Q5,
  ];

  return (
    <div className="tax-view animate-fade">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <select
          className="card"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
          value={selectedFY}
          onChange={(e) => setSelectedFY(e.target.value)}
        >
          {recentFYs.map((fy) => (
            <option key={fy} value={fy}>
              Financial Year {fy}
            </option>
          ))}
        </select>
      </div>

      {summary.hasSyntheticAnchors && (
        <div
          className="card"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--warning-color)',
            marginBottom: '1.5rem',
            color: 'var(--warning-color)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <TrendingDown size={20} />
            <div>
              <strong>Incomplete History:</strong> Realized gains and reports involve estimated
              acquisition dates from incomplete CAS histories. Figures are estimates and not
              strictly compliant for tax filing unless a from-inception CAS is uploaded.
            </div>
          </div>
        </div>
      )}

      <div className="xray-grid">
        <div className="card">
          <h3>
            LTCG Exemption Tracker (FY {selectedFY} / AY {computeAY(selectedFY)})
          </h3>
          <div style={{ marginTop: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                Used: {formatCurrency(ltcgExemptClaimed)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Limit: {formatCurrency(ltcgLimit)}
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${ltcgPercent}%`,
                  backgroundColor:
                    ltcgPercent > 90 ? 'var(--danger-color)' : 'var(--success-color)',
                }}
              ></div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              {ltcgUsed >= ltcgLimit
                ? 'Limit exhausted against gains (exhausted 10% tranche first).'
                : `${formatCurrency(ltcgLimit - ltcgExemptClaimed)} of tax-free gains remaining.`}
            </p>
          </div>
        </div>

        {selectedFY === recentFYs[0] &&
          harvesting &&
          harvesting.opportunities &&
          harvesting.opportunities.length > 0 && (
            <div className="card harvest-card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingDown size={20} /> Tax Harvesting Opportunity
              </h3>
              <p style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>
                You can realize <strong>{formatCurrency(harvesting.totalPotentialHarvest ?? 0)}</strong> in
                LTCG tax-free.
              </p>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Estimated Tax Savings:{' '}
                <span className="positive" style={{ fontWeight: 700 }}>
                  {formatCurrency(harvesting.estimatedTaxSavings ?? 0)}
                </span>
              </div>
              <div style={{ marginTop: '1rem' }}>
                {harvesting.opportunities.slice(0, 2).map((op: HarvestingOpportunity, i: number) => (
                  <div
                    key={i}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0',
                      borderTop: '1px solid rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      onSimulateHarvest && onSimulateHarvest(op.folioId, op.unitsToHarvest)
                    }
                  >
                    <span className="btn-link">
                      {op.schemeName}: Sell {op.unitsToHarvest.toFixed(3)} units
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Realized Gains Summary Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h3>Realized Gains Summary</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Schedule CG Compliant (Finance (No. 2) Act, 2024 / Budget 2024)
            </span>
          </div>
          <button className="btn btn-primary" onClick={exportCSV} style={{ fontSize: '0.75rem' }}>
            <Download size={14} /> Export ITR Report (CSV)
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Type / Section</th>
              <th>Realized Gain</th>
              <th>Estimated Tax</th>
              <th>Compliance Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="badge badge-lt">112A (10% vs 12.5%)</span>
              </td>
              <td>
                {formatCurrency(totalEquityLTCG)}
                {totalEquityLTCG > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Pre: {formatCurrency(ltcg10Gain)} @ 10% | Post: {formatCurrency(ltcg12_5Gain)} @ 12.5%
                  </div>
                )}
              </td>
              <td>{formatCurrency(ltcgTotalTax)}</td>
              <td style={{ fontSize: '0.75rem' }}>
                Exempt up to ₹{formatCurrency(ltcgLimit).replace('₹', '')} (Exempted: {formatCurrency(ltcgExemptClaimed)})
              </td>
            </tr>
            <tr>
              <td>
                <span className="badge badge-st">111A (15% vs 20%)</span>
              </td>
              <td>
                {formatCurrency(totalSTCG111A)}
                {totalSTCG111A > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Pre: {formatCurrency(stcg15Gain)} @ 15% | Post: {formatCurrency(stcg20Gain)} @ 20%
                  </div>
                )}
              </td>
              <td>{formatCurrency(stcgTotalTax)}</td>
              <td style={{ fontSize: '0.75rem' }}>Taxed at 15% (Pre 23-Jul) / 20% (Post 23-Jul)</td>
            </tr>
            <tr>
              <td>
                <span
                  className="badge badge-slab"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                >
                  112 Debt (12.5% or 20% indexed)
                </span>
              </td>
              <td>{formatCurrency(totalDebtLTCG)}</td>
              <td>{formatCurrency(debtTotalTax)}</td>
              <td style={{ fontSize: '0.75rem' }}>
                20% Indexed (Pre-2023) / 12.5% Unindexed (Post-2024)
              </td>
            </tr>
            <tr>
              <td>
                <span className="badge badge-slab">50AA (Slab)</span>
              </td>
              <td>{formatCurrency(slabGain)}</td>
              <td>{slabTaxBeforeCess > 0 ? formatCurrency(slabTotalTax) : '---'}</td>
              <td style={{ fontSize: '0.75rem' }}>Taxed at Applicable Slab Rate</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, borderTop: '2px solid var(--border-color)' }}>
              <td>Estimated Tax Summary</td>
              <td>
                Base Tax: {formatCurrency(baseTaxTotal)}
              </td>
              <td colSpan={2}>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  <span>Health & Education Cess (4%): {formatCurrency(cessTotal)}</span>
                  <span style={{ color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                    Total Tax Payable: {formatCurrency(grandTotalTax)}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Advance Tax Accrual Matrix (Schedule CG Table F) */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Advance Tax Accrual Matrix
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Schedule CG Table F (Section 234C Interest Mitigation for FY {selectedFY})
          </span>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Due Date</th>
                <th>Sec 111A (15%)</th>
                <th>Sec 111A (20%)</th>
                <th>Sec 112A (10%)</th>
                <th>Sec 112A (12.5%)</th>
                <th>Sec 50AA (Slab)</th>
                <th>Sec 112 Debt</th>
                <th>Total Gains</th>
                <th>Est. Tax (with Cess)</th>
              </tr>
            </thead>
            <tbody>
              {quartersList.map((q) => {
                const qData = advanceTaxMatrix.quarters[q] || {
                  stcg15: 0,
                  stcg20: 0,
                  ltcg10: 0,
                  ltcg12_5: 0,
                  debtLtcg12_5: 0,
                  debtLtcg20: 0,
                  slab: 0,
                  totalGain: 0,
                  taxBeforeCess: 0,
                  cess: 0,
                  estimatedTax: 0,
                };
                const debtTotal = (qData.debtLtcg12_5 || 0) + (qData.debtLtcg20 || 0);
                const qTotalGain =
                  (qData.stcg15 || 0) +
                  (qData.stcg20 || 0) +
                  (qData.ltcg10 || 0) +
                  (qData.ltcg12_5 || 0) +
                  (qData.slab || 0) +
                  debtTotal;

                return (
                  <tr key={q}>
                    <td><strong>{q}</strong></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {dueDates[q]}
                    </td>
                    <td>{formatCurrency(qData.stcg15)}</td>
                    <td>{formatCurrency(qData.stcg20)}</td>
                    <td>{formatCurrency(qData.ltcg10)}</td>
                    <td>{formatCurrency(qData.ltcg12_5)}</td>
                    <td>{formatCurrency(qData.slab)}</td>
                    <td>{formatCurrency(debtTotal)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(qTotalGain)}</td>
                    <td>{formatCurrency(qData.estimatedTax)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Tax-Impactful Transactions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Recent Tax-Impactful Transactions (FY {selectedFY})</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Showing {Math.min(20, filteredDetails.length)} of {filteredDetails.length} transactions
          </span>
        </div>
        <div
          className="table-container"
          style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Section</th>
                <th>Quarter</th>
                <th>Units</th>
                <th>Buy Date</th>
                <th>Sell Date</th>
                <th>Gain / (Loss)</th>
                <th>Tax</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No realized gains found for this period.
                  </td>
                </tr>
              ) : (
                filteredDetails.slice(0, 20).map((g: ITRGainDetail, i: number) => {
                  const section = classifySection(g);
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{g.assetName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Folio: {g.folioNumber || 'N/A'} | ISIN: {g.isin || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-lt" style={{ fontSize: '0.7rem' }}>
                          {section}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>{g.advanceTaxQuarter || '---'}</td>
                      <td>{g.units.toFixed(2)}</td>
                      <td>
                        {new Date(g.buyDate).toLocaleDateString()}
                        {g.isAnchorDependent && (
                          <span
                            title="Estimated from Synthetic Anchor"
                            style={{ color: 'var(--warning-color)', marginLeft: '4px' }}
                          >
                            *
                          </span>
                        )}
                      </td>
                      <td>{new Date(g.sellDate).toLocaleDateString()}</td>
                      <td className={g.gain >= 0 ? 'positive' : 'negative'}>
                        {formatCurrency(g.gain)}
                      </td>
                      <td>
                        <span
                          className={`badge badge-${g.taxType.toLowerCase()}${
                            g.isGrandfathered ? '-grandfathered' : ''
                          }`}
                        >
                          {g.isGrandfathered ? 'GF-' : ''}
                          {g.taxType}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
