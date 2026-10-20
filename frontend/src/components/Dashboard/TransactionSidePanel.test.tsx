import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
  CheckCircle2: () => <div data-testid="check-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
}));
import { TransactionSidePanel } from './TransactionSidePanel';

describe('TransactionSidePanel', () => {
  const mockFolio = {
    id: '1',
    asset: { name: 'Test Fund' },
    metrics: { currentValue: 1000 },
    transactions: [
      { id: 't1', date: '2023-01-01', type: 'Buy', amount: 1000, units: 100, nav: 10 },
      { id: 't2', date: '2023-02-01', type: 'Sell', amount: -500, units: -40, nav: 12.5 },
    ]
  };

  it('renders nothing when folio is null', () => {
    const { container } = render(<TransactionSidePanel folio={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders transactions when folio is provided', () => {
    render(<TransactionSidePanel folio={mockFolio} onClose={vi.fn()} />);
    expect(screen.getByText('Test Fund')).toBeInTheDocument();
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<TransactionSidePanel folio={mockFolio} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render a Mark Closed button', () => {
    render(<TransactionSidePanel folio={mockFolio} onClose={vi.fn()} />);
    expect(screen.queryByText('Mark Closed')).not.toBeInTheDocument();
  });

  it('calls onDeleteFolio when Delete Folio button is clicked', async () => {
    const onDeleteFolio = vi.fn();
    render(<TransactionSidePanel folio={mockFolio} onClose={vi.fn()} onDeleteFolio={onDeleteFolio} />);
    const delBtn = screen.getByText('Delete Folio');
    fireEvent.click(delBtn);
    expect(onDeleteFolio).toHaveBeenCalledWith(mockFolio);
  });
});
