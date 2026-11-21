/**
 * @file FamilyProfilesCard.tsx
 * @description Settings section card for family profiles and member management (CRUD).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Plus, Users } from 'lucide-react-native';
import {
  getStoredFamilyProfiles,
  getActiveProfileId,
  setActiveProfileId,
  addFamilyProfile,
  deleteFamilyProfile,
  getStoredFolios,
  calculateMemberMetrics,
  type FamilyProfile,
  type FolioEntity,
} from '../../services/family-service';
import {
  getEnrichedHoldings,
  type EnrichedHolding,
} from '../../services/portfolio-service';
import { FamilyMemberList } from '../Family/FamilyMemberList';
import { AddMemberModal } from '../Family/AddMemberModal';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});

function useFamilyManagement() {
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [activeProfileId, setActiveId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [storedProfiles, activeId, enrichedHoldings, storedFolios] = await Promise.all([
        getStoredFamilyProfiles(),
        getActiveProfileId(),
        getEnrichedHoldings(),
        getStoredFolios(),
      ]);
      setProfiles(storedProfiles);
      setActiveId(activeId);
      setHoldings(enrichedHoldings);
      setFolios(storedFolios);
    } catch {
      // Fallback on read error
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return { profiles, activeProfileId, setActiveId, holdings, folios, loadData };
}

/**
 * Settings section card for family profiles & member management.
 *
 * @returns React Native element
 */
export function FamilyProfilesCard(): React.ReactElement {
  const { profiles, activeProfileId, setActiveId, holdings, folios, loadData } = useFamilyManagement();
  const [showAddModal, setShowAddModal] = useState(false);

  const memberMetricsList = profiles.map((p) => calculateMemberMetrics(p, holdings, folios));

  return (
    <View style={styles.card} testID="settings-family-profiles-card">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Users size={16} color="#93c5fd" />
          <Text style={styles.title}>Family Profiles ({profiles.length})</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
          testID="settings-add-member-btn"
          accessibilityRole="button"
          accessibilityLabel="Add new family member profile"
        >
          <Plus size={14} color="#ffffff" />
          <Text style={styles.addBtnText}>Add Member</Text>
        </TouchableOpacity>
      </View>

      <FamilyMemberList
        profiles={profiles}
        memberMetricsList={memberMetricsList}
        activeProfileId={activeProfileId}
        onSelectProfile={async (id) => {
          setActiveId(id);
          await setActiveProfileId(id);
        }}
        onDeleteProfile={async (id) => {
          await deleteFamilyProfile(id);
          await loadData();
        }}
      />

      <AddMemberModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddMember={async (input) => {
          await addFamilyProfile(input);
          await loadData();
        }}
      />
    </View>
  );
}
