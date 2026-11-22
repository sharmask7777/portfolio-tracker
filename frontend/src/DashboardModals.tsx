import { SimulationModal } from './components/Tax/SimulationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AddAssetModal } from './components/Dashboard/AddAssetModal';
import { PairMobileModal } from './components/PairMobileModal';
import { ProfileManagementModal } from './components/Dashboard/ProfileManagementModal';
import { CasUploadModal } from './components/Dashboard/CasUploadModal';
import { TransactionHistoryModal } from './components/Dashboard/TransactionHistoryModal';
import type { useDashboardController } from './useDashboardController';

export interface DashboardModalsProps {
  ctrl: ReturnType<typeof useDashboardController>;
}

function renderSimulationModal(ctrl: ReturnType<typeof useDashboardController>) {
  if (!ctrl.simFolio) return null;
  return (
    <ErrorBoundary>
      <SimulationModal
        folio={ctrl.simFolio}
        initialUnits={ctrl.simUnits || undefined}
        taxSlab={ctrl.portfolio?.taxSlab || 0.3}
        onClose={() => {
          ctrl.setSimFolio(null);
          ctrl.setSimUnits(null);
        }}
      />
    </ErrorBoundary>
  );
}

function renderTransactionModal(ctrl: ReturnType<typeof useDashboardController>) {
  if (!ctrl.selectedFolioForTransactions) return null;
  return (
    <TransactionHistoryModal
      folio={ctrl.selectedFolioForTransactions}
      onClose={() => ctrl.setSelectedFolioForTransactions(null)}
      onDeleteFolio={ctrl.handleDeleteFolio}
    />
  );
}

export function DashboardModals({ ctrl }: DashboardModalsProps) {
  return (
    <>
      {renderSimulationModal(ctrl)}
      <ProfileManagementModal
        isOpen={Boolean(ctrl.profileToEdit)}
        editName={ctrl.editName}
        editTaxSlab={ctrl.editTaxSlab}
        onEditNameChange={ctrl.setEditName}
        onEditTaxSlabChange={ctrl.setEditTaxSlab}
        onSave={ctrl.handleUpdateProfile}
        onClose={() => ctrl.setProfileToEdit(null)}
      />
      {ctrl.showAddAsset && (
        <AddAssetModal
          onClose={() => ctrl.setShowAddAsset(false)}
          onSuccess={ctrl.fetchSummary}
          profiles={ctrl.profiles}
          selectedProfileId={ctrl.selectedProfileId}
        />
      )}
      <PairMobileModal isOpen={ctrl.showPairModal} onClose={() => ctrl.setShowPairModal(false)} />
      <CasUploadModal
        isOpen={ctrl.showUpload}
        uploading={ctrl.uploading}
        uploadStatusMsg={ctrl.uploadStatusMsg}
        password={ctrl.password}
        onPasswordChange={ctrl.setPassword}
        onFileUpload={ctrl.handleFileUpload}
        onClose={() => ctrl.setShowUpload(false)}
      />
      {renderTransactionModal(ctrl)}
    </>
  );
}
