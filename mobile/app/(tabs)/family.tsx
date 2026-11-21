import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Plus } from 'lucide-react-native';
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
} from '../../src/services/family-service';
import {
  getEnrichedHoldings,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import {
  FamilyMemberList,
  AddMemberModal,
  FamilyMetricsSummary,
  ProfileSwitcher,
} from '../../src/components/Family';

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 12,
  },
});

function useFamilyData() {
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [activeProfileId, setActiveId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
      // Graceful fallback on storage access failure
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return { profiles, activeProfileId, setActiveId, holdings, folios, refreshing, setRefreshing, loadData };
}

/**
 * Family profiles and multi-PAN management tab screen.
 *
 * @returns React Native screen element
 */
export default function FamilyScreen(): React.ReactElement {
  const { profiles, activeProfileId, setActiveId, holdings, folios, refreshing, setRefreshing, loadData } = useFamilyData();
  const [showAddModal, setShowAddModal] = useState(false);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const activeMetrics = calculateMemberMetrics(activeProfile, holdings, folios);
  const memberMetricsList = profiles.map((p) => calculateMemberMetrics(p, holdings, folios));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor="#3b82f6" />}
      testID="family-screen"
    >
      <View style={styles.header}>
        <View><Text style={styles.category}>Multi-PAN Portfolios</Text><Text style={styles.title}>Family Wealth</Text></View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Plus size={16} color="#ffffff" /><Text style={styles.addBtnText}>Add Member</Text>
        </TouchableOpacity>
      </View>
      <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} onSelect={async (id) => { setActiveId(id); await setActiveProfileId(id); }} />
      <FamilyMetricsSummary metrics={activeMetrics} />
      <Text style={styles.sectionTitle}>Family Members ({profiles.length})</Text>
      <FamilyMemberList profiles={profiles} memberMetricsList={memberMetricsList} activeProfileId={activeProfileId} onSelectProfile={async (id) => { setActiveId(id); await setActiveProfileId(id); }} onDeleteProfile={async (id) => { await deleteFamilyProfile(id); await loadData(); }} />
      <AddMemberModal visible={showAddModal} onClose={() => setShowAddModal(false)} onAddMember={async (input) => { await addFamilyProfile(input); await loadData(); }} />
    </ScrollView>
  );
}
