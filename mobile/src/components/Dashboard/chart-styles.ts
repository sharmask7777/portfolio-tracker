import { StyleSheet } from 'react-native';

/**
 * Style definitions for historical trend chart components.
 */
export const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  resetZoomBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  resetZoomText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b82f6',
  },
  athBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  athBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  athBadgeDrawdown: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  athBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  athBadgeTextActive: {
    color: '#10b981',
  },
  athBadgeTextDrawdown: {
    color: '#ef4444',
  },
  rangeBar: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  rangeBtnActive: {
    backgroundColor: '#27272a',
  },
  rangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717a',
  },
  rangeTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  tooltipCard: {
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 12,
    marginBottom: 14,
  },
  tooltipDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
    paddingBottom: 6,
  },
  tooltipDateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  resetProbeBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#27272a',
  },
  resetProbeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3b82f6',
  },
  tooltipMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tooltipMetric: {
    flex: 1,
  },
  tooltipMetricLabel: {
    fontSize: 10,
    color: '#71717a',
    marginBottom: 2,
  },
  tooltipMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLineVal: {
    width: 14,
    height: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginRight: 6,
  },
  legendLineCost: {
    width: 14,
    height: 2,
    backgroundColor: '#71717a',
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
  },
});
