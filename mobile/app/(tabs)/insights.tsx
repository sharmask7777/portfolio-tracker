import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Target, Plus } from 'lucide-react-native';
import {
  getStoredGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  calculateGoalProgress,
  generateSmartInsights,
  type FinancialGoal,
  type CreateGoalInput,
  type GoalProgressMetrics,
} from '../../src/services/goals-service';
import {
  getEnrichedHoldings,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import {
  GoalProgressCard,
  AddGoalModal,
  SmartInsightsList,
} from '../../src/components/Insights';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 20,
    paddingTop: 56,
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    fontSize: 12,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
  },
  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  summaryCard: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f4f4f5',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 10,
    color: '#71717a',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 12,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  emptyText: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
  },
});

function formatIndianCompact(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function useInsightsData() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storedGoals, enrichedHoldings] = await Promise.all([
        getStoredGoals(),
        getEnrichedHoldings(),
      ]);
      setGoals(storedGoals);
      setHoldings(enrichedHoldings);
    } catch {
      // Graceful fallback on loading error
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return { goals, holdings, refreshing, setRefreshing, loadData };
}

interface SummaryViewProps {
  totalTarget: number;
  totalAccumulated: number;
  activeCount: number;
}

function SummaryView({ totalTarget, totalAccumulated, activeCount }: SummaryViewProps) {
  const overallPct = totalTarget > 0 ? (totalAccumulated / totalTarget) * 100 : 0;
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={styles.summaryLabel}>Total Goals Target</Text>
          <Text style={styles.summaryValue}>{formatIndianCompact(totalTarget)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.summaryLabel}>Total Accumulated</Text>
          <Text style={[styles.summaryValue, { color: '#34d399' }]}>
            {formatIndianCompact(totalAccumulated)}
          </Text>
        </View>
      </View>
      <View style={styles.summaryStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Active Goals</Text>
          <Text style={styles.statValue}>{activeCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Overall Progress</Text>
          <Text style={styles.statValue}>{overallPct.toFixed(1)}%</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Remaining Shortfall</Text>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            {formatIndianCompact(Math.max(0, totalTarget - totalAccumulated))}
          </Text>
        </View>
      </View>
    </View>
  );
}

function InsightsHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.category}>Financial Planning</Text>
        <View style={styles.titleRow}>
          <Target size={24} color="#3b82f6" />
          <Text style={styles.title}>Goals & Insights</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Plus size={16} color="#ffffff" />
        <Text style={styles.addBtnText}>Add Goal</Text>
      </TouchableOpacity>
    </View>
  );
}

interface GoalsSectionProps {
  items: { goal: FinancialGoal; metrics: GoalProgressMetrics }[];
  onEdit: (goal: FinancialGoal) => void;
  onDelete: (id: string) => void;
}

function GoalsSection({ items, onEdit, onDelete }: GoalsSectionProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Financial Goals ({items.length})</Text>
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No financial goals yet. Tap "+ Add Goal" to track your targets!</Text>
        </View>
      ) : (
        items.map(({ goal, metrics }) => (
          <GoalProgressCard
            key={goal.id}
            goal={goal}
            metrics={metrics}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </View>
  );
}

/**
 * Goal tracker and financial insights screen.
 *
 * @returns React Native tab screen
 */
export default function InsightsScreen(): React.ReactElement {
  const { goals, holdings, refreshing, setRefreshing, loadData } = useInsightsData();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets?.top ?? 0,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    16
  ) + 16;

  const netWorth = holdings.reduce((sum, h) => sum + h.current_value, 0);
  const goalsWithMetrics = goals.map((g) => ({
    goal: g,
    metrics: calculateGoalProgress(g, holdings, netWorth),
  }));

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalAccumulated = goalsWithMetrics.reduce((sum, item) => sum + item.metrics.currentValue, 0);
  const insights = generateSmartInsights(holdings, goals, netWorth);

  const handleSave = async (input: CreateGoalInput, editId?: string) => {
    if (editId) await updateGoal(editId, input);
    else await addGoal(input);
    await loadData();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor="#3b82f6" />}
      testID="insights-screen"
    >
      <InsightsHeader onAdd={() => { setEditingGoal(null); setModalVisible(true); }} />
      <SummaryView totalTarget={totalTarget} totalAccumulated={totalAccumulated} activeCount={goals.length} />
      <Text style={styles.sectionTitle}>Smart Portfolio Insights</Text>
      <SmartInsightsList insights={insights} />
      <GoalsSection items={goalsWithMetrics} onEdit={(g) => { setEditingGoal(g); setModalVisible(true); }} onDelete={async (id) => { await deleteGoal(id); await loadData(); }} />
      <AddGoalModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleSave} initialGoal={editingGoal} />
    </ScrollView>
  );
}
