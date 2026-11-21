import { render, screen, fireEvent } from '@testing-library/react';
import { FamilySelector } from './FamilySelector';
import { describe, it, expect, vi } from 'vitest';
import type { PanBreakdownDto } from '../../types/generated/PanBreakdownDto';

describe('FamilySelector', () => {
  const profiles = [
    { id: '1', name: 'Self', pan: 'ABCDE1234F' },
    { id: '2', name: 'Spouse', pan: 'WXYZP9876Q' }
  ];

  it('renders consolidated and individual profiles', () => {
    render(<FamilySelector profiles={profiles} selectedProfileId={null} onSelect={() => {}} onRename={() => {}} />);
    expect(screen.getByText(/Consolidated Family/)).toBeDefined();
    expect(screen.getByText(/Self/)).toBeDefined();
    expect(screen.getByText(/Spouse/)).toBeDefined();
  });

  it('renders member PAN badge and corpus share badge when panBreakdowns are supplied', () => {
    const panBreakdowns: PanBreakdownDto[] = [
      {
        pan: 'ABCDE1234F',
        memberName: 'Self',
        investedAmount: 60000,
        currentValue: 600000,
        dayChange: 1000,
        dayChangePercentage: 0.17,
        xirr: 0.15,
        folioCount: 3,
      },
      {
        pan: 'WXYZP9876Q',
        memberName: 'Spouse',
        investedAmount: 40000,
        currentValue: 400000,
        dayChange: 500,
        dayChangePercentage: 0.12,
        xirr: 0.12,
        folioCount: 2,
      },
    ];

    render(
      <FamilySelector
        profiles={profiles}
        selectedProfileId={null}
        onSelect={() => {}}
        onRename={() => {}}
        panBreakdowns={panBreakdowns}
      />
    );

    // Verify PAN badges rendered
    expect(screen.getByText('ABCDE1234F')).toBeDefined();
    expect(screen.getByText('WXYZP9876Q')).toBeDefined();

    // Verify corpus share badges rendered (60% and 40%)
    expect(screen.getByText('60% of corpus')).toBeDefined();
    expect(screen.getByText('40% of corpus')).toBeDefined();

    // Verify aggregate total count on Consolidated chip (2 PANs • 5 Folios)
    expect(screen.getByText('2 PANs • 5 Folios')).toBeDefined();
  });

  it('calls onSelect when a profile is clicked', () => {
    const onSelect = vi.fn();
    render(<FamilySelector profiles={profiles} selectedProfileId={null} onSelect={onSelect} onRename={() => {}} />);
    
    fireEvent.click(screen.getByText(/Spouse/));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('calls onRename when edit icon is clicked', () => {
    const onRename = vi.fn();
    render(<FamilySelector profiles={profiles} selectedProfileId={null} onSelect={() => {}} onRename={onRename} />);
    
    // Find edit button (assuming it's near the profile name)
    const editButtons = screen.getAllByTitle('Rename Profile');
    const firstEdit = editButtons[0];
    expect(firstEdit).toBeDefined();
    if (!firstEdit) throw new Error('No edit button');
    fireEvent.click(firstEdit);
    expect(onRename).toHaveBeenCalledWith(profiles[0]);
  });

  it('calls onDelete when delete icon is clicked', () => {
    const onDelete = vi.fn();
    render(<FamilySelector profiles={profiles} selectedProfileId={null} onSelect={() => {}} onRename={() => {}} onDelete={onDelete} />);
    
    const deleteButtons = screen.getAllByTitle('Delete Profile');
    const secondDelete = deleteButtons[1];
    expect(secondDelete).toBeDefined();
    if (!secondDelete) throw new Error('No delete button');
    fireEvent.click(secondDelete);
    expect(onDelete).toHaveBeenCalledWith(profiles[1]);
  });
});
