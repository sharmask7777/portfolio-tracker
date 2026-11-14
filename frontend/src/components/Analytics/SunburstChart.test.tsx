import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SunburstChart } from './SunburstChart';
import type { HierarchyNode } from '../../utils/hierarchy-builder';

describe('SunburstChart', () => {
  const mockHierarchyTree: HierarchyNode = {
    id: 'root-portfolio',
    name: 'Total Portfolio',
    depth: 'root',
    metrics: {
      signedValue: 10000000,
      layoutValue: 10000000,
      weightOfPortfolio: 1,
      weightOfAssetClass: 1,
      weightOfParent: 1,
    },
    color: '#0f172a',
    textColor: '#ffffff',
    children: [
      {
        id: 'asset-equity',
        name: 'Equity',
        depth: 'assetClass',
        metrics: {
          signedValue: 7000000,
          layoutValue: 7000000,
          weightOfPortfolio: 0.7,
          weightOfAssetClass: 1,
          weightOfParent: 0.7,
        },
        color: '#2563eb',
        textColor: '#ffffff',
        children: [
          {
            id: 'sector-financial-services',
            name: 'Financial Services',
            depth: 'sector',
            sector: 'Financial Services',
            metrics: {
              signedValue: 3500000,
              layoutValue: 3500000,
              weightOfPortfolio: 0.35,
              weightOfAssetClass: 0.5,
              weightOfParent: 0.5,
              weightOfSector: 1,
            },
            color: '#1d4ed8',
            textColor: '#ffffff',
            children: [
              {
                id: 'stock-hdfc-bank-ltd',
                name: 'HDFC Bank Ltd.',
                depth: 'stock',
                sector: 'Financial Services',
                metrics: {
                  signedValue: 2000000,
                  layoutValue: 2000000,
                  weightOfPortfolio: 0.2,
                  weightOfAssetClass: 0.2857,
                  weightOfParent: 0.5714,
                  weightOfSector: 0.5714,
                },
                color: '#1d4ed8',
                textColor: '#ffffff',
                schemeCount: 3,
                contributions: [
                  { schemeName: 'Fund A', value: 1200000, weight: 0.08 },
                  { schemeName: 'Fund B', value: 800000, weight: 0.05 },
                ],
              },
              {
                id: 'stock-icici-bank-ltd',
                name: 'ICICI Bank Ltd.',
                depth: 'stock',
                sector: 'Financial Services',
                metrics: {
                  signedValue: 1500000,
                  layoutValue: 1500000,
                  weightOfPortfolio: 0.15,
                  weightOfAssetClass: 0.2143,
                  weightOfParent: 0.4286,
                  weightOfSector: 0.4286,
                },
                color: '#1d4ed8',
                textColor: '#ffffff',
                schemeCount: 2,
                contributions: [
                  { schemeName: 'Fund A', value: 900000, weight: 0.06 },
                  { schemeName: 'Fund B', value: 600000, weight: 0.04 },
                ],
              },
            ],
          },
          {
            id: 'sector-technology',
            name: 'Technology',
            depth: 'sector',
            sector: 'Technology',
            metrics: {
              signedValue: 3500000,
              layoutValue: 3500000,
              weightOfPortfolio: 0.35,
              weightOfAssetClass: 0.5,
              weightOfParent: 0.5,
              weightOfSector: 1,
            },
            color: '#0284c7',
            textColor: '#ffffff',
            children: [
              {
                id: 'stock-infosys-ltd',
                name: 'Infosys Ltd.',
                depth: 'stock',
                sector: 'Technology',
                metrics: {
                  signedValue: 3500000,
                  layoutValue: 3500000,
                  weightOfPortfolio: 0.35,
                  weightOfAssetClass: 0.5,
                  weightOfParent: 1,
                  weightOfSector: 1,
                },
                color: '#0284c7',
                textColor: '#ffffff',
                schemeCount: 2,
                contributions: [
                  { schemeName: 'Fund A', value: 2000000, weight: 0.1 },
                  { schemeName: 'Fund B', value: 1500000, weight: 0.07 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'asset-debt',
        name: 'Debt',
        depth: 'assetClass',
        metrics: {
          signedValue: 3000000,
          layoutValue: 3000000,
          weightOfPortfolio: 0.3,
          weightOfAssetClass: 1,
          weightOfParent: 0.3,
        },
        color: '#7c3aed',
        textColor: '#ffffff',
        children: [],
      },
    ],
  };

  it('renders concentric SVG arc paths for each depth tier', () => {
    const { container } = render(
      <SunburstChart rootNode={mockHierarchyTree} width={600} height={600} />
    );

    const svg = screen.getByRole('region', { name: /portfolio sunburst/i });
    expect(svg).toBeInTheDocument();

    // Check for arc paths
    const arcPaths = container.querySelectorAll('path[data-depth]');
    expect(arcPaths.length).toBeGreaterThan(0);

    // Verify presence of depth attributes: assetClass, sector, stock
    const depths = Array.from(arcPaths).map(p => p.getAttribute('data-depth'));
    expect(depths).toContain('assetClass');
    expect(depths).toContain('sector');
    expect(depths).toContain('stock');
  });

  it('partitions parent angular span among children: sum(delta_theta_children) === delta_theta_parent', () => {
    const { container } = render(
      <SunburstChart rootNode={mockHierarchyTree} width={600} height={600} />
    );

    // Get assetClass arcs
    const equityPath = container.querySelector('path[data-id="asset-equity"]');
    const debtPath = container.querySelector('path[data-id="asset-debt"]');
    expect(equityPath).toBeInTheDocument();
    expect(debtPath).toBeInTheDocument();

    const equityStart = parseFloat(equityPath?.getAttribute('data-start-angle') ?? '0');
    const equityEnd = parseFloat(equityPath?.getAttribute('data-end-angle') ?? '0');
    const equitySpan = equityEnd - equityStart;

    // Financial Services and Technology are children of Equity
    const finPath = container.querySelector('path[data-id="sector-financial-services"]');
    const techPath = container.querySelector('path[data-id="sector-technology"]');
    expect(finPath).toBeInTheDocument();
    expect(techPath).toBeInTheDocument();

    const finStart = parseFloat(finPath?.getAttribute('data-start-angle') ?? '0');
    const finEnd = parseFloat(finPath?.getAttribute('data-end-angle') ?? '0');
    const techStart = parseFloat(techPath?.getAttribute('data-start-angle') ?? '0');
    const techEnd = parseFloat(techPath?.getAttribute('data-end-angle') ?? '0');

    const childrenSpan = (finEnd - finStart) + (techEnd - techStart);
    expect(Math.abs(childrenSpan - equitySpan)).toBeLessThan(0.001);
  });

  it('coalesces slices with angular span < 1.5 deg into an Other (<0.4%) segment', () => {
    const microHierarchy: HierarchyNode = {
      id: 'root-micro',
      name: 'Root',
      depth: 'root',
      metrics: { signedValue: 100000, layoutValue: 100000, weightOfPortfolio: 1, weightOfAssetClass: 1, weightOfParent: 1 },
      color: '#000',
      textColor: '#fff',
      children: [
        {
          id: 'large-asset',
          name: 'Main Equity',
          depth: 'assetClass',
          metrics: { signedValue: 99700, layoutValue: 99700, weightOfPortfolio: 0.997, weightOfAssetClass: 1, weightOfParent: 0.997 },
          color: '#2563eb',
          textColor: '#fff',
          children: [
            {
              id: 'large-sector',
              name: 'Large Sector',
              depth: 'sector',
              metrics: { signedValue: 99700, layoutValue: 99700, weightOfPortfolio: 0.997, weightOfAssetClass: 1, weightOfParent: 1 },
              color: '#1d4ed8',
              textColor: '#fff',
              children: [
                {
                  id: 'major-stock',
                  name: 'Major Stock',
                  depth: 'stock',
                  metrics: { signedValue: 99400, layoutValue: 99400, weightOfPortfolio: 0.994, weightOfAssetClass: 0.997, weightOfParent: 0.997 },
                  color: '#1d4ed8',
                  textColor: '#fff',
                },
                {
                  id: 'micro-stock-1',
                  name: 'Micro Stock 1',
                  depth: 'stock',
                  metrics: { signedValue: 150, layoutValue: 150, weightOfPortfolio: 0.0015, weightOfAssetClass: 0.0015, weightOfParent: 0.0015 },
                  color: '#1d4ed8',
                  textColor: '#fff',
                },
                {
                  id: 'micro-stock-2',
                  name: 'Micro Stock 2',
                  depth: 'stock',
                  metrics: { signedValue: 150, layoutValue: 150, weightOfPortfolio: 0.0015, weightOfAssetClass: 0.0015, weightOfParent: 0.0015 },
                  color: '#1d4ed8',
                  textColor: '#fff',
                },
              ],
            },
          ],
        },
        {
          id: 'small-asset',
          name: 'Tiny Cash',
          depth: 'assetClass',
          metrics: { signedValue: 300, layoutValue: 300, weightOfPortfolio: 0.003, weightOfAssetClass: 1, weightOfParent: 0.003 },
          color: '#059669',
          textColor: '#fff',
          children: [],
        },
      ],
    };

    const { container } = render(<SunburstChart rootNode={microHierarchy} width={600} height={600} />);
    // The two micro stocks each have 150 / 100,000 = 0.15% which is < 0.4% (< 1.5 deg in full circle).
    // They should be coalesced into an Other (<0.4%) node.
    const otherPath = container.querySelector('path[data-name*="Other (<0.4%)"]');
    expect(otherPath).toBeInTheDocument();
  });

  it('expands outer radius to R_max for ragged hierarchy leaf nodes at depth d < D_max', () => {
    const { container } = render(
      <SunburstChart rootNode={mockHierarchyTree} width={600} height={600} />
    );

    // Debt is at depth 1 (assetClass) and has no children, so it's a leaf.
    // D_max is 3 (stock level).
    // Debt arc outer radius must be extended to R_max to prevent empty outer annular rings.
    const debtPath = container.querySelector('path[data-id="asset-debt"]');
    expect(debtPath).toBeInTheDocument();

    const rOut = parseFloat(debtPath?.getAttribute('data-r-out') ?? '0');
    // R_max for width=600, height=600 is min(600, 600)/2 - 16 = 300 - 16 = 284
    expect(rOut).toBeCloseTo(284, 0);
  });

  it('renders interactive Center Summary Hub with default portfolio net worth and updates on hover/focus', () => {
    const { container } = render(
      <SunburstChart rootNode={mockHierarchyTree} width={600} height={600} />
    );

    // Center summary hub displays default portfolio net worth when idle
    const hub = screen.getByTestId('center-summary-hub');
    expect(hub).toBeInTheDocument();
    expect(screen.getByText('Total Portfolio')).toBeInTheDocument();
    // 10000000 formatted in Cr: ₹1.00 Cr
    expect(screen.getByText(/₹1\.00 Cr/)).toBeInTheDocument();

    // Hover an arc segment (Equity)
    const equityPath = container.querySelector('path[data-id="asset-equity"]');
    expect(equityPath).not.toBeNull();
    fireEvent.mouseEnter(equityPath!);

    // Hub updates with segment name, value, and dual percentages (% of Portfolio | % of Parent)
    expect(screen.getByText('Equity')).toBeInTheDocument();
    expect(screen.getByText(/₹70\.00 L/)).toBeInTheDocument();
    expect(screen.getByText(/70\.0% of Portfolio/)).toBeInTheDocument();

    // Mouse leave restores root default
    fireEvent.mouseLeave(equityPath!);
    expect(screen.getByText('Total Portfolio')).toBeInTheDocument();
  });

  it('supports mobile tap-to-lock interaction: first tap locks, second tap triggers action, background unlocks', () => {
    const handleSelectStock = vi.fn();
    const handleDrilldown = vi.fn();

    const { container } = render(
      <SunburstChart
        rootNode={mockHierarchyTree}
        width={600}
        height={600}
        onSelectStock={handleSelectStock}
        onDrilldown={handleDrilldown}
      />
    );

    const hdfcPath = container.querySelector('path[data-id="stock-hdfc-bank-ltd"]');
    expect(hdfcPath).not.toBeNull();

    // First tap: locks the center hub to HDFC Bank Ltd.
    fireEvent.click(hdfcPath!);
    expect(screen.getByText('HDFC Bank Ltd.')).toBeInTheDocument();
    expect(handleSelectStock).not.toHaveBeenCalled();

    // Hovering away should NOT reset because it is locked
    fireEvent.mouseLeave(hdfcPath!);
    expect(screen.getByText('HDFC Bank Ltd.')).toBeInTheDocument();

    // Second tap on the locked segment triggers selection
    fireEvent.click(hdfcPath!);
    expect(handleSelectStock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'HDFC Bank Ltd.',
        depth: 'stock',
      })
    );

    // Clicking background / SVG backdrop unlocks and resets
    const backdrop = container.querySelector('rect[data-testid="sunburst-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.getByText('Total Portfolio')).toBeInTheDocument();
  });

  it('supports keyboard navigation (ArrowRight, ArrowLeft, Enter/Space) and ARIA attributes', () => {
    const handleDrilldown = vi.fn();
    const { container } = render(
      <SunburstChart
        rootNode={mockHierarchyTree}
        width={600}
        height={600}
        onDrilldown={handleDrilldown}
      />
    );

    const arcs = container.querySelectorAll('path[role="button"]');
    expect(arcs.length).toBeGreaterThan(0);

    const firstArc = arcs[0] as SVGPathElement;
    firstArc.focus();

    // Press ArrowRight to cycle to next arc
    fireEvent.keyDown(firstArc, { key: 'ArrowRight' });
    const secondArc = arcs[1] as SVGPathElement;
    expect(document.activeElement).toBe(secondArc);

    // Press ArrowLeft to cycle back
    fireEvent.keyDown(secondArc, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(firstArc);

    // Press Enter to trigger selection/drilldown
    fireEvent.keyDown(firstArc, { key: 'Enter' });
    // First Enter locks, second Enter triggers drilldown/selection
    fireEvent.keyDown(firstArc, { key: 'Enter' });
    expect(handleDrilldown).toHaveBeenCalled();
  });
});
