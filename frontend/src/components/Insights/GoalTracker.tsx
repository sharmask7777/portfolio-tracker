import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { Target, Plus, Calendar, Edit, Trash2, X, Check } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  type: string;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  assets?: Asset[];
  metrics: {
    currentValue: number;
    progressPercentage: number;
    shortfall: number;
    remainingDays: number;
  };
}

interface GoalTrackerProps {
  portfolioId: string;
  currentValue: number;
  activeAssets?: Asset[];
}

export const GoalTracker: React.FC<GoalTrackerProps> = ({ portfolioId, activeAssets = [] }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // Editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSelectedAssetIds, setEditSelectedAssetIds] = useState<string[]>([]);

  const fetchGoals = async () => {
    try {
      const res = await api.get(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals`);
      setGoals(res.data);
    } catch (e) {
      console.error('Failed to fetch goals', e);
    }
  };

  useEffect(() => {
    if (portfolioId) fetchGoals();
  }, [portfolioId]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals`, {
        name,
        targetAmount: amount,
        targetDate: date,
        assetIds: selectedAssetIds,
      });
      setName('');
      setAmount('');
      setDate('');
      setSelectedAssetIds([]);
      setShowAdd(false);
      fetchGoals();
    } catch (e) {
      alert('Failed to add goal');
    }
  };

  const startEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditAmount(goal.targetAmount.toString());
    setEditDate(new Date(goal.targetDate).toISOString().split('T')[0]);
    setEditSelectedAssetIds((goal.assets || []).map(a => a.id));
  };

  const handleUpdateGoal = async (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    try {
      await api.put(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals/${goalId}`, {
        name: editName,
        targetAmount: editAmount,
        targetDate: editDate,
        assetIds: editSelectedAssetIds,
      });
      setEditingGoalId(null);
      fetchGoals();
    } catch (e) {
      alert('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      try {
        await api.delete(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals/${goalId}`);
        fetchGoals();
      } catch (e) {
        alert('Failed to delete goal');
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const toggleAssetSelection = (assetId: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditSelectedAssetIds(prev => 
        prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
      );
    } else {
      setSelectedAssetIds(prev => 
        prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
      );
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={20} /> Financial Goals
        </h3>
        <button className="btn" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
          <Plus size={14} /> New Goal
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Add New Goal</h4>
          <input type="text" placeholder="Goal Name (e.g. Retirement)" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="number" placeholder="Target Amount (INR)" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input type="date" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={date} onChange={(e) => setDate(e.target.value)} required />
          
          {activeAssets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attach Specific Mutual Funds (Optional):</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)' }}>
                {activeAssets.map(asset => (
                  <label key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedAssetIds.includes(asset.id)}
                      onChange={() => toggleAssetSelection(asset.id)}
                    />
                    <span>{asset.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Goal</button>
            <button type="button" className="btn" onClick={() => setShowAdd(false)} style={{ border: '1px solid var(--border-color)' }}><X size={14} /></button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {goals.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No goals set yet.</p>}
        {goals.map((goal) => {
          const isEditing = editingGoalId === goal.id;
          const progress = Math.min(100, (goal.metrics.currentValue / goal.targetAmount) * 100);
          
          if (isEditing) {
            return (
              <form key={goal.id} onSubmit={(e) => handleUpdateGoal(e, goal.id)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--accent-color)' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-color)' }}>Edit Goal</h4>
                <input type="text" placeholder="Goal Name" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={editName} onChange={(e) => setEditName(e.target.value)} required />
                <input type="number" placeholder="Target Amount" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required />
                <input type="date" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
                
                {activeAssets.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attach Specific Mutual Funds (Optional):</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '120px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-primary)' }}>
                      {activeAssets.map(asset => (
                        <label key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={editSelectedAssetIds.includes(asset.id)}
                            onChange={() => toggleAssetSelection(asset.id, true)}
                          />
                          <span>{asset.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}><Check size={12} /> Save</button>
                  <button type="button" className="btn" onClick={() => setEditingGoalId(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)' }}><X size={12} /> Cancel</button>
                </div>
              </form>
            );
          }

          return (
            <div key={goal.id} className="goal-item" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{goal.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>{formatCurrency(goal.targetAmount)}</span>
                  <button 
                    className="theme-toggle" 
                    title="Edit Goal" 
                    onClick={() => startEditGoal(goal)}
                    style={{ padding: '0.25rem', opacity: 0.7 }}
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    className="theme-toggle" 
                    title="Delete Goal" 
                    onClick={() => handleDeleteGoal(goal.id)}
                    style={{ padding: '0.25rem', color: 'var(--down-color, #ff4d4f)', opacity: 0.7 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                <span>{progress.toFixed(1)}% Achieved ({formatCurrency(goal.metrics.currentValue)})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={12} /> {new Date(goal.targetDate).toLocaleDateString()}
                </span>
              </div>

              {/* Show attached assets as badges */}
              {goal.assets && goal.assets.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                  {goal.assets.map(asset => (
                    <span 
                      key={asset.id} 
                      style={{ 
                        fontSize: '0.65rem', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '12px', 
                        background: 'rgba(var(--accent-color-rgb, 99, 102, 241), 0.1)', 
                        border: '1px solid rgba(var(--accent-color-rgb, 99, 102, 241), 0.2)',
                        color: 'var(--accent-color, #6366f1)',
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={asset.name}
                    >
                      {asset.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  Tracked against entire portfolio
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
