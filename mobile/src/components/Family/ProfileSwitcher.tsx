import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import type { FamilyProfile } from '../../services/family-service';

/**
 * Props for {@link ProfileSwitcher}.
 */
export interface ProfileSwitcherProps {
  /** List of all family profiles */
  profiles: FamilyProfile[];
  /** Active profile ID, or null for consolidated */
  activeProfileId: string | null;
  /** Callback when user selects a profile or consolidated view */
  onSelect: (id: string | null) => void;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterPillActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  filterPillText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#93c5fd',
    fontWeight: '700',
  },
});

/**
 * Horizontal selector pills allowing switching between individual profiles and consolidated view.
 *
 * @param props - Component props
 * @returns React Native element
 */
export function ProfileSwitcher(props: ProfileSwitcherProps): React.ReactElement {
  const { profiles, activeProfileId, onSelect } = props;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={[styles.filterPill, activeProfileId === null && styles.filterPillActive]}
          onPress={() => onSelect(null)}
        >
          <Text style={[styles.filterPillText, activeProfileId === null && styles.filterPillTextActive]}>
            All (Consolidated)
          </Text>
        </TouchableOpacity>
        {profiles.map((p) => {
          const isActive = activeProfileId === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => onSelect(p.id)}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
