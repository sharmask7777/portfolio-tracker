import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TransactionHistoryModal } from './TransactionHistoryModal';

describe('TransactionHistoryModal', () => {
  it('renders null when folio is null', () => {
    const { container } = render(
      <TransactionHistoryModal folio={null} onClose={vi.fn()} onDeleteFolio={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders transactions and closes on button click', () => {
    const onClose = vi.fn();
    render(
      <TransactionHistoryModal
        folio={{
          id: 'f1',
          number: '111/22',
          asset: { name: 'Nifty 50 Index Fund' },
          transactions: [
            {
              id: 't1',
              date: '2024-01-15',
              type: 'PURCHASE',
              amount: 10000,
              units: 100,
              nav: 100,
            },
          ],
        }}
        onClose={onClose}
        onDeleteFolio={vi.fn()}
      />
    );

    expect(screen.getByText(/Nifty 50 Index Fund/i)).toBeInTheDocument();
    expect(screen.getByText(/111\/22/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
