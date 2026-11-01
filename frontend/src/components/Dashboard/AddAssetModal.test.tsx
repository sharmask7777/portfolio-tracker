import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddAssetModal } from './AddAssetModal';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    PORTFOLIO: '/api/portfolio',
  },
}));

describe('AddAssetModal Component', () => {
  const mockProfiles = [
    { id: 'prof-1', name: 'Aarav Sharma', pan: 'ABCDE1234F' },
  ];

  it('renders modal fields correctly', () => {
    render(
      <AddAssetModal
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        profiles={mockProfiles}
        selectedProfileId={null}
      />
    );

    expect(screen.getByText('Add Alternative Asset')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. My EPF or 10g Gold Coin')).toBeInTheDocument();
  });

  it('submits manual asset payload on submit', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

    render(
      <AddAssetModal
        onClose={handleClose}
        onSuccess={handleSuccess}
        profiles={mockProfiles}
        selectedProfileId="prof-1"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. My EPF or 10g Gold Coin'), {
      target: { value: 'My Test EPF' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '50000' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add to Portfolio' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/portfolio/manual-asset', expect.objectContaining({
        name: 'My Test EPF',
        units: 50000,
        profileId: 'prof-1',
      }));
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
