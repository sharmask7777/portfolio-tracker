import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { GoalItemView, type Goal, type Asset } from './GoalItemView';
import { GoalAddForm } from './GoalAddForm';
import { GoalEditForm } from './GoalEditForm';
import { GoalTrackerHeader } from './GoalTrackerHeader';
import { useGoalEditState } from './useGoalEditState';

interface GoalTrackerProps {
  portfolioId: string;
  currentValue: number;
  activeAssets?: Asset[] | undefined;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const GoalTracker: React.FC<GoalTrackerProps> = ({ portfolioId, activeAssets = [] }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const editState = useGoalEditState();

  const fetchGoals = React.useCallback(async () => {
    try {
      const res = await api.get(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals`);
      setGoals(res.data);
    } catch (err) {
      console.error('Failed to fetch goals', err);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (portfolioId) fetchGoals();
  }, [portfolioId, fetchGoals]);

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
    } catch {
      alert('Failed to add goal');
    }
  };

  const handleUpdateGoal = async (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    try {
      await api.put(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals/${goalId}`, {
        name: editState.editName,
        targetAmount: editState.editAmount,
        targetDate: editState.editDate,
        assetIds: editState.editSelectedAssetIds,
      });
      editState.cancelEdit();
      fetchGoals();
    } catch {
      alert('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    try {
      await api.delete(`${API_ENDPOINTS.HEALTH}/${portfolioId}/goals/${goalId}`);
      fetchGoals();
    } catch {
      alert('Failed to delete goal');
    }
  };

  return (
    <div className="card">
      <GoalTrackerHeader onToggleAdd={() => setShowAdd(!showAdd)} />

      {showAdd && (
        <GoalAddForm
          name={name}
          onNameChange={setName}
          amount={amount}
          onAmountChange={setAmount}
          date={date}
          onDateChange={setDate}
          activeAssets={activeAssets}
          selectedAssetIds={selectedAssetIds}
          onToggleAsset={(id) =>
            setSelectedAssetIds(prev =>
              prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
            )
          }
          onSubmit={handleAddGoal}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {goals.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No goals set yet.</p>}
        {goals.map((goal) => {
          if (editState.editingGoalId === goal.id) {
            return (
              <GoalEditForm
                key={goal.id}
                goalId={goal.id}
                name={editState.editName}
                onNameChange={editState.setEditName}
                amount={editState.editAmount}
                onAmountChange={editState.setEditAmount}
                date={editState.editDate}
                onDateChange={editState.setEditDate}
                activeAssets={activeAssets}
                selectedAssetIds={editState.editSelectedAssetIds}
                onToggleAsset={editState.toggleEditAsset}
                onSubmit={handleUpdateGoal}
                onCancel={editState.cancelEdit}
              />
            );
          }

          return (
            <GoalItemView
              key={goal.id}
              goal={goal}
              formatCurrency={formatCurrency}
              onEdit={editState.startEditGoal}
              onDelete={handleDeleteGoal}
            />
          );
        })}
      </div>
    </div>
  );
};
