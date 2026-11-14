import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StockDetailDrawer } from './StockDetailDrawer';
import type { HierarchyNode } from '../../utils/hierarchy-builder';

describe('StockDetailDrawer', () => {
  const mockNode: HierarchyNode = {
    id: 'stock-hdfc-bank-ltd',
    name: 'HDFC Bank Ltd.',
    depth: 'stock',
    sector: 'Financial Services',
    metrics: {
      signedValue: 450000,
      layoutValue: 450000,
      weightOfPortfolio: 0.045,
      weightOfAssetClass: 0.075,
      weightOfParent: 0.15,
      weightOfSector: 0.25,
    },
    color: '#1d4ed8',
    textColor: '#ffffff',
    schemeCount: 3,
    contributions: [
      {
        schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan',
        value: 250000,
        weight: 0.08,
      },
      {
        schemeName: 'Mirae Asset Large Cap Fund - Direct Plan',
        value: 120000,
        weight: 0.065,
      },
      {
        schemeName: 'HDFC Top 100 Fund - Direct Plan',
        value: 80000,
        weight: 0.05,
      },
    ],
  };

  it('renders stock name, sector badge, total rupee value formatted in Indian rupees, and percentage', () => {
    render(<StockDetailDrawer isOpen={true} node={mockNode} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'HDFC Bank Ltd.' })).toBeInTheDocument();
    expect(screen.getByText('Financial Services')).toBeInTheDocument();
    expect(screen.getByText('₹4.50 L')).toBeInTheDocument();
    expect(screen.getByText('4.50% of Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Present in 3 Mutual Funds')).toBeInTheDocument();
  });

  it('renders list of contributing schemes with weight, value, and visual progress bar', () => {
    render(<StockDetailDrawer isOpen={true} node={mockNode} onClose={vi.fn()} />);

    expect(screen.getByText('Parag Parikh Flexi Cap Fund - Direct Plan')).toBeInTheDocument();
    expect(screen.getByText('Mirae Asset Large Cap Fund - Direct Plan')).toBeInTheDocument();
    expect(screen.getByText('HDFC Top 100 Fund - Direct Plan')).toBeInTheDocument();

    expect(screen.getAllByText('₹2.50 L').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹1.20 L').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹80,000').length).toBeGreaterThan(0);

    expect(screen.getByText('8.00% fund weight')).toBeInTheDocument();
    expect(screen.getByText('6.50% fund weight')).toBeInTheDocument();
    expect(screen.getByText('5.00% fund weight')).toBeInTheDocument();

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(3);
  });

  it('dispatches onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<StockDetailDrawer isOpen={true} node={mockNode} onClose={handleClose} />);

    const closeButton = screen.getByRole('button', { name: /close drawer/i });
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('dispatches onClose when backdrop overlay is clicked', () => {
    const handleClose = vi.fn();
    render(<StockDetailDrawer isOpen={true} node={mockNode} onClose={handleClose} />);

    const backdrop = screen.getByTestId('drawer-backdrop');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('dispatches onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<StockDetailDrawer isOpen={true} node={mockNode} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('dispatches onInspectInIntersection when CTA button is clicked', () => {
    const handleInspect = vi.fn();
    render(
      <StockDetailDrawer
        isOpen={true}
        node={mockNode}
        onClose={vi.fn()}
        onInspectInIntersection={handleInspect}
      />
    );

    const inspectButton = screen.getByRole('button', { name: /inspect in stock intersection/i });
    fireEvent.click(inspectButton);

    expect(handleInspect).toHaveBeenCalledWith('HDFC Bank Ltd.');
  });

  it('does not render when isOpen is false or node is null', () => {
    const { rerender } = render(<StockDetailDrawer isOpen={false} node={mockNode} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(<StockDetailDrawer isOpen={true} node={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
