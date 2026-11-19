import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  getDashboardSummary,
  refreshPortfolio,
  type DashboardSummary,
} from '../../src/services/portfolio-service';
import {
  NetWorthCard,
  DayReturnBanner,
  AssetAllocationCard,
} from '../../src/components';

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
    marginBottom: 20,
  },
  greeting: {
    fontSize: 13,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
  },
  emptyCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
  },
});

function useDashboardData() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch {
      // Retain fallback summary on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshPortfolio();
      await loadData();
    } catch {
      // Retain existing state on refresh error
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return { summary, isLoading, isRefreshing, handleRefresh };
}

const defaultSummary: DashboardSummary = {
  totalCurrentValue: 0,
  totalInvestedCost: 0,
  unrealizedGain: 0,
  unrealizedGainPct: 0,
  dayGain: 0,
  dayGainPct: 0,
  assetAllocation: [],
  holdingsCount: 0,
  lastUpdated: null,
  isOfflineFallback: false,
};

function renderEmptyState(): React.ReactElement {
  return (
    <View style={styles.emptyCard} testID="dashboard-empty-state">
      <Text style={styles.emptyTitle}>No Holdings Found</Text>
      <Text style={styles.emptySubtitle}>
        Your portfolio is empty. Pair with a server or upload a CAS statement to
        track your investments offline.
      </Text>
    </View>
  );
}

function DashboardHeader(): React.ReactElement {
  return (
    <View style={styles.header}>
      <Text style={styles.greeting}>Offline Portfolio</Text>
      <Text style={styles.title}>Dashboard</Text>
    </View>
  );
}

/**
 * Main mobile dashboard screen. Displays total net worth, today's returns banner,
 * asset allocation breakdown, and pull-to-refresh sync against public AMFI feeds and server.
 *
 * @returns React Native dashboard tab element
 */
export default function DashboardScreen(): React.ReactElement {
  const { summary, isLoading, isRefreshing, handleRefresh } = useDashboardData();

  if (isLoading && !summary) {
    return (
      <View style={styles.center} testID="dashboard-loading">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const data = summary ?? defaultSummary;
  const hasHoldings = data.holdingsCount > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="dashboard-scroll"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3b82f6"
          colors={['#3b82f6']}
        />
      }
    >
      <DashboardHeader />

      <NetWorthCard
        totalCurrentValue={data.totalCurrentValue}
        totalInvestedCost={data.totalInvestedCost}
        unrealizedGain={data.unrealizedGain}
        unrealizedGainPct={data.unrealizedGainPct}
      />

      <DayReturnBanner
        dayGain={data.dayGain}
        dayGainPct={data.dayGainPct}
        isOfflineFallback={data.isOfflineFallback}
      />

      {hasHoldings ? (
        <AssetAllocationCard
          allocation={data.assetAllocation}
          totalValue={data.totalCurrentValue}
        />
      ) : (
        renderEmptyState()
      )}
    </ScrollView>
  );
}
