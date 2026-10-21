import { render, screen, fireEvent } from '@testing-library/react';
import { TaxView } from './TaxView';
import { describe, it, expect, vi } from 'vitest';

describe('TaxView', () => {
  const mockGains = [
    {
      assetName: 'Parag Parikh Flexi Cap Fund',
      folioNumber: '12345',
      isin: 'INF879O01018',
      assetClass: 'EQUITY',
      section: '111A (15%)',
      buyDate: '2024-01-10',
      sellDate: '2024-05-20',
      holdingPeriodDays: 131,
      holdingType: 'Short-Term',
      units: 100,
      buyNav: 50.0,
      sellNav: 60.0,
      grossConsideration: 6000.0,
      costOfAcquisition: 5000.0,
      fmvAsOfJan31_2018: 0,
      totalFmvJan31_2018: 0,
      deemedCostOfAcquisition: 5000.0,
      transferExpenses: 0,
      gain: 1000.0,
      taxType: 'STCG',
      taxRate: 0.15,
      taxBeforeCess: 150.0,
      cess: 6.0,
      estimatedTax: 156.0,
      advanceTaxQuarter: 'Q1 (01/04 - 15/06)',
      isGrandfathered: false,
      isAnchorDependent: false,
    },
    {
      assetName: 'HDFC Large Cap',
      folioNumber: '67890',
      isin: 'INF179K01BE2',
      assetClass: 'EQUITY',
      section: '111A (20%)',
      buyDate: '2024-02-15',
      sellDate: '2024-08-10',
      holdingPeriodDays: 177,
      holdingType: 'Short-Term',
      units: 100,
      buyNav: 100.0,
      sellNav: 120.0,
      grossConsideration: 12000.0,
      costOfAcquisition: 10000.0,
      fmvAsOfJan31_2018: 0,
      totalFmvJan31_2018: 0,
      deemedCostOfAcquisition: 10000.0,
      transferExpenses: 0,
      gain: 2000.0,
      taxType: 'STCG',
      taxRate: 0.20,
      taxBeforeCess: 400.0,
      cess: 16.0,
      estimatedTax: 416.0,
      advanceTaxQuarter: 'Q2b (23/07 - 15/09)',
      isGrandfathered: false,
      isAnchorDependent: true,
    },
    {
      assetName: 'ICICI Prudential Bluechip',
      folioNumber: '55555',
      isin: 'INF109K011B1',
      assetClass: 'EQUITY',
      section: '112A (10%)',
      buyDate: '2017-06-01',
      sellDate: '2024-06-25',
      holdingPeriodDays: 2581,
      holdingType: 'Long-Term',
      units: 500,
      buyNav: 30.0,
      sellNav: 100.0,
      grossConsideration: 50000.0,
      costOfAcquisition: 15000.0,
      fmvAsOfJan31_2018: 45.0,
      totalFmvJan31_2018: 22500.0,
      deemedCostOfAcquisition: 22500.0,
      transferExpenses: 0,
      gain: 27500.0,
      taxType: 'LTCG',
      taxRate: 0.10,
      taxBeforeCess: 0,
      cess: 0,
      estimatedTax: 0,
      advanceTaxQuarter: 'Q2a (16/06 - 22/07)',
      isGrandfathered: true,
      isAnchorDependent: false,
    },
    {
      assetName: 'Mirae Asset Large Cap',
      folioNumber: '77777',
      isin: 'INF769K01026',
      assetClass: 'EQUITY',
      section: '112A (12.5%)',
      buyDate: '2022-01-15',
      sellDate: '2024-10-10',
      holdingPeriodDays: 1000,
      holdingType: 'Long-Term',
      units: 1000,
      buyNav: 50.0,
      sellNav: 80.0,
      grossConsideration: 80000.0,
      costOfAcquisition: 50000.0,
      fmvAsOfJan31_2018: 0,
      totalFmvJan31_2018: 0,
      deemedCostOfAcquisition: 50000.0,
      transferExpenses: 0,
      gain: 30000.0,
      taxType: 'LTCG',
      taxRate: 0.125,
      taxBeforeCess: 0,
      cess: 0,
      estimatedTax: 0,
      advanceTaxQuarter: 'Q3 (16/09 - 15/12)',
      isGrandfathered: false,
      isAnchorDependent: false,
    },
    {
      assetName: 'Aditya Birla Short Term Debt',
      folioNumber: '88888',
      isin: 'INF209K01157',
      assetClass: 'DEBT',
      section: '50AA (Slab)',
      buyDate: '2023-05-10',
      sellDate: '2025-01-15',
      holdingPeriodDays: 616,
      holdingType: 'Short-Term',
      units: 100,
      buyNav: 100.0,
      sellNav: 110.0,
      grossConsideration: 11000.0,
      costOfAcquisition: 10000.0,
      fmvAsOfJan31_2018: 0,
      totalFmvJan31_2018: 0,
      deemedCostOfAcquisition: 10000.0,
      transferExpenses: 0,
      gain: 1000.0,
      taxType: 'SLAB',
      taxRate: 0.30,
      taxBeforeCess: 300.0,
      cess: 12.0,
      estimatedTax: 312.0,
      advanceTaxQuarter: 'Q4 (16/12 - 15/03)',
      isGrandfathered: false,
      isAnchorDependent: false,
    },
    {
      assetName: 'Nippon Grandfathered Debt',
      folioNumber: '99999',
      isin: 'INF204K01012',
      assetClass: 'DEBT',
      section: '112 Debt (20% Indexed)',
      buyDate: '2022-03-10',
      sellDate: '2025-03-20',
      holdingPeriodDays: 1106,
      holdingType: 'Long-Term',
      units: 100,
      buyNav: 100.0,
      sellNav: 125.0,
      grossConsideration: 12500.0,
      costOfAcquisition: 10000.0,
      fmvAsOfJan31_2018: 0,
      totalFmvJan31_2018: 0,
      deemedCostOfAcquisition: 10000.0,
      transferExpenses: 0,
      gain: 2500.0,
      taxType: 'LTCG',
      taxRate: 0.20,
      taxBeforeCess: 500.0,
      cess: 20.0,
      estimatedTax: 520.0,
      advanceTaxQuarter: 'Q5 (16/03 - 31/03)',
      isGrandfathered: true,
      isAnchorDependent: false,
    },
  ];

  const mockSummary = {
    details: mockGains,
    hasSyntheticAnchors: true,
    assesseeName: 'Sharma Household',
    pan: 'ABCDE1234F',
  };

  it('triggers alert when exporting empty gains', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    const emptySummary = {
      details: [],
      hasSyntheticAnchors: false
    };
    
    render(<TaxView summary={emptySummary} harvesting={null} />);
    
    const exportButton = screen.getByRole('button', { name: /Export ITR Report/i });
    fireEvent.click(exportButton);
    
    expect(alertMock).toHaveBeenCalledWith('No realized gains found for this period to export.');
    alertMock.mockRestore();
  });

  it('exports comprehensive ITR report CSV when export button is clicked', () => {
    let capturedBlob: Blob | null = null;
    let capturedFilename = '';

    const createObjectURLMock = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      capturedBlob = blob as Blob;
      return 'blob:mock-url';
    });
    const revokeObjectURLMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const originalAppendChild = document.body.appendChild.bind(document.body);

    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el: Node) => {
      const anchor = el as HTMLAnchorElement;
      if (anchor.tagName === 'A' && anchor.download) {
        capturedFilename = anchor.download;
      }
      return originalAppendChild(el);
    });

    render(<TaxView summary={mockSummary} harvesting={null} />);

    const exportButton = screen.getByRole('button', { name: /Export ITR Report/i });
    fireEvent.click(exportButton);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(capturedFilename).toMatch(/capital_gains_report_FY_.*\.csv/);
    expect(capturedBlob).not.toBeNull();

    createObjectURLMock.mockRestore();
    revokeObjectURLMock.mockRestore();
    appendChildSpy.mockRestore();
  });

  it('renders Schedule CG Table F Advance Tax Accrual Matrix in the UI', () => {
    render(<TaxView summary={mockSummary} harvesting={null} />);

    expect(screen.getByText(/Advance Tax Accrual Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Schedule CG Table F/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Q1 \(01\/04 - 15\/06\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Q2a \(16\/06 - 22\/07\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Q2b \(23\/07 - 15\/09\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Q3 \(16\/09 - 15\/12\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Q4 \(16\/12 - 15\/03\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Q5 \(16\/03 - 31\/03\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders updated Budget 2024 badges for 111A, 112A, 50AA, 112 Debt, and 4% Cess', () => {
    render(<TaxView summary={mockSummary} harvesting={null} />);

    // Badges / Section text
    expect(screen.getByText(/111A \(15% vs 20%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/112A \(10% vs 12.5%\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/50AA/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/112 Debt/i).length).toBeGreaterThanOrEqual(1);
    // 4% Cess
    expect(screen.getByText(/Health & Education Cess \(4%\)/i)).toBeInTheDocument();
  });

  it('does NOT crash when unitsToHarvest is Infinity or NaN (regression: toFixed is not a function)', () => {
    // Harvesting opportunity with Infinity unitsToHarvest (caused by zero price-diff division in backend)
    const harvestingWithInfinity = {
      totalPotentialHarvest: 125000,
      estimatedTaxSavings: 15625,
      opportunities: [
        { folioId: 'f1', schemeName: 'Some Equity Fund', unitsToHarvest: Infinity, unrealizedGain: 125000, currentValue: 200000 },
        { folioId: 'f2', schemeName: 'Another Fund', unitsToHarvest: NaN, unrealizedGain: 0, currentValue: 0 },
      ],
    };

    // Use a sell date in the CURRENT FY (2026-27) so the harvesting card renders
    const currentFYSummary = {
      ...mockSummary,
      details: [
        {
          ...mockSummary.details[0],
          sellDate: '2026-10-10', // current FY 2026-27
          advanceTaxQuarter: 'Q3 (16/09 - 15/12)',
        },
      ],
    };

    expect(() =>
      render(<TaxView summary={currentFYSummary} harvesting={harvestingWithInfinity} />)
    ).not.toThrow();

    // Should render a safe fallback instead of crashing
    expect(screen.getByText(/Tax Harvesting Opportunity/i)).toBeInTheDocument();
    // Safe fallback "0.000 units" shown for NaN
    expect(screen.getAllByText(/0\.000 units/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT crash when a gain detail has an undefined taxType (regression: toLowerCase on undefined)', () => {
    const summaryWithUndefinedTaxType = {
      ...mockSummary,
      details: [
        ...mockSummary.details,
        {
          assetName: 'Unknown Fund',
          folioNumber: '00000',
          isin: 'INF000000000',
          assetClass: 'EQUITY',
          buyDate: '2023-01-01',
          sellDate: '2025-01-01',
          holdingPeriodDays: 730,
          holdingType: 'Long-Term',
          units: 10,
          buyNav: 100,
          sellNav: 120,
          grossConsideration: 1200,
          costOfAcquisition: 1000,
          gain: 200,
          taxType: undefined as any, // missing taxType — real-world edge case
          taxRate: 0.10,
          taxBeforeCess: 0,
          cess: 0,
          estimatedTax: 0,
          isGrandfathered: false,
          isAnchorDependent: false,
        },
      ],
    };

    expect(() =>
      render(<TaxView summary={summaryWithUndefinedTaxType} harvesting={null} />)
    ).not.toThrow();
  });
});
