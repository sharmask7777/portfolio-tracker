import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import type { SmartInsight, InsightSeverity } from '../../services/goals-service';

/**
 * Properties for the SmartInsightsList component.
 */
export interface SmartInsightsListProps {
  /** Array of active smart portfolio insights. */
  insights: SmartInsight[];
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 13,
    color: '#d4d4d8',
    lineHeight: 18,
    marginBottom: 8,
  },
  recommendationBox: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 10,
  },
  recommendationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93c5fd',
    marginBottom: 2,
  },
  recommendationText: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 16,
  },
  metricText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
    marginTop: 6,
  },
});

function getSeverityConfig(severity: InsightSeverity) {
  switch (severity) {
    case 'HIGH':
      return { Icon: AlertTriangle, color: '#ef4444', bg: '#450a0a' };
    case 'MEDIUM':
      return { Icon: Info, color: '#f59e0b', bg: '#451a03' };
    case 'LOW':
      return { Icon: CheckCircle2, color: '#10b981', bg: '#064e3b' };
    default:
      return { Icon: Sparkles, color: '#3b82f6', bg: '#172554' };
  }
}

/**
 * List component rendering smart portfolio health and risk insight cards.
 *
 * @param props - Component properties
 * @returns React Native element
 */
export function SmartInsightsList({
  insights,
}: SmartInsightsListProps): React.ReactElement {
  return (
    <View style={styles.container}>
      {insights.map((item) => {
        const { Icon, color, bg } = getSeverityConfig(item.severity);
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Icon size={18} color={color} />
                <Text style={styles.title}>{item.title}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: bg }]}>
                <Text style={[styles.badgeText, { color }]}>{item.severity}</Text>
              </View>
            </View>

            <Text style={styles.message}>{item.message}</Text>

            <View style={styles.recommendationBox}>
              <Text style={styles.recommendationLabel}>Action Recommendation</Text>
              <Text style={styles.recommendationText}>{item.recommendation}</Text>
              {item.metric && <Text style={styles.metricText}>Key Metric: {item.metric}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}
