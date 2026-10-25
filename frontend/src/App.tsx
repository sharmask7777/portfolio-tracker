import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  LayoutDashboard, 
  Upload as UploadIcon, 
  Moon, 
  Sun,
  Plus,
  PieChart as PieChartIcon,
  Layers,
  Calculator,
  ShieldCheck,
  BrainCircuit,
  LogOut,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { XRayView } from './components/Analytics/XRayView';
import { IntersectionView } from './components/Analytics/IntersectionView';
import { TaxView } from './components/Tax/TaxView';
import { SimulationModal } from './components/Tax/SimulationModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AddAssetModal } from './components/Dashboard/AddAssetModal';
import { InsightsSidebar } from './components/Insights/InsightsSidebar';
import { GoalTracker } from './components/Insights/GoalTracker';
import { useSettings } from './contexts/SettingsContext';
import { useAuth } from './contexts/AuthContext';
import { sortSchemeGroups } from './utils/sorting';
import { consolidateFoliosIntoSchemes } from './utils/consolidation';
import type { SortField, SortDirection } from './utils/sorting';
import './App.css';

import { FamilySelector } from './components/Family/FamilySelector';
import { StatsGrid } from './components/Dashboard/StatsGrid';
import { HistoryChart } from './components/Dashboard/HistoryChart';
import { HistoricalHighlightsCard } from './components/Dashboard/HistoricalHighlightsCard';
import { TransactionSidePanel } from './components/Dashboard/TransactionSidePanel';
import api, { API_ENDPOINTS } from './api';

export function Dashboard() {
  const { theme, toggleTheme, performanceMode, setPerformanceMode } = useSettings();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'xray' | 'intersection' | 'tax' | 'insights'>('overview');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    return localStorage.getItem('portfolio_selected_profile_id') || null;
  });

  const handleProfileSelect = (id: string | null) => {
    setSelectedProfileId(id);
    setSelectedFamilyId(null);
    if (id) {
      localStorage.setItem('portfolio_selected_profile_id', id);
    } else {
      localStorage.removeItem('portfolio_selected_profile_id');
    }
  };
  const [portfolio, setPortfolio] = useState<any>(null);
  const [xrayData, setXRayData] = useState<any>(null);
  const [exposures, setExposures] = useState<any[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [harvesting, setHarvesting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [simFolio, setSimFolio] = useState<any>(null);
  const [simUnits, setSimUnits] = useState<number | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState('');
  const [profileToEdit, setProfileToEdit] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editTaxSlab, setEditTaxSlab] = useState<number>(0.3);
  const [selectedFolioForTransactions, setSelectedFolioForTransactions] = useState<any>(null);

  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');

  const [sortField, setSortField] = useState<SortField | null>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection | null>('desc');
  const [expandedSchemeIds, setExpandedSchemeIds] = useState<Set<string>>(new Set());
  const [showClosedFolios, setShowClosedFolios] = useState<boolean>(false);

  const toggleSchemeExpanded = (schemeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedSchemeIds(prev => {
      const next = new Set(prev);
      if (next.has(schemeId)) next.delete(schemeId);
      else next.add(schemeId);
      return next;
    });
  };

  const schemeGroups = React.useMemo(() => {
    return consolidateFoliosIntoSchemes(portfolio?.folios || []);
  }, [portfolio?.folios]);

  const sortedSchemeGroups = React.useMemo(() => {
    return sortSchemeGroups(schemeGroups, sortField, sortDirection, performanceMode);
  }, [schemeGroups, sortField, sortDirection, performanceMode]);

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('desc');
    } else {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    }
  };

  const renderSortableHeader = (label: string, field: SortField) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)} 
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? <ArrowUp size={14} style={{ color: 'var(--accent-color)' }} /> : <ArrowDown size={14} style={{ color: 'var(--accent-color)' }} />
          ) : (
            <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
          )}
        </div>
      </th>
    );
  };

  const fetchSummary = async () => {
    try {
      if (!portfolio) {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }
      const [summaryRes, profilesRes] = await Promise.all([
        api.get(`${API_ENDPOINTS.PORTFOLIO}/summary`, {
          params: {
            familyGroupId: selectedFamilyId,
            profileId: selectedProfileId,
          }
        }),
        api.get(`${API_ENDPOINTS.FAMILY}/profiles`)
      ]);
      
      setPortfolio(summaryRes.data);
      setProfiles(profilesRes.data);

      if (selectedProfileId && Array.isArray(profilesRes.data) && profilesRes.data.length > 0 && !profilesRes.data.some((p: any) => p.id === selectedProfileId)) {
        setSelectedProfileId(null);
        localStorage.removeItem('portfolio_selected_profile_id');
      }
      if (summaryRes?.data?.id) {
        const [xrayRes, exposuresRes, taxRes, harvestingRes] = await Promise.allSettled([
          api.get(`${API_ENDPOINTS.PORTFOLIO}/${summaryRes.data.id}/xray`),
          api.get(`${API_ENDPOINTS.PORTFOLIO}/${summaryRes.data.id}/exposures`),
          api.get(`${API_ENDPOINTS.PORTFOLIO}/${summaryRes.data.id}/tax-summary`),
          api.get(`${API_ENDPOINTS.TAX}/harvesting-opportunities`, {
            params: { scopeId: summaryRes.data.id }
          }),
        ]);
        if (xrayRes.status === 'fulfilled') setXRayData(xrayRes.value.data);
        if (exposuresRes.status === 'fulfilled') setExposures(exposuresRes.value.data || []);
        if (taxRes.status === 'fulfilled') setTaxSummary(taxRes.value.data);
        if (harvestingRes.status === 'fulfilled') setHarvesting(harvestingRes.value.data);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedFamilyId, selectedProfileId]);

  const pollJobStatus = async (jobId: string) => {
    setUploadStatusMsg('Processing portfolio... This may take a few minutes.');
    
    const checkStatus = async () => {
      try {
        const res = await api.get(`${API_ENDPOINTS.PORTFOLIO}/upload-status/${jobId}`);
        const { status, message } = res.data;
        
        if (status === 'COMPLETED') {
          setShowUpload(false);
          setPassword('');
          setUploading(false);
          setUploadStatusMsg('');
          await fetchSummary();
        } else if (status === 'FAILED') {
          setUploading(false);
          setUploadStatusMsg('');
          alert(`Processing failed: ${message || 'Unknown error'}`);
        } else {
          // PENDING or PROCESSING
          setUploadStatusMsg(`Processing... (${status.toLowerCase()})`);
          setTimeout(checkStatus, 3000); // Check again in 3s
        }
      } catch (err) {
        console.error("Error polling job status:", err);
        setUploading(false);
        setUploadStatusMsg('');
        alert('Lost connection to processing status.');
      }
    };

    setTimeout(checkStatus, 2000); // Start checking after 2s
  };

  const handleUpdateProfile = async () => {
    if (!profileToEdit || !editName) return;
    try {
      await api.patch(`${API_ENDPOINTS.FAMILY}/profile/${profileToEdit.id}`, {
        name: editName,
        taxSlab: editTaxSlab
      });
      setProfileToEdit(null);
      setEditName('');
      fetchSummary();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update member profile. Please try again.');
    }
  };

  const handleDeleteProfile = async (profile: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete member "${profile.name}" (${profile.pan})? This will permanently delete all associated folios, transactions, and performance history.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete(`${API_ENDPOINTS.FAMILY}/profile/${profile.id}`);
      if (selectedProfileId === profile.id) {
        setSelectedProfileId(null);
        localStorage.removeItem('portfolio_selected_profile_id');
      }
      await fetchSummary();
    } catch (error: any) {
      console.error('Failed to delete member profile:', error);
      alert(error.response?.data?.error || 'Failed to delete member profile.');
    } finally {
      setLoading(false);
    }
  };



  const handleDeleteFolio = async (folio: any) => {
    const confirmed = window.confirm(
      `Permanently delete folio "${folio.number || 'N/A'}" and all its historical transactions?`
    );
    if (!confirmed) return;

    try {
      await api.delete(`${API_ENDPOINTS.PORTFOLIO}/folio/${folio.id}`);
      setSelectedFolioForTransactions(null);
      await fetchSummary();
    } catch (error: any) {
      console.error('Failed to delete folio:', error);
      alert(error.response?.data?.error || 'Failed to delete folio.');
    }
  };

  const handlePurge = async () => {
    if (!window.confirm('⚠️ CRITICAL ACTION: This will permanently delete ALL portfolios, transactions, goals, and family members. This cannot be undone. Proceed?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`${API_ENDPOINTS.PORTFOLIO}/purge`);
      // Reset all state to clean environment
      setPortfolio(null);
      setProfiles([]);
      setXRayData(null);
      setExposures([]);
      setTaxSummary(null);
      setHarvesting(null);
      setSelectedProfileId(null);
      setSelectedFamilyId(null);
      localStorage.removeItem('portfolio_selected_profile_id');
      alert('Environment has been reset successfully.');
    } catch (error) {
      console.error('Failed to purge data:', error);
      alert('Failed to clear data.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    try {
      setUploading(true);
      setUploadStatusMsg('Uploading file...');
      const res = await api.post(`${API_ENDPOINTS.PORTFOLIO}/upload`, formData);
      if (res.status === 202 && res.data.jobId) {
        pollJobStatus(res.data.jobId);
      } else {
        // Fallback for older synchronous behavior or unexpected responses
        setShowUpload(false);
        setPassword('');
        await fetchSummary();
        setUploading(false);
        setUploadStatusMsg('');
      }
    } catch (err: any) {
      setUploading(false);
      setUploadStatusMsg('');
      const msg = err.response?.data?.error || 'Upload failed. Please check your password or file format.';
      alert(msg);
    }
  };

  const isValidNumber = (val: unknown): val is number => typeof val === 'number' && !isNaN(val);

  const getReturnClass = (val: unknown) => {
    if (!isValidNumber(val)) return '';
    return val > 0 ? 'positive' : val < 0 ? 'negative' : '';
  };

  const formatCurrency = (val: unknown) => {
    if (!isValidNumber(val)) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: unknown) => {
    if (!isValidNumber(val)) return 'N/A';
    return `${(val * 100).toFixed(2)}%`;
  };

  if (loading || uploading) {
    return <div className="loading-state">{uploading ? uploadStatusMsg || 'Parsing CAS and Generating History...' : 'Loading your portfolio...'}</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <LayoutDashboard size={24} />
          <span>Portfolio Tracker</span>
        </div>
        <div className="header-actions">
          <div className="segmented-control">
            <button 
              className={performanceMode === 'XIRR' ? 'active' : ''} 
              onClick={() => setPerformanceMode('XIRR')}
            >
              XIRR
            </button>
            <button 
              className={performanceMode === 'ABS' ? 'active' : ''} 
              onClick={() => setPerformanceMode('ABS')}
            >
              ABS
            </button>
          </div>
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.email.split('@')[0]}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Free Plan</div>
            </div>
            <button 
              className="theme-toggle" 
              title="Logout" 
              onClick={logout}
              style={{ color: 'var(--danger-color)' }}
            >
              <LogOut size={20} />
            </button>
            <button 
              className="btn btn-danger" 
              style={{ marginLeft: '0.5rem', backgroundColor: 'var(--danger-color)', color: 'var(--bg-primary)', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }} 
              onClick={handlePurge}
            >
              Purge
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="action-container">
          <FamilySelector 
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelect={handleProfileSelect}
            onRename={(p) => {
              setProfileToEdit(p);
              setEditName(p.name);
              setEditTaxSlab(p.taxSlab || 0.3);
            }}
            onDelete={handleDeleteProfile}
          />

          <div className="action-bar">
            <button className="btn" style={{ border: '1px solid var(--border-color)' }} onClick={() => setShowAddAsset(true)}>
              <Plus size={18} /> Add Other Asset
            </button>
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Plus size={18} /> Import CAS
            </button>
          </div>
        </div>

        {!portfolio ? (
          <div className="empty-state">
            <h2>No portfolio data found</h2>
            <p>Upload your CAMS CAS statement to get started.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn" style={{ border: '1px solid var(--border-color)' }} onClick={() => setShowAddAsset(true)}>
                <Plus size={18} /> Add Other Asset
              </button>
              <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                <UploadIcon size={18} /> Upload CAS
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <LayoutDashboard size={16} style={{ marginRight: '0.5rem' }} /> Overview
              </button>
              <button 
                className={`tab ${activeTab === 'xray' ? 'active' : ''}`}
                onClick={() => setActiveTab('xray')}
              >
                <PieChartIcon size={16} style={{ marginRight: '0.5rem' }} /> Portfolio X-Ray
              </button>
              <button 
                className={`tab ${activeTab === 'intersection' ? 'active' : ''}`}
                onClick={() => setActiveTab('intersection')}
              >
                <Layers size={16} style={{ marginRight: '0.5rem' }} /> Stock Intersection
              </button>
              <button 
                className={`tab ${activeTab === 'tax' ? 'active' : ''}`}
                onClick={() => setActiveTab('tax')}
              >
                <ShieldCheck size={16} style={{ marginRight: '0.5rem' }} /> Tax Optimization
              </button>
              <button 
                className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
                onClick={() => setActiveTab('insights')}
              >
                <BrainCircuit size={16} style={{ marginRight: '0.5rem' }} /> Health & Goals
              </button>
            </div>

            {activeTab === 'overview' && (
              <>
                <StatsGrid 
                  metrics={portfolio.metrics}
                  performanceMode={performanceMode}
                />

                <HistoryChart portfolioId={portfolio.id} />

                <div className="dashboard-sections">
                  <div className="card">
                    <h3>Scheme Breakdown</h3>
                    <div className="chart-container" style={{ marginTop: '1rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={schemeGroups.map((g: any) => ({ name: g.schemeName, value: g.metrics.currentValue }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 11 }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            tick={{ fontSize: 11 }}
                            tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            formatter={(val: unknown) => formatCurrency(Number(val))}
                          />
                          <Bar dataKey="value" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="card">
                    <h3>Key Insights</h3>
                    <div style={{ marginTop: '1rem' }}>
                      {schemeGroups.length > 0 && (() => {
                        const activeGroups = schemeGroups.filter((g: any) => g.metrics.currentValue >= 1.00);
                        if (activeGroups.length === 0) return null;
                        const sorted = [...activeGroups].sort((a: any, b: any) => {
                          const aVal = performanceMode === 'XIRR' ? (a.metrics.xirr ?? 0) : (a.metrics.absoluteReturn ?? 0);
                          const bVal = performanceMode === 'XIRR' ? (b.metrics.xirr ?? 0) : (b.metrics.absoluteReturn ?? 0);
                          return bVal - aVal;
                        });
                        const top = sorted[0];
                        const value = performanceMode === 'XIRR' ? top.metrics.xirr : top.metrics.absoluteReturn;
                        return (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Your top performing asset is <strong>{top.schemeName}</strong> with {performanceMode === 'XIRR' ? 'an XIRR' : 'a return'} of <span className="positive">{formatPercent(value || 0)}</span>.
                          </p>
                        );
                      })()}
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Top Stock Exposure</p>
                        {exposures && exposures.length > 0 && exposures[0] ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem' }}>{exposures[0].name}</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatPercent(exposures[0].percentage)}</span>
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            No equity exposures identified
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <HistoricalHighlightsCard portfolioId={portfolio.id} />
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {renderSortableHeader('Scheme Name', 'name')}
                        {renderSortableHeader('Type', 'type')}
                        {renderSortableHeader('Invested', 'invested')}
                        {renderSortableHeader('Current Value', 'value')}
                        {renderSortableHeader('Day Change', 'dayChange')}
                        {renderSortableHeader(performanceMode === 'XIRR' ? 'XIRR' : 'Return', 'performance')}
                        {renderSortableHeader(`Post-Tax ${performanceMode === 'XIRR' ? 'XIRR' : 'Return'}`, 'postTaxPerformance')}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSchemeGroups.map((group: any) => {
                        const isMultiFolio = group.folioCount > 1;
                        const isExpanded = expandedSchemeIds.has(group.id);

                        return (
                          <React.Fragment key={group.id}>
                            <tr 
                              className={`scheme-master-row ${isMultiFolio ? 'has-multiple-folios' : ''}`}
                              onClick={() => {
                                if (isMultiFolio) {
                                  toggleSchemeExpanded(group.id);
                                } else {
                                  setSelectedFolioForTransactions(group.folios[0]);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <td style={{ fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {isMultiFolio && (
                                    <button 
                                      className="theme-toggle" 
                                      style={{ padding: '2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                      onClick={(e) => toggleSchemeExpanded(group.id, e)}
                                      title={isExpanded ? "Collapse folios" : "Expand folios"}
                                    >
                                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                  )}
                                  <span>{group.schemeName}</span>
                                  {selectedProfileId === null && group.pans && group.pans.length > 0 && (
                                    <span 
                                      className="badge badge-slab" 
                                      style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                                      title={`Member PAN: ${group.pans.join(', ')}`}
                                    >
                                      {group.pans.join(', ')}
                                    </span>
                                  )}
                                  {isMultiFolio && (
                                    <span className="badge badge-slab" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                      {group.folioCount} Folios
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className="badge badge-slab">{group.type.replace('_', ' ')}</span>
                              </td>
                              <td>{formatCurrency(group.metrics.investedAmount)}</td>
                              <td>{formatCurrency(group.metrics.currentValue)}</td>
                              <td className={getReturnClass(group.metrics.dayChange)}>
                                {isValidNumber(group.metrics.dayChange) ? (
                                  <>
                                    {group.metrics.dayChange > 0 ? '+' : ''}{formatCurrency(group.metrics.dayChange)}
                                    <div style={{ fontSize: '0.75rem' }}>
                                      ({isValidNumber(group.metrics.dayChangePercentage) ? `${group.metrics.dayChangePercentage > 0 ? '+' : ''}${group.metrics.dayChangePercentage.toFixed(2)}%` : 'N/A'})
                                    </div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className={getReturnClass(performanceMode === 'XIRR' ? group.metrics.xirr : group.metrics.absoluteReturn)}>
                                {formatPercent(performanceMode === 'XIRR' ? group.metrics.xirr : group.metrics.absoluteReturn)}
                              </td>
                              <td 
                                className={getReturnClass(performanceMode === 'XIRR' ? group.metrics.postTaxXirr : group.metrics.postTaxAbsoluteReturn)}
                                style={{ opacity: isRefetching ? 0.5 : 1, transition: 'opacity 0.2s, color 0.2s' }}
                              >
                                {formatPercent(performanceMode === 'XIRR' ? group.metrics.postTaxXirr : group.metrics.postTaxAbsoluteReturn)}
                              </td>
                              <td>
                                {!isMultiFolio ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button 
                                      className="theme-toggle" 
                                      title="Simulate Sell Tax" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSimFolio(group.folios[0]);
                                        setSimUnits(null);
                                      }}
                                    >
                                      <Calculator size={16} />
                                    </button>
                                    {group.folios[0]?.number && group.folios[0].number.startsWith('MANUAL_') ? (
                                      <button 
                                        className="theme-toggle" 
                                        title="Delete Asset" 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (window.confirm('Are you sure you want to delete this asset?')) {
                                            try {
                                              await api.delete(`${API_ENDPOINTS.PORTFOLIO}/manual-asset/${group.folios[0].id}`);
                                              fetchSummary();
                                            } catch (e) {
                                              alert('Failed to delete asset');
                                            }
                                          }
                                        }}
                                        style={{ marginLeft: '0.25rem', color: 'var(--danger-color)' }}
                                      >
                                        <X size={16} />
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <button 
                                    className="theme-toggle" 
                                    onClick={(e) => toggleSchemeExpanded(group.id, e)}
                                    title={isExpanded ? "Collapse folios" : "Expand folios"}
                                  >
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                )}
                              </td>
                            </tr>

                            {isMultiFolio && isExpanded && group.folios.map((folio: any) => (
                              <tr 
                                key={folio.id} 
                                onClick={() => setSelectedFolioForTransactions(folio)}
                                style={{ cursor: 'pointer', backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.03))' }}
                                className="folio-child-row"
                              >
                                <td style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>└─</span>
                                    <span style={{ fontWeight: 500 }}>Folio: {folio.number || 'N/A'}</span>
                                    {folio.pan && <span className="badge" style={{ fontSize: '0.65rem' }}>{folio.pan}</span>}
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Individual Folio</span>
                                </td>
                                <td>{formatCurrency(folio.metrics?.investedAmount)}</td>
                                <td>{formatCurrency(folio.metrics?.currentValue)}</td>
                                <td className={getReturnClass(folio.metrics?.dayChange)}>
                                  {isValidNumber(folio.metrics?.dayChange) ? (
                                    <>
                                      {folio.metrics.dayChange > 0 ? '+' : ''}{formatCurrency(folio.metrics.dayChange)}
                                      <div style={{ fontSize: '0.75rem' }}>
                                        ({isValidNumber(folio.metrics.dayChangePercentage) ? `${folio.metrics.dayChangePercentage > 0 ? '+' : ''}${folio.metrics.dayChangePercentage.toFixed(2)}%` : 'N/A'})
                                      </div>
                                    </>
                                  ) : '-'}
                                </td>
                                <td className={getReturnClass(performanceMode === 'XIRR' ? folio.metrics?.xirr : folio.metrics?.absoluteReturn)}>
                                  {formatPercent(performanceMode === 'XIRR' ? folio.metrics?.xirr : folio.metrics?.absoluteReturn)}
                                </td>
                                <td 
                                  className={getReturnClass(performanceMode === 'XIRR' ? folio.metrics?.postTaxXirr : folio.metrics?.postTaxAbsoluteReturn)}
                                  style={{ opacity: isRefetching ? 0.5 : 1, transition: 'opacity 0.2s, color 0.2s' }}
                                >
                                  {formatPercent(performanceMode === 'XIRR' ? folio.metrics?.postTaxXirr : folio.metrics?.postTaxAbsoluteReturn)}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button 
                                      className="theme-toggle" 
                                      title="Simulate Sell Tax" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSimFolio(folio);
                                        setSimUnits(null);
                                      }}
                                    >
                                      <Calculator size={16} />
                                    </button>
                                    {folio.number && folio.number.startsWith('MANUAL_') ? (
                                      <button 
                                        className="theme-toggle" 
                                        title="Delete Asset" 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (window.confirm('Are you sure you want to delete this asset?')) {
                                            try {
                                              await api.delete(`${API_ENDPOINTS.PORTFOLIO}/manual-asset/${folio.id}`);
                                              fetchSummary();
                                            } catch (e) {
                                              alert('Failed to delete asset');
                                            }
                                          }
                                        }}
                                        style={{ marginLeft: '0.25rem', color: 'var(--danger-color)' }}
                                      >
                                        <X size={16} />
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {portfolio?.closedFolios && portfolio.closedFolios.length > 0 && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div 
                      onClick={() => setShowClosedFolios(!showClosedFolios)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {showClosedFolios ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          Closed / Fully Redeemed Positions ({portfolio.closedFolios.length})
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {showClosedFolios ? 'Hide' : 'Show'}
                      </span>
                    </div>

                    {showClosedFolios && (
                      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                        <table className="data-table" style={{ opacity: 0.85 }}>
                          <thead>
                            <tr>
                              <th>Scheme Name</th>
                              <th>Folio</th>
                              <th>Status</th>
                              <th>Type</th>
                              <th>Historical XIRR / Return</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portfolio.closedFolios.map((cf: any) => (
                              <tr 
                                key={cf.id}
                                onClick={() => setSelectedFolioForTransactions(cf)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td>{cf.asset?.name || 'Unknown'}</td>
                                <td>{cf.number || 'N/A'}</td>
                                <td><span className="badge badge-slab" style={{ backgroundColor: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-secondary)' }}>Fully Redeemed</span></td>
                                <td><span className="badge badge-slab">{cf.asset?.type}</span></td>
                                <td>{formatPercent(cf.metrics?.xirr || cf.metrics?.absoluteReturn || 0)}</td>
                                <td>
                                  <button
                                    className="theme-toggle"
                                    title="Delete Folio"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFolio(cf);
                                    }}
                                    style={{ color: 'var(--danger-color)', padding: '2px 6px' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'xray' && <XRayView data={xrayData} />}
            {activeTab === 'intersection' && (
              <IntersectionView
                exposures={exposures}
                isLoading={loading}
                onUploadClick={() => setShowUpload(true)}
              />
            )}
            {activeTab === 'tax' && (
              <ErrorBoundary>
                <TaxView 
                  summary={taxSummary} 
                  harvesting={harvesting} 
                  onSimulateHarvest={(folioId, units) => {
                    const folio = portfolio.folios.find((f: any) => f.id === folioId);
                    if (folio) {
                      setSimFolio(folio);
                      setSimUnits(units);
                    }
                  }}
                />
              </ErrorBoundary>
            )}
            {activeTab === 'insights' && (
              <div className="xray-grid">
                <InsightsSidebar portfolioId={portfolio.id} />
                <GoalTracker 
                  portfolioId={portfolio.id} 
                  currentValue={portfolio.metrics.totalValue} 
                  activeAssets={(() => {
                    const uniqueAssets = new Map();
                    portfolio.folios.forEach((f: any) => {
                      if (f.asset) {
                        uniqueAssets.set(f.asset.id, f.asset);
                      }
                    });
                    return Array.from(uniqueAssets.values());
                  })()}
                />
              </div>
            )}
          </>
        )}
      </main>

      {simFolio && (
        <ErrorBoundary>
          <SimulationModal
            folio={simFolio}
            initialUnits={simUnits || undefined}
            taxSlab={portfolio?.taxSlab || 0.3}
            onClose={() => {
              setSimFolio(null);
              setSimUnits(null);
            }}
          />
        </ErrorBoundary>
      )}
      {profileToEdit && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Edit Member</h2>
              <button onClick={() => setProfileToEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                DISPLAY NAME
              </label>
              <input 
                type="text" 
                className="card" 
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', outline: 'none' }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                TAX SLAB (e.g. 0.3 for 30%)
              </label>
              <input 
                type="number" 
                step="0.05"
                min="0"
                max="1"
                className="card" 
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', outline: 'none' }}
                value={editTaxSlab}
                onChange={(e) => setEditTaxSlab(parseFloat(e.target.value))}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border-color)' }} onClick={() => setProfileToEdit(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdateProfile}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddAsset && <AddAssetModal onClose={() => setShowAddAsset(false)} onSuccess={fetchSummary} profiles={profiles} selectedProfileId={selectedProfileId} />}

      {showUpload && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Import CAS Statement</h2>
              <button onClick={() => !uploading && setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: '1.5' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent-color)' }}>How to get your CAS:</strong>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
                <li>Go to <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>CAMS Online</a></li>
                <li>Select <strong>Detailed</strong> Statement type.</li>
                <li>Select <strong>Specific Period</strong> and set 'From Date' to <strong>01-Jan-2003</strong>.</li>
                <li>Enter your registered email and include <strong>Zero Balance Portfolios</strong>.</li>
                <li>You will receive a PDF via email. Upload that file here.</li>
              </ol>
            </div>

            <p style={{ marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              PDF PASSWORD (USUALLY YOUR PAN IN CAPS)
            </p>
            <input 
              type="password" 
              placeholder="Enter PDF Password" 
              className="card" 
              style={{ width: '100%', marginBottom: '1.5rem', outline: 'none', padding: '0.75rem' }} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={uploading}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label className="btn btn-primary" style={{ flex: 1, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                {uploading ? uploadStatusMsg || 'Processing...' : 'Select File & Upload'}
                <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
              </label>
              <button className="btn" onClick={() => setShowUpload(false)} disabled={uploading} style={{ border: '1px solid var(--border-color)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFolioForTransactions && (
        <TransactionSidePanel 
          folio={selectedFolioForTransactions} 
          onClose={() => setSelectedFolioForTransactions(null)} 
          onDeleteFolio={handleDeleteFolio}
        />
      )}
    </div>
  );
}

import { Routes, Route } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage';
import SignupPage from './components/Auth/SignupPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';

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
