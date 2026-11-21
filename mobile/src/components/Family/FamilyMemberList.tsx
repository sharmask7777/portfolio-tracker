import React from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import type { FamilyProfile, FamilyMemberMetrics } from '../../services/family-service';
import { MemberCard } from './MemberCard';

/**
 * Props for {@link FamilyMemberList}.
 */
export interface FamilyMemberListProps {
  /** Array of family member profiles */
  profiles: FamilyProfile[];
  /** Calculated metrics for each member */
  memberMetricsList: FamilyMemberMetrics[];
  /** Currently active profile ID, or null if consolidated */
  activeProfileId: string | null;
  /** Callback when user selects a profile to filter app view */
  onSelectProfile: (profileId: string | null) => void;
  /** Callback when user confirms profile deletion */
  onDeleteProfile: (profileId: string) => void;
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
});

/**
 * Computes avatar initials from a member's display name.
 *
 * @param name - The full or display name
 * @returns Initials string (e.g. 'AS', 'N', 'FM')
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'FM';
  }
  const words = trimmed.split(/\s+/);
  const firstWord = words[0];
  const char0 = firstWord ? firstWord[0] : undefined;
  if (!char0) {
    return 'FM';
  }
  const firstChar = char0.toUpperCase();
  if (words.length === 1) {
    return firstChar;
  }
  const secondWord = words[1];
  const char1 = secondWord ? secondWord[0] : undefined;
  if (!char1) {
    return firstChar;
  }
  return firstChar + char1.toUpperCase();
}

/**
 * Prompts confirmation or blocks deletion of primary or only profiles.
 *
 * @param profile - Profile to delete
 * @param profiles - All existing profiles
 * @param onDelete - Callback to execute on confirmed deletion
 */
export function requestDeleteProfile(
  profile: FamilyProfile,
  profiles: FamilyProfile[],
  onDelete: (id: string) => void,
): void {
  if (profile.isPrimary) {
    Alert.alert(
      'Cannot Delete Primary Profile',
      'The primary profile is the master account holder and cannot be deleted.',
    );
    return;
  }
  if (profiles.length <= 1) {
    Alert.alert(
      'Cannot Delete Only Profile',
      'At least one family profile must remain in the account.',
    );
    return;
  }
  Alert.alert(
    'Delete Family Member',
    `Are you sure you want to remove ${profile.name}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(profile.id),
      },
    ],
  );
}

function findMetricsForProfile(
  profile: FamilyProfile,
  metricsList: FamilyMemberMetrics[],
): FamilyMemberMetrics | undefined {
  return metricsList.find(
    (m) => m.id === profile.id || (m.pan && m.pan === profile.pan),
  );
}

/**
 * Renders the list of family member cards with metrics and management actions.
 *
 * @param props - Component props
 * @returns React Native element
 */
export function FamilyMemberList(props: FamilyMemberListProps): React.ReactElement {
  const { profiles, memberMetricsList, activeProfileId, onSelectProfile, onDeleteProfile } = props;

  return (
    <View style={styles.container} testID="family-member-list">
      {profiles.map((profile) => (
        <MemberCard
          key={profile.id}
          profile={profile}
          metrics={findMetricsForProfile(profile, memberMetricsList)}
          isActive={activeProfileId === profile.id}
          onSelect={() => onSelectProfile(profile.id)}
          onDelete={() => requestDeleteProfile(profile, profiles, onDeleteProfile)}
        />
      ))}
    </View>
  );
}
