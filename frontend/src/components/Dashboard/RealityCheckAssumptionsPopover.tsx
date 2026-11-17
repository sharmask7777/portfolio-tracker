import React, { useRef, useEffect } from 'react';
import { Sliders } from 'lucide-react';
import { CpiInflationControl, TaxSlabControl } from './AssumptionsControls';

interface RealityCheckAssumptionsPopoverProps {
  cpiInflationRate: number;
  setCpiInflationRate: (rate: number) => void;
  marginalTaxBracket: number;
  setMarginalTaxBracket: (bracket: number) => void;
  showAssumptions: boolean;
  setShowAssumptions: (show: boolean) => void;
  localCpiInput: string;
  onCpiInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const RealityCheckAssumptionsPopover: React.FC<RealityCheckAssumptionsPopoverProps> = ({
  cpiInflationRate,
  setCpiInflationRate,
  marginalTaxBracket,
  setMarginalTaxBracket,
  showAssumptions,
  setShowAssumptions,
  localCpiInput,
  onCpiInputChange,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowAssumptions(false);
      }
    };
    if (showAssumptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssumptions, setShowAssumptions]);

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowAssumptions(!showAssumptions)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        <Sliders size={13} />
        Assumptions: CPI {(cpiInflationRate * 100).toFixed(0)}% · Slab{' '}
        {(marginalTaxBracket * 100).toFixed(0)}%
      </button>

      {showAssumptions && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 50,
            width: '320px',
            padding: '1.25rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
              Reality Check Assumptions
            </span>
            <button
              type="button"
              onClick={() => setShowAssumptions(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <CpiInflationControl
            cpiInflationRate={cpiInflationRate}
            setCpiInflationRate={setCpiInflationRate}
            localCpiInput={localCpiInput}
            onCpiInputChange={onCpiInputChange}
          />

          <TaxSlabControl
            marginalTaxBracket={marginalTaxBracket}
            setMarginalTaxBracket={setMarginalTaxBracket}
          />
        </div>
      )}
    </div>
  );
};
