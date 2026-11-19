import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { UploadQueueStatus, SyncQueueItem, SyncQueueStatus } from '../services/upload-queue';

/**
 * Props for {@link UploadQueueCard}.
 */
export interface UploadQueueCardProps {
  /** Aggregated outbox queue counts and history list, or null if loading */
  status: UploadQueueStatus | null;
  /** Callback fired to trigger immediate network flush of pending uploads */
  onSync: () => void;
  /** Whether outbox network synchronization is currently running */
  isSyncing: boolean;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 20,
    marginTop: 20,
    marginBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  syncButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  statLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    marginTop: 2,
  },
  completedText: {
    color: '#34d399',
  },
  failedText: {
    color: '#f87171',
  },
  historyList: {
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f4f4f5',
  },
  itemMeta: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

function getStatusBadgeStyle(status: SyncQueueStatus): {
  backgroundColor: string;
  color: string;
} {
  switch (status) {
    case 'COMPLETED':
      return { backgroundColor: '#064e3b', color: '#34d399' };
    case 'FAILED':
      return { backgroundColor: '#7f1d1d', color: '#f87171' };
    case 'PROCESSING':
      return { backgroundColor: '#1e3a8a', color: '#60a5fa' };
    case 'PENDING':
    default:
      return { backgroundColor: '#78350f', color: '#fbbf24' };
  }
}

function renderQueueItem(item: SyncQueueItem): React.ReactElement {
  const badge = getStatusBadgeStyle(item.status);
  return (
    <View key={item.id} style={styles.itemRow} testID={`queue-item-${item.id}`}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.file_name}
        </Text>
        <Text style={styles.itemMeta}>
          {item.created_at.slice(0, 10)}
          {item.retry_count > 0 ? ` • Retries: ${item.retry_count}` : ''}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
        <Text style={[styles.badgeText, { color: badge.color }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );
}

function renderSummaryPills(status: UploadQueueStatus): React.ReactElement {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statBox}>
        <Text style={styles.statCount}>{status.pendingCount}</Text>
        <Text style={styles.statLabel}>Pending</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={[styles.statCount, styles.completedText]}>
          {status.completedCount}
        </Text>
        <Text style={styles.statLabel}>Completed</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={[styles.statCount, styles.failedText]}>
          {status.failedCount}
        </Text>
        <Text style={styles.statLabel}>Failed</Text>
      </View>
    </View>
  );
}

/**
 * Card displaying offline statement upload outbox status, pending count pills,
 * manual "Sync Now" button, and recent upload history with status badges.
 *
 * @param props - Component properties {@link UploadQueueCardProps}
 * @returns React Native element
 */
export function UploadQueueCard({
  status,
  onSync,
  isSyncing,
}: UploadQueueCardProps): React.ReactElement {
  if (!status) {
    return <View testID="queue-status-empty" />;
  }

  return (
    <View style={styles.card} testID="upload-queue-card">
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Upload Outbox</Text>
        {status.pendingCount > 0 && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={onSync}
            disabled={isSyncing}
            testID="sync-outbox-btn"
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {renderSummaryPills(status)}

      <View style={styles.historyList}>
        <Text style={styles.historyTitle}>Recent Statements</Text>
        {status.history.length === 0 ? (
          <Text style={styles.emptyText}>No recent upload attempts</Text>
        ) : (
          status.history.slice(0, 5).map(renderQueueItem)
        )}
      </View>
    </View>
  );
}
