import { useState } from 'react';
import axios from 'axios';
import api, { API_ENDPOINTS } from './api';
import type { ManagedProfile } from './components/Family/FamilySelector';

export interface UseDashboardMutationsParams {
  fetchSummary: () => Promise<void>;
  selectedProfileId: string | null;
  setConsolidated: () => void;
  resetScope: () => void;
  onPurgeSuccess: () => void;
}

export function useDashboardMutations({
  fetchSummary,
  selectedProfileId,
  setConsolidated,
  resetScope,
  onPurgeSuccess,
}: UseDashboardMutationsParams) {
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [profileToEdit, setProfileToEdit] = useState<ManagedProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editTaxSlab, setEditTaxSlab] = useState<number>(0.3);

  const handleUpdateProfile = async () => {
    if (!profileToEdit || !editName) return;
    try {
      await api.patch(`${API_ENDPOINTS.FAMILY}/profile/${profileToEdit.id}`, { name: editName, taxSlab: editTaxSlab });
      setProfileToEdit(null);
      setEditName('');
      fetchSummary();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update member profile. Please try again.');
    }
  };

  const handleDeleteProfile = async (profile: ManagedProfile) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete member "${profile.name}" (${profile.pan})? This will permanently delete all associated folios, transactions, and performance history.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`${API_ENDPOINTS.FAMILY}/profile/${profile.id}`);
      if (selectedProfileId === profile.id) setConsolidated();
      await fetchSummary();
    } catch (error: unknown) {
      console.error('Failed to delete member profile:', error);
      const errDetail = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
      alert(errDetail || 'Failed to delete member profile.');
    }
  };

  const handleDeleteFolio = async (folio: { id?: string | undefined; number?: string | undefined }) => {
    const confirmed = window.confirm(`Permanently delete folio "${folio.number || 'N/A'}" and all its historical transactions?`);
    if (!confirmed || !folio.id) return;
    try {
      await api.delete(`${API_ENDPOINTS.PORTFOLIO}/folio/${folio.id}`);
      await fetchSummary();
    } catch (error: unknown) {
      console.error('Failed to delete folio:', error);
      const errDetail = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
      alert(errDetail || 'Failed to delete folio.');
    }
  };

  const handleDeleteManualAsset = async (assetId: string) => {
    try {
      await api.delete(`${API_ENDPOINTS.PORTFOLIO}/manual-asset/${assetId}`);
      await fetchSummary();
    } catch {
      alert('Failed to delete asset');
    }
  };

  const handlePurge = async () => {
    if (!window.confirm('⚠️ CRITICAL ACTION: This will permanently delete ALL portfolios, transactions, goals, and family members. This cannot be undone. Proceed?')) {
      return;
    }
    try {
      await api.delete(`${API_ENDPOINTS.PORTFOLIO}/purge`);
      onPurgeSuccess();
      resetScope();
      alert('Environment has been reset successfully.');
    } catch (error) {
      console.error('Failed to purge data:', error);
      alert('Failed to clear data.');
    }
  };

  return {
    showAddAsset,
    setShowAddAsset,
    showPairModal,
    setShowPairModal,
    profileToEdit,
    setProfileToEdit,
    editName,
    setEditName,
    editTaxSlab,
    setEditTaxSlab,
    handleUpdateProfile,
    handleDeleteProfile,
    handleDeleteFolio,
    handleDeleteManualAsset,
    handlePurge,
  };
}
