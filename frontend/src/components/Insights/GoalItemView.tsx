import React from 'react';
import { Edit, Trash2, Calendar } from 'lucide-react';

export interface Asset {
  id: string;
  name: string;
  type: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  assets?: Asset[] | undefined;
  metrics: {
    currentValue: number;
    progressPercentage: number;
    shortfall: number;
    remainingDays: number;
  };
}

interface GoalItemViewProps {
  goal: Goal;
  formatCurrency: (val: number) => string;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
}

export const GoalItemView: React.FC<GoalItemViewProps> = ({
  goal,
  formatCurrency,
  onEdit,
  onDelete,
}) => {
  const progress = Math.min(100, (goal.metrics.currentValue / goal.targetAmount) * 100);

  return (
    <div className="goal-item" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600 }}>{goal.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
            {formatCurrency(goal.targetAmount)}
          </span>
          <button
            className="theme-toggle"
            title="Edit Goal"
            onClick={() => onEdit(goal)}
            style={{ padding: '0.25rem', opacity: 0.7 }}
          >
            <Edit size={14} />
          </button>
          <button
            className="theme-toggle"
            title="Delete Goal"
            onClick={() => onDelete(goal.id)}
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
};
