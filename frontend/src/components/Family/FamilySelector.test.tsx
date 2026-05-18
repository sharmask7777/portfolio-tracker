import { render, screen, fireEvent } from '@testing-library/react';
import { FamilySelector } from './FamilySelector';
import { describe, it, expect, vi } from 'vitest';


describe('FamilySelector', () => {
  const profiles = [
    { id: '1', name: 'Self', pan: 'PAN1' },
    { id: '2', name: 'Spouse', pan: 'PAN2' }
  ];

  it('renders consolidated and individual profiles', () => {
    render(<FamilySelector profiles={profiles} selectedProfileId={null} onSelect={() => {}} onRename={() => {}} />);
    expect(screen.getByText(/Consolidated Family/)).toBeDefined();
    expect(screen.getByText(/Self/)).toBeDefined();
    expect(screen.getByText(/Spouse/)).toBeDefined();
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
    fireEvent.click(editButtons[0]);
    expect(onRename).toHaveBeenCalledWith(profiles[0]);
  });
});
