/**
 * @file ScopeSelectorHeader.tsx
 * @description Top-level horizontal chip scope selector header for mobile screens.
 * Mirrors Web's ScopeSelector with Consolidated and member PAN chips.
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, User } from 'lucide-react-native';
import type { PortfolioScope } from '@portfolio/core-view';
import type { PanBreakdownDto } from '../../types/generated';
import type { FamilyProfile } from '../../services/family-service';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    backgroundColor: '#09090b',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  chipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#2563eb',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#27272a',
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  badgeTextActive: {
    color: '#ffffff',
  },
});

/**
 * Props for ScopeSelectorHeader.
 */
export interface ScopeSelectorHeaderProps {
  /** Active scope */
  readonly scope: PortfolioScope;
  /** Callback when consolidated scope is selected */
  readonly onSelectConsolidated: () => void;
  /** Callback when a member profile scope is selected */
  readonly onSelectMember: (profile: { readonly profileId: string; readonly pan?: string; readonly name?: string }) => void;
  /** Stored family profiles */
  readonly profiles: FamilyProfile[];
  /** Optional display-ready PAN breakdowns from API */
  readonly panBreakdowns?: PanBreakdownDto[] | undefined;
  /** Optional total count of folios */
  readonly totalFolios?: number | undefined;
}

interface MemberChipItemProps {
  readonly profile: FamilyProfile;
  readonly isSelected: boolean;
  readonly corpusShare: number | null;
  readonly onSelect: () => void;
}

function MemberChipItem({ profile, isSelected, corpusShare, onSelect }: MemberChipItemProps): React.ReactElement {
  const iconColor = isSelected ? '#ffffff' : '#a1a1aa';
  return (
    <TouchableOpacity
      style={[styles.chip, isSelected && styles.chipActive]}
      onPress={onSelect}
      testID={`scope-chip-${profile.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Select profile ${profile.name}`}
    >
      <User size={14} color={iconColor} />
      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
        {profile.name}
      </Text>
      {profile.pan ? (
        <View style={[styles.badge, isSelected && styles.badgeActive]}>
          <Text style={[styles.badgeText, isSelected && styles.badgeTextActive]}>
            {profile.pan}
          </Text>
        </View>
      ) : null}
      {corpusShare !== null ? (
        <View style={[styles.badge, isSelected && styles.badgeActive]}>
          <Text style={[styles.badgeText, isSelected && styles.badgeTextActive]}>
            {corpusShare}%
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

interface ConsolidatedChipProps {
  readonly isConsolidated: boolean;
  readonly uniquePanCount: number;
  readonly labelText: string;
  readonly onSelect: () => void;
}

function ConsolidatedChip({ isConsolidated, uniquePanCount, labelText, onSelect }: ConsolidatedChipProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.chip, isConsolidated && styles.chipActive]}
      onPress={onSelect}
      testID="scope-chip-consolidated"
      accessibilityRole="button"
      accessibilityLabel="Select Consolidated Family scope"
    >
      <Users size={14} color={isConsolidated ? '#ffffff' : '#a1a1aa'} />
      <Text style={[styles.chipText, isConsolidated && styles.chipTextActive]}>
        Consolidated
      </Text>
      {uniquePanCount > 0 ? (
        <View style={[styles.badge, isConsolidated && styles.badgeActive]}>
          <Text style={[styles.badgeText, isConsolidated && styles.badgeTextActive]}>
            {labelText}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function useScopeBreakdowns(
  panBreakdowns: PanBreakdownDto[] | undefined,
  profiles: FamilyProfile[],
  totalFolios: number | undefined
) {
  const totalValuation = useMemo(() => {
    if (!panBreakdowns || panBreakdowns.length === 0) return 0;
    return panBreakdowns.reduce((sum, item) => sum + (item.currentValue > 0 ? item.currentValue : 0), 0);
  }, [panBreakdowns]);

  const breakdownByPan = useMemo(() => {
    const map = new Map<string, PanBreakdownDto>();
    if (panBreakdowns) {
      for (const b of panBreakdowns) {
        if (b.pan) map.set(b.pan.trim().toUpperCase(), b);
      }
    }
    return map;
  }, [panBreakdowns]);

  const totalCount = useMemo(() => {
    if (typeof totalFolios === 'number') return totalFolios;
    if (panBreakdowns && panBreakdowns.length > 0) {
      return panBreakdowns.reduce((sum, item) => sum + item.folioCount, 0);
    }
    return undefined;
  }, [totalFolios, panBreakdowns]);

  const uniquePanCount = useMemo(() => {
    if (panBreakdowns && panBreakdowns.length > 0) return panBreakdowns.length;
    return new Set(profiles.map((p) => p.pan.trim().toUpperCase()).filter(Boolean)).size;
  }, [panBreakdowns, profiles]);

  return { totalValuation, breakdownByPan, totalCount, uniquePanCount };
}

/**
 * Renders a horizontal chip scope selector header.
 *
 * @param props - Component configuration
 * @returns React Native element
 */
export function ScopeSelectorHeader({
  scope,
  onSelectConsolidated,
  onSelectMember,
  profiles,
  panBreakdowns,
  totalFolios,
}: ScopeSelectorHeaderProps): React.ReactElement {
  const isConsolidated = scope.type === 'consolidated';
  const activeProfileId = scope.type === 'member' ? scope.profileId : null;
  const { totalValuation, breakdownByPan, totalCount, uniquePanCount } =
    useScopeBreakdowns(panBreakdowns, profiles, totalFolios);
  const badgeText = `${uniquePanCount} PANs${totalCount !== undefined ? ` • ${totalCount} Folios` : ''}`;

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets?.top ?? 0,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  ) + 6;

  return (
    <View
      style={[styles.container, { paddingTop: topPadding }]}
      testID="scope-selector-header"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ConsolidatedChip
          isConsolidated={isConsolidated}
          uniquePanCount={uniquePanCount}
          labelText={badgeText}
          onSelect={onSelectConsolidated}
        />
        {profiles.map((p) => {
          const breakdown = breakdownByPan.get(p.pan.trim().toUpperCase());
          const share = totalValuation > 0 && breakdown && breakdown.currentValue > 0
            ? Math.round((breakdown.currentValue / totalValuation) * 100) : null;
          return (
            <MemberChipItem
              key={p.id}
              profile={p}
              isSelected={activeProfileId === p.id}
              corpusShare={share}
              onSelect={() => onSelectMember({ profileId: p.id, pan: p.pan, name: p.name })}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
