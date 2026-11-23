import { Plus } from 'lucide-react';
import { FamilySelector, type ManagedProfile } from './components/Family/FamilySelector';
import type { PanBreakdownDto } from './types/generated/PanBreakdownDto';

export interface DashboardActionHeaderProps {
  profiles: ManagedProfile[];
  selectedProfileId: string | null;
  onProfileSelect: (id: string | null) => void;
  panBreakdowns?: PanBreakdownDto[] | undefined;
  totalFolios?: number | undefined;
  onRenameProfile: (profile: ManagedProfile) => void;
  onDeleteProfile: (profile: ManagedProfile) => void;
  onAddAsset: () => void;
  onImportCas: () => void;
}

export function DashboardActionHeader({
  profiles,
  selectedProfileId,
  onProfileSelect,
  panBreakdowns,
  totalFolios,
  onRenameProfile,
  onDeleteProfile,
  onAddAsset,
  onImportCas,
}: DashboardActionHeaderProps) {
  return (
    <div className="action-container">
      <FamilySelector
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelect={onProfileSelect}
        panBreakdowns={panBreakdowns}
        totalFolios={totalFolios}
        onRename={onRenameProfile}
        onDelete={onDeleteProfile}
      />
      <div className="action-bar">
        <button className="btn" style={{ border: '1px solid var(--border-color)' }} onClick={onAddAsset}>
          <Plus size={18} /> Add Other Asset
        </button>
        <button className="btn btn-primary" onClick={onImportCas}>
          <Plus size={18} /> Import CAS
        </button>
      </div>
    </div>
  );
}
