import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FolioRowActionButtons } from './FolioRowActionButtons';
import type { EnrichedFolioView } from '../../types/portfolio';

const sampleFolio: EnrichedFolioView = {
  id: 'f1',
  number: 'MANUAL-123',
  schemeName: 'Physical Gold',
  pan: 'ABCDE1234F',
  units: 10,
  asset: { id: 'a1', name: 'Physical Gold', type: 'GOLD' },
};

describe('FolioRowActionButtons', () => {
  it('renders action buttons and triggers callbacks', () => {
    const onSimulateSell = vi.fn();
    const onDeleteManualAsset = vi.fn().mockResolvedValue(undefined);

    render(
      <FolioRowActionButtons
        folio={sampleFolio}
        onSimulateSell={onSimulateSell}
        onDeleteManualAsset={onDeleteManualAsset}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(buttons[0]!);
    expect(onSimulateSell).toHaveBeenCalledWith(sampleFolio);
  });
});
