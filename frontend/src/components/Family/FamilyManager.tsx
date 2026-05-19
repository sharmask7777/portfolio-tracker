import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { Users, Plus, Check } from 'lucide-react';

interface FamilyManagerProps {
  onSelect: (groupId: string | null) => void;
  selectedId: string | null;
}

export const FamilyManager: React.FC<FamilyManagerProps> = ({ onSelect, selectedId }) => {
  const [families, setFamilies] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  const fetchFamilies = async () => {
    try {
      const res = await api.get(`${API_ENDPOINTS.FAMILY}/list`);
      setFamilies(res.data);
    } catch (e) {
      console.error('Failed to fetch families', e);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  const handleCreate = async () => {
    if (!name) return;
    try {
      await api.post(`${API_ENDPOINTS.FAMILY}/create`, { name });
      setName('');
      setShowCreate(false);
      fetchFamilies();
    } catch (e) {
      alert('Failed to create group');
    }
  };

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} /> Family Groups
        </h3>
        <button className="btn" onClick={() => setShowCreate(!showCreate)} style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
          <Plus size={14} /> New Group
        </button>
      </div>

      {showCreate && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <input 
            type="text" 
            placeholder="Family Name (e.g. Sharma Family)" 
            className="card" 
            style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-secondary)', outline: 'none' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleCreate}>Create</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
        <button 
          className={`card ${selectedId === null ? 'active' : ''}`}
          style={{ 
            padding: '0.75rem 1.5rem', 
            cursor: 'pointer',
            borderColor: selectedId === null ? 'var(--accent-color)' : 'var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onClick={() => onSelect(null)}
        >
          Individual View {selectedId === null && <Check size={14} />}
        </button>
        
        {families.map((f) => (
          <button 
            key={f.id}
            className={`card ${selectedId === f.id ? 'active' : ''}`}
            style={{ 
              padding: '0.75rem 1.5rem', 
              cursor: 'pointer',
              borderColor: selectedId === f.id ? 'var(--accent-color)' : 'var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onClick={() => onSelect(f.id)}
          >
            {f.name} ({f._count.members}) {selectedId === f.id && <Check size={14} />}
          </button>
        ))}
      </div>
    </div>
  );
};
