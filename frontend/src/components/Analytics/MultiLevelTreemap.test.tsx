import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MultiLevelTreemap } from './MultiLevelTreemap';
import type { HierarchyNode } from '../../utils/hierarchy-builder';

describe('MultiLevelTreemap', () => {
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

  it('renders squarified SVG rectangles for root or sector children', () => {
    render(<MultiLevelTreemap rootNode={mockHierarchyTree} width={800} height={500} />);

    const svg = screen.getByRole('region', { name: /portfolio treemap/i });
    expect(svg).toBeInTheDocument();

    const tiles = screen.getAllByRole('button');
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('renders breadcrumb trail and updates when drilling down into sector', () => {
    render(<MultiLevelTreemap rootNode={mockHierarchyTree} width={800} height={500} />);

    // Initially at root
    const nav = screen.getByRole('navigation', { name: /hierarchy breadcrumbs/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('All Assets')).toBeInTheDocument();

    // Click on Equity tile
    const equityTile = screen.getByRole('button', { name: /Equity/i });
    fireEvent.click(equityTile);

    // Breadcrumb now contains Equity
    expect(screen.getByText('Equity')).toBeInTheDocument();

    // Click on Financial Services tile
    const finTile = screen.getByRole('button', { name: /Financial Services/i });
    fireEvent.click(finTile);

    // Breadcrumb now contains Financial Services
    expect(screen.getByText('Financial Services')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HDFC Bank Ltd./i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ICICI Bank Ltd./i })).toBeInTheDocument();
  });

  it('clicking breadcrumb or Zoom Out button navigates up one level', () => {
    render(<MultiLevelTreemap rootNode={mockHierarchyTree} width={800} height={500} />);

    // Drill down to Equity -> Financial Services
    fireEvent.click(screen.getByRole('button', { name: /Equity/i }));
    fireEvent.click(screen.getByRole('button', { name: /Financial Services/i }));
    expect(screen.getByText('HDFC Bank Ltd.')).toBeInTheDocument();

    // Click Zoom Out button
    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
    fireEvent.click(zoomOutBtn);

    // Now back at Equity level
    expect(screen.getByRole('button', { name: /Financial Services/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Technology/i })).toBeInTheDocument();

    // Click "All Assets" breadcrumb item
    const rootBreadcrumb = screen.getByRole('button', { name: 'All Assets' });
    fireEvent.click(rootBreadcrumb);

    // Now back at Root level
    expect(screen.getByRole('button', { name: /Equity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Debt/i })).toBeInTheDocument();
  });

  it('applies 4-tier tile dimension rules for text rendering', () => {
    // Large tile: >= 80x52 -> Name + Rupee Value + Percentage
    // Small tile: >= 50x32 -> Name + Percentage
    // Micro tile: < 50x32 -> Color block only (no text rendered)
    const tieredHierarchy: HierarchyNode = {
      id: 'root-tier',
      name: 'Root',
      depth: 'root',
      metrics: { signedValue: 100, layoutValue: 100, weightOfPortfolio: 1, weightOfAssetClass: 1, weightOfParent: 1 },
      color: '#000',
      textColor: '#fff',
      children: [
        {
          id: 'large-node',
          name: 'Large Cap Stock',
          depth: 'stock',
          metrics: { signedValue: 90, layoutValue: 90, weightOfPortfolio: 0.9, weightOfAssetClass: 0.9, weightOfParent: 0.9 },
          color: '#1d4ed8',
          textColor: '#fff',
        },
        {
          id: 'tiny-node',
          name: 'Micro Small Cap',
          depth: 'stock',
          metrics: { signedValue: 1, layoutValue: 1, weightOfPortfolio: 0.01, weightOfAssetClass: 0.01, weightOfParent: 0.01 },
          color: '#059669',
          textColor: '#fff',
        },
      ],
    };

    render(<MultiLevelTreemap rootNode={tieredHierarchy} width={100} height={100} />);

    // Large node has text
    expect(screen.getByText('Large Cap Stock')).toBeInTheDocument();
    // Tiny node does NOT render text inside SVG to avoid visual clutter
    expect(screen.queryByText('Micro Small Cap')).not.toBeInTheDocument();
  });

  it('clicking a stock leaf node triggers onSelectStock / selection', () => {
    const handleSelectStock = vi.fn();
    render(
      <MultiLevelTreemap
        rootNode={mockHierarchyTree}
        width={800}
        height={500}
        onSelectStock={handleSelectStock}
      />
    );

    // Drill down to stock level
    fireEvent.click(screen.getByRole('button', { name: /Equity/i }));
    fireEvent.click(screen.getByRole('button', { name: /Financial Services/i }));

    const hdfcTile = screen.getByRole('button', { name: /HDFC Bank Ltd./i });
    fireEvent.click(hdfcTile);

    expect(handleSelectStock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'HDFC Bank Ltd.',
        depth: 'stock',
      })
    );
  });

  it('supports roving tabindex keyboard navigation and aria-live announcements', () => {
    render(<MultiLevelTreemap rootNode={mockHierarchyTree} width={800} height={500} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    const equityTile = screen.getByRole('button', { name: /Equity/i });
    equityTile.focus();

    // Press ArrowRight to move focus
    fireEvent.keyDown(equityTile, { key: 'ArrowRight' });
    const debtTile = screen.getByRole('button', { name: /Debt/i });
    expect(document.activeElement).toBe(debtTile);

    // Press ArrowLeft to move back
    fireEvent.keyDown(debtTile, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(equityTile);

    // Press Enter to drill down
    fireEvent.keyDown(equityTile, { key: 'Enter' });
    expect(screen.getByText('Financial Services')).toBeInTheDocument();
    expect(liveRegion.textContent).toContain('Equity');

    // Press Escape to zoom out
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /Equity/i })).toBeInTheDocument();
    expect(liveRegion.textContent).toContain('All Assets');
  });

  it('renders hatched stripes pattern for hedged arbitrage nodes', () => {
    const hedgedHierarchy: HierarchyNode = {
      id: 'root-hedged',
      name: 'Root',
      depth: 'root',
      metrics: { signedValue: 100, layoutValue: 100, weightOfPortfolio: 1, weightOfAssetClass: 1, weightOfParent: 1 },
      color: '#000',
      textColor: '#fff',
      children: [
        {
          id: 'arbitrage-hedged-stock',
          name: 'Hedged Reliance Cash-Futures',
          depth: 'stock',
          isHedged: true,
          metrics: { signedValue: 100, layoutValue: 100, weightOfPortfolio: 1, weightOfAssetClass: 1, weightOfParent: 1 },
          color: '#0d9488',
          textColor: '#fff',
        },
      ],
    };

    const { container } = render(<MultiLevelTreemap rootNode={hedgedHierarchy} width={400} height={300} />);
    const pattern = container.querySelector('#hedged-stripes');
    expect(pattern).toBeInTheDocument();

    const hedgedRect = container.querySelector('rect[fill*="hedged-stripes"]');
    expect(hedgedRect).toBeInTheDocument();
  });
});
