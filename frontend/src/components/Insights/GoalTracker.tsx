import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { Target, Plus, Calendar } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
}

interface GoalTrackerProps {
  portfolioId: string;
  currentValue: number;
}

export const GoalTracker: React.FC<GoalTrackerProps> = ({ portfolioId, currentValue }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

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
      });
      setName('');
      setAmount('');
      setDate('');
      setShowAdd(false);
      fetchGoals();
    } catch (e) {
      alert('Failed to add goal');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
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
        <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <input type="text" placeholder="Goal Name (e.g. Retirement)" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="number" placeholder="Target Amount (INR)" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input type="date" className="card" style={{ padding: '0.5rem', outline: 'none' }} value={date} onChange={(e) => setDate(e.target.value)} required />
          <button type="submit" className="btn btn-primary">Add Goal</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {goals.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No goals set yet.</p>}
        {goals.map((goal) => {
          const progress = Math.min(100, (currentValue / goal.targetAmount) * 100);
          return (
            <div key={goal.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{goal.name}</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{formatCurrency(goal.targetAmount)}</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{progress.toFixed(1)}% Achieved</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={12} /> {new Date(goal.targetDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
