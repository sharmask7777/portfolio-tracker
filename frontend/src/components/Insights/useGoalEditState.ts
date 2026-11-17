import { useState } from 'react';
import type { Goal } from './GoalItemView';

export function useGoalEditState() {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSelectedAssetIds, setEditSelectedAssetIds] = useState<string[]>([]);

  const startEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditAmount(goal.targetAmount.toString());
    setEditDate(new Date(goal.targetDate).toISOString().split('T')[0] ?? '');
    setEditSelectedAssetIds((goal.assets || []).map(a => a.id));
  };

  const cancelEdit = () => {
    setEditingGoalId(null);
  };

  const toggleEditAsset = (assetId: string) => {
    setEditSelectedAssetIds(prev =>
      prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
    );
  };

  return {
    editingGoalId,
    editName,
    setEditName,
    editAmount,
    setEditAmount,
    editDate,
    setEditDate,
    editSelectedAssetIds,
    startEditGoal,
    cancelEdit,
    toggleEditAsset,
  };
}
