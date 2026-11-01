import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FamilyManager } from './FamilyManager';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    FAMILY: '/api/family',
  },
}));

describe('FamilyManager Component', () => {
  it('renders family groups and triggers selection', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        { id: 'fam-1', name: 'Sharma Family', _count: { members: 3 } },
      ],
    });

    const handleSelect = vi.fn();
    render(<FamilyManager onSelect={handleSelect} selectedId={null} />);

    expect(screen.getByText('Family Groups')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Sharma Family (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sharma Family (3)'));
    expect(handleSelect).toHaveBeenCalledWith('fam-1');

    fireEvent.click(screen.getByText(/Individual View/));
    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('allows creating a new group', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'fam-2', name: 'Patel Family' } });

    render(<FamilyManager onSelect={vi.fn()} selectedId={null} />);

    fireEvent.click(screen.getByRole('button', { name: /New Group/ }));
    const input = screen.getByPlaceholderText('Family Name (e.g. Sharma Family)');
    fireEvent.change(input, { target: { value: 'Patel Family' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/family/create', { name: 'Patel Family' });
    });
  });
});
