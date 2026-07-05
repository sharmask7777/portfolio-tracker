import { render, screen, fireEvent } from '@testing-library/react';
import { TaxView } from './TaxView';
import { describe, it, expect, vi } from 'vitest';

describe('TaxView empty export CSV alert', () => {
  it('triggers alert when exporting empty gains', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    const mockSummary = {
      details: [],
      hasSyntheticAnchors: false
    };
    
    render(<TaxView summary={mockSummary} harvesting={null} />);
    
    const exportButton = screen.getByRole('button', { name: /Export ITR Report/i });
    fireEvent.click(exportButton);
    
    expect(alertMock).toHaveBeenCalledWith('No realized gains found for this period to export.');
    alertMock.mockRestore();
  });
});
