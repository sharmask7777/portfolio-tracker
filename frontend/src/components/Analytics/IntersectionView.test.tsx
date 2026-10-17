import { render, screen, fireEvent } from '@testing-library/react';
import { IntersectionView, type StockExposure } from './IntersectionView';
import { describe, it, expect, vi } from 'vitest';

describe('IntersectionView Component', () => {
  const mockExposures: StockExposure[] = [
    {
      name: 'HDFC Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 150000,
      percentage: 0.15,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 82000, weight: 8.2 },
        { schemeName: 'HDFC Flexi Cap Fund', value: 68000, weight: 8.8 },
      ],
    },
    {
      name: 'Reliance Industries Ltd.',
      sector: 'Energy',
      absoluteValue: 100000,
      percentage: 0.10,
      contributions: [
        { schemeName: 'SBI Bluechip Fund', value: 100000, weight: 6.8 },
      ],
    },
    {
      name: 'Infosys Ltd.',
      sector: 'Technology',
      absoluteValue: 80000,
      percentage: 0.08,
      contributions: [
        { schemeName: 'HDFC Flexi Cap Fund', value: 80000, weight: 7.2 },
      ],
    },
  ];

  it('renders loading skeleton when isLoading is true without showing empty state', () => {
    render(<IntersectionView exposures={[]} isLoading={true} />);

    expect(screen.queryByText(/No Stock Exposures Identified/i)).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(6); // 1 header + 5 skeleton rows
  });

  it('renders empty state card with CTA when exposures array is empty and not loading', () => {
    const handleUpload = vi.fn();
    render(<IntersectionView exposures={[]} isLoading={false} onUploadClick={handleUpload} />);

    expect(screen.getByText('No Stock Exposures Identified')).toBeInTheDocument();
    expect(screen.getByText(/We could not find active equity mutual funds/i)).toBeInTheDocument();

    const uploadBtn = screen.getByRole('button', { name: /Upload CAS Statement/i });
    expect(uploadBtn).toBeInTheDocument();
    fireEvent.click(uploadBtn);
    expect(handleUpload).toHaveBeenCalledTimes(1);
  });

  it('renders table with stock exposures, percentage, value, and contributing fund breakdown', () => {
    render(<IntersectionView exposures={mockExposures} />);

    // Table rows
    expect(screen.getByText('HDFC Bank Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Reliance Industries Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Infosys Ltd.')).toBeInTheDocument();

    // Sector tags (present in both dropdown option and table cell)
    expect(screen.getAllByText('Financial Services').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Energy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Technology').length).toBeGreaterThanOrEqual(1);

    // Percentages
    expect(screen.getByText('15.00%')).toBeInTheDocument();
    expect(screen.getByText('10.00%')).toBeInTheDocument();
    expect(screen.getByText('8.00%')).toBeInTheDocument();

    // Multi-fund overlap badge on HDFC Bank Ltd.
    expect(screen.getByText('2 Funds Overlap')).toBeInTheDocument();

    // Contributing fund tags with weights
    expect(screen.getByText(/Parag Parikh Flexi Cap Fund/i)).toBeInTheDocument();
    expect(screen.getByText('(8.2%)')).toBeInTheDocument();
    expect(screen.getByText(/SBI Bluechip Fund/i)).toBeInTheDocument();
  });

  it('filters stock rows dynamically by search query', () => {
    render(<IntersectionView exposures={mockExposures} />);

    const searchInput = screen.getByPlaceholderText(/Search stocks, sectors, or funds/i);
    fireEvent.change(searchInput, { target: { value: 'Reliance' } });

    expect(screen.getByText('Reliance Industries Ltd.')).toBeInTheDocument();
    expect(screen.queryByText('HDFC Bank Ltd.')).not.toBeInTheDocument();
    expect(screen.queryByText('Infosys Ltd.')).not.toBeInTheDocument();

    // Clearing search restores rows
    const clearBtn = screen.getByRole('button', { name: /Clear search/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('HDFC Bank Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Infosys Ltd.')).toBeInTheDocument();
  });

  it('filters stock rows by selected sector dropdown', () => {
    render(<IntersectionView exposures={mockExposures} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Technology' } });

    expect(screen.getByText('Infosys Ltd.')).toBeInTheDocument();
    expect(screen.queryByText('HDFC Bank Ltd.')).not.toBeInTheDocument();
    expect(screen.queryByText('Reliance Industries Ltd.')).not.toBeInTheDocument();
  });

  it('sorts table rows when clicking column headers', () => {
    render(<IntersectionView exposures={mockExposures} />);

    // Default sort is percentage desc: HDFC (15%) -> Reliance (10%) -> Infosys (8%)
    const rowsInitial = screen.getAllByRole('row').slice(1);
    expect(rowsInitial[0]).toHaveTextContent('HDFC Bank Ltd.');
    expect(rowsInitial[2]).toHaveTextContent('Infosys Ltd.');

    // Click 'Stock Name' header to sort ascending: HDFC -> Infosys -> Reliance
    const nameHeader = screen.getByText(/Stock Name/i);
    fireEvent.click(nameHeader);

    const rowsSortedName = screen.getAllByRole('row').slice(1);
    expect(rowsSortedName[0]).toHaveTextContent('HDFC Bank Ltd.');
    expect(rowsSortedName[1]).toHaveTextContent('Infosys Ltd.');
    expect(rowsSortedName[2]).toHaveTextContent('Reliance Industries Ltd.');
  });
});
