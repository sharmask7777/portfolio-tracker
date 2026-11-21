import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Check, Trash2, ShieldCheck } from 'lucide-react-native';
import type { FamilyProfile, FamilyMemberMetrics } from '../../services/family-service';
import { formatInr, formatPct } from '../../services/portfolio-service';
import { getInitials } from './FamilyMemberList';

/**
 * Props for {@link MemberCard}.
 */
export interface MemberCardProps {
  /** Family member profile */
  profile: FamilyProfile;
  /** Member metrics */
  metrics: FamilyMemberMetrics | undefined;
  /** Whether this member is active filter */
  isActive: boolean;
  /** Callback on card select */
  onSelect: () => void;
  /** Callback on delete request */
  onDelete: () => void;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
  },
  cardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e293b',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  avatarText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
  },
  pan: {
    color: '#71717a',
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  relationBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relationText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '600',
  },
  primaryBadge: {
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#27272a',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  metricColumn: {
    flex: 1,
  },
  metricLabel: {
    color: '#71717a',
    fontSize: 11,
    marginBottom: 2,
  },
  metricValue: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '600',
  },
  gainPositive: {
    color: '#22c55e',
  },
  gainNegative: {
    color: '#ef4444',
  },
});

function CardMetricsGrid({ metrics }: { metrics: FamilyMemberMetrics | undefined }): React.ReactElement {
  const curVal = metrics ? metrics.currentValue : 0;
  const invVal = metrics ? metrics.totalInvested : 0;
  const gainVal = metrics ? metrics.totalGain : 0;
  const gainPct = metrics ? metrics.totalGainPct : 0;
  const isPos = gainVal >= 0;

  return (
    <View style={styles.metricsGrid}>
      <View style={styles.metricColumn}>
        <Text style={styles.metricLabel}>Current Value</Text>
        <Text style={styles.metricValue}>{formatInr(curVal)}</Text>
      </View>
      <View style={styles.metricColumn}>
        <Text style={styles.metricLabel}>Invested</Text>
        <Text style={styles.metricValue}>{formatInr(invVal)}</Text>
      </View>
      <View style={[styles.metricColumn, { alignItems: 'flex-end' }]}>
        <Text style={styles.metricLabel}>Total Return</Text>
        <Text style={[styles.metricValue, isPos ? styles.gainPositive : styles.gainNegative]}>
          {formatInr(gainVal)} ({formatPct(gainPct)})
        </Text>
      </View>
    </View>
  );
}

function MemberCardHeader(props: {
  profile: FamilyProfile;
  isActive: boolean;
  onDelete: () => void;
}): React.ReactElement {
  const { profile, isActive, onDelete } = props;

  return (
    <View style={styles.topRow}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
        </View>
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            <View style={styles.relationBadge}>
              <Text style={styles.relationText}>{profile.relationship}</Text>
            </View>
            {profile.isPrimary && (
              <View style={styles.primaryBadge}>
                <ShieldCheck size={10} color="#93c5fd" />
                <Text style={styles.primaryText}>Primary</Text>
              </View>
            )}
          </View>
          <Text style={styles.pan}>{profile.pan}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {isActive && (
          <View style={styles.activeCheck}>
            <Check size={16} color="#ffffff" />
          </View>
        )}
        {!profile.isPrimary && (
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} accessibilityLabel={`Delete ${profile.name}`}>
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Individual member card displaying profile avatar, relation badge, metrics, and actions.
 *
 * @param props - Component props
 * @returns React Native element
 */
export function MemberCard({ profile, metrics, isActive, onSelect, onDelete }: MemberCardProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <MemberCardHeader profile={profile} isActive={isActive} onDelete={onDelete} />
      <CardMetricsGrid metrics={metrics} />
    </TouchableOpacity>
  );
}
