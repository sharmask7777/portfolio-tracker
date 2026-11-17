import React from 'react';
import { Target, Plus } from 'lucide-react';

interface GoalTrackerHeaderProps {
  onToggleAdd: () => void;
}

export const GoalTrackerHeader: React.FC<GoalTrackerHeaderProps> = ({
  onToggleAdd,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Target size={20} /> Financial Goals
    </h3>
    <button
      className="btn"
      onClick={onToggleAdd}
      style={{ fontSize: '0.75rem', border: '1px solid var(--border-color)' }}
    >
      <Plus size={14} /> New Goal
    </button>
  </div>
);
