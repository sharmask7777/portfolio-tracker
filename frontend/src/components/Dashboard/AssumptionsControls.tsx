import React from 'react';

const STATUTORY_TAX_SLABS = [
  { label: '0%', value: 0.0 },
  { label: '10%', value: 0.10 },
  { label: '15%', value: 0.15 },
  { label: '20%', value: 0.20 },
  { label: '30%', value: 0.30 },
  { label: '39%', value: 0.39 },
];

const INFLATION_PRESETS = [
  { label: 'RBI 4%', value: 0.04 },
  { label: 'Baseline 6%', value: 0.06 },
  { label: 'Conservative 8%', value: 0.08 },
];

export const CpiInflationControl: React.FC<{
  cpiInflationRate: number;
  setCpiInflationRate: (rate: number) => void;
  localCpiInput: string;
  onCpiInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ cpiInflationRate, setCpiInflationRate, localCpiInput, onCpiInputChange }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
      <span>Annual CPI Inflation</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <input
          type="number"
          step="0.1"
          min="0"
          max="20"
          value={localCpiInput}
          onChange={onCpiInputChange}
          style={{
            width: '54px',
            padding: '0.2rem 0.3rem',
            fontSize: '0.75rem',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text-primary)',
            textAlign: 'right',
          }}
        />
        <span>%</span>
      </div>
    </div>
    <input
      type="range"
      min="0"
      max="0.12"
      step="0.005"
      value={cpiInflationRate}
      onChange={(e) => setCpiInflationRate(parseFloat(e.target.value))}
      style={{ width: '100%', cursor: 'pointer' }}
    />
    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
      {INFLATION_PRESETS.map((p) => {
        const isSelected = Math.abs(cpiInflationRate - p.value) < 0.001;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => setCpiInflationRate(p.value)}
            style={{
              flex: 1,
              padding: '0.25rem 0.4rem',
              fontSize: '0.6875rem',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
              color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  </div>
);

export const TaxSlabControl: React.FC<{
  marginalTaxBracket: number;
  setMarginalTaxBracket: (bracket: number) => void;
}> = ({ marginalTaxBracket, setMarginalTaxBracket }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
      <span>Marginal Income Tax Slab</span>
      <span style={{ fontWeight: 600 }}>{(marginalTaxBracket * 100).toFixed(0)}%</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
      {STATUTORY_TAX_SLABS.map((s) => {
        const isSelected = Math.abs(marginalTaxBracket - s.value) < 0.001;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => setMarginalTaxBracket(s.value)}
            style={{
              padding: '0.35rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
              color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  </div>
);
