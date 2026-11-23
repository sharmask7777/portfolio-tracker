import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';

import { DashboardHeaderBar } from './components/Dashboard/DashboardHeaderBar';
import { DashboardNavigationTabs, type DashboardTab } from './components/Dashboard/DashboardNavigationTabs';
import { EmptyStatePlaceholder } from './components/Dashboard/EmptyStatePlaceholder';
import { DashboardActionHeader } from './DashboardActionHeader';
import { ActiveTabRouter } from './ActiveTabRouter';
import { DashboardModals } from './DashboardModals';
import { useDashboardController } from './useDashboardController';
import { useAuth } from './contexts/AuthContext';

import LoginPage from './components/Auth/LoginPage';
import SignupPage from './components/Auth/SignupPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import './App.css';

function renderDashboardBody(
  activeTab: DashboardTab,
  setActiveTab: (tab: DashboardTab) => void,
  ctrl: ReturnType<typeof useDashboardController>
) {
  if (!ctrl.portfolio) {
    return (
      <EmptyStatePlaceholder
        onAddAsset={() => ctrl.setShowAddAsset(true)}
        onUpload={() => ctrl.setShowUpload(true)}
      />
    );
  }

  return (
    <>
      <DashboardNavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />
      <ActiveTabRouter activeTab={activeTab} ctrl={ctrl} onSelectTab={setActiveTab} />
    </>
  );
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const ctrl = useDashboardController();

  if (ctrl.loading || ctrl.uploading) {
    return (
      <div className="loading-state">
        {ctrl.uploading ? ctrl.uploadStatusMsg || 'Parsing CAS and Generating History...' : 'Loading your portfolio...'}
      </div>
    );
  }

  return (
    <div className="app">
      <DashboardHeaderBar
        performanceMode={ctrl.performanceMode}
        onSetPerformanceMode={ctrl.setPerformanceMode}
        theme={ctrl.theme}
        onToggleTheme={ctrl.toggleTheme}
        onOpenPairModal={() => ctrl.setShowPairModal(true)}
        userEmail={user?.email}
        onLogout={logout}
        onPurge={ctrl.handlePurge}
      />

      <main className="main-content">
        <DashboardActionHeader
          profiles={ctrl.profiles}
          selectedProfileId={ctrl.selectedProfileId}
          onProfileSelect={ctrl.handleProfileSelect}
          panBreakdowns={ctrl.portfolio?.panBreakdowns}
          totalFolios={ctrl.portfolio?.folios.length || undefined}
          onRenameProfile={(p) => {
            ctrl.setProfileToEdit(p);
            ctrl.setEditName(p.name);
            ctrl.setEditTaxSlab(p.taxSlab || 0.3);
          }}
          onDeleteProfile={ctrl.handleDeleteProfile}
          onAddAsset={() => ctrl.setShowAddAsset(true)}
          onImportCas={() => ctrl.setShowUpload(true)}
        />
        {renderDashboardBody(activeTab, setActiveTab, ctrl)}
      </main>

      <DashboardModals ctrl={ctrl} />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
