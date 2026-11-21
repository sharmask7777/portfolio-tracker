import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Edit3, Trash2, Calendar } from 'lucide-react-native';
import type { FinancialGoal, GoalProgressMetrics } from '../../services/goals-service';

/**
 * Properties for the GoalProgressCard component.
 */
export interface GoalProgressCardProps {
  /** Target financial goal entity. */
  goal: FinancialGoal;
  /** Pre-calculated progress metrics. */
  metrics: GoalProgressMetrics;
  /** Callback invoked to trigger editing this goal. */
  onEdit?: ((goal: FinancialGoal) => void) | undefined;
  /** Callback invoked to delete this goal. */
  onDelete?: ((goalId: string) => void) | undefined;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a1a1aa',
    textTransform: 'uppercase',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    padding: 4,
    opacity: 0.8,
  },
  titleRow: {
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#71717a',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#27272a',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accumulatedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e4e4e7',
  },
  pctText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  sipLabel: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  sipValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'Completed':
      return { bg: '#14532d', color: '#4ade80' };
    case 'Ahead':
      return { bg: '#064e3b', color: '#34d399' };
    case 'Behind':
      return { bg: '#7f1d1d', color: '#f87171' };
    default:
      return { bg: '#1e3a8a', color: '#60a5fa' };
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'High':
      return { bg: '#450a0a', color: '#f87171' };
    case 'Medium':
      return { bg: '#451a03', color: '#fb923c' };
    default:
      return { bg: '#172554', color: '#93c5fd' };
  }
}

interface CardHeaderProps {
  goal: FinancialGoal;
  onEdit?: ((goal: FinancialGoal) => void) | undefined;
  onDelete?: ((goalId: string) => void) | undefined;
}

function CardHeader({ goal, onEdit, onDelete }: CardHeaderProps) {
  const priorityColors = getPriorityColor(goal.priority);
  return (
    <View style={styles.topRow}>
      <View style={styles.tagGroup}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{goal.category}</Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColors.bg }]}>
          <Text style={[styles.priorityText, { color: priorityColors.color }]}>{goal.priority}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity onPress={() => onEdit(goal)} style={styles.actionBtn} accessibilityLabel="Edit Goal">
            <Edit3 size={15} color="#94a3b8" />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity onPress={() => onDelete(goal.id)} style={styles.actionBtn} accessibilityLabel="Delete Goal">
            <Trash2 size={15} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface CardFooterProps {
  metrics: GoalProgressMetrics;
  statusColors: { bg: string; color: string };
}

function CardFooter({ metrics, statusColors }: CardFooterProps) {
  return (
    <View style={styles.bottomRow}>
      <View>
        <Text style={styles.sipLabel}>Required Monthly SIP</Text>
        <Text style={styles.sipValue}>
          {metrics.status === 'Completed' ? 'Goal Achieved! 🎉' : `${formatCurrency(metrics.requiredMonthlySip)}/mo`}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
        <Text style={[styles.statusText, { color: statusColors.color }]}>{metrics.status}</Text>
      </View>
    </View>
  );
}

/**
 * Component displaying progress, target metrics, and actions for an individual goal.
 *
 * @param props - Component properties
 * @returns React Native element
 */
export function GoalProgressCard({
  goal,
  metrics,
  onEdit,
  onDelete,
}: GoalProgressCardProps): React.ReactElement {
  const statusColors = getStatusStyle(metrics.status);
  const fillPct = Math.min(100, Math.max(0, metrics.progressPercentage));

  return (
    <View style={styles.card}>
      <CardHeader goal={goal} onEdit={onEdit} onDelete={onDelete} />

      <View style={styles.titleRow}>
        <Text style={styles.goalTitle}>{goal.name}</Text>
        <View style={styles.dateRow}>
          <Calendar size={13} color="#71717a" />
          <Text style={styles.dateText}>Target: {goal.targetDate.slice(0, 10)}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${fillPct}%`, backgroundColor: statusColors.color }]} />
      </View>

      <View style={styles.metricRow}>
        <Text style={styles.accumulatedText}>
          {formatCurrency(metrics.currentValue)} / {formatCurrency(goal.targetAmount)}
        </Text>
        <Text style={styles.pctText}>{metrics.progressPercentage.toFixed(1)}%</Text>
      </View>

      <CardFooter metrics={metrics} statusColors={statusColors} />
    </View>
  );
}
