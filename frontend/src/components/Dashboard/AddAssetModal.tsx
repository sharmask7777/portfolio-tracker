import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { X } from 'lucide-react';

interface AddAssetModalProps {
  onClose: () => void;
  onSuccess: () => void;
  profiles: any[];
  selectedProfileId: string | null;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({ onClose, onSuccess, profiles, selectedProfileId }) => {
  const [type, setType] = useState('EPF');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [profileId, setProfileId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedProfileId) {
      setProfileId(selectedProfileId);
    } else if (profiles.length > 0) {
      // Default to "My Portfolio" (usually the one without a managedProfileId)
      // Since profiles array comes from the API, we need to handle it.
      // If selectedProfileId is null, it typically means the "All" or "Primary" view is selected.
      setProfileId('');
    }
  }, [selectedProfileId, profiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !units) return;

    try {
      setLoading(true);
      await api.post(`${API_ENDPOINTS.PORTFOLIO}/manual-asset`, {
        type,
        name,
        units: parseFloat(units),
        balanceDate,
        profileId: profileId || null,
      });
      onSuccess();
      onClose();
    } catch (e) {
      alert('Failed to add asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Add Alternative Asset</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Assign to Family Member</label>
            <select 
              className="card" 
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', outline: 'none' }}
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              <option value="">My Primary Portfolio</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.pan})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Asset Type</label>
            <select 
              className="card" 
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', outline: 'none' }}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="EPF">EPF (8.25%)</option>
              <option value="PPF">PPF (7.1%)</option>
              <option value="SGB">SGB (Gold Bonds)</option>
              <option value="PHYSICAL_GOLD">Physical Gold</option>
              <option value="FIXED_DEPOSIT">Fixed Deposit</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Account/Asset Name</label>
            <input 
              type="text" 
              className="card" 
              placeholder="e.g. My EPF or 10g Gold Coin"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', outline: 'none' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {type.includes('GOLD') || type === 'SGB' ? 'Quantity (Grams)' : 'Current Balance (INR)'}
            </label>
            <input 
              type="number" 
              className="card" 
              placeholder="0.00"
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', outline: 'none' }}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Balance As Of Date</label>
            <input 
              type="date" 
              className="card" 
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', outline: 'none' }}
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add to Portfolio'}
          </button>
        </form>
      </div>
    </div>
  );
};
