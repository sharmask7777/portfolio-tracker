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
  X
} from 'lucide-react';
import { XRayView } from './components/Analytics/XRayView';
import { IntersectionView } from './components/Analytics/IntersectionView';
import { TaxView } from './components/Tax/TaxView';
import { SimulationModal } from './components/Tax/SimulationModal';
import { AddAssetModal } from './components/Dashboard/AddAssetModal';
import { InsightsSidebar } from './components/Insights/InsightsSidebar';
import { GoalTracker } from './components/Insights/GoalTracker';
import { useSettings } from './contexts/SettingsContext';
import { useAuth } from './contexts/AuthContext';
import './App.css';

import { FamilySelector } from './components/Family/FamilySelector';
import { StatsGrid } from './components/Dashboard/StatsGrid';
import { HistoryChart } from './components/Dashboard/HistoryChart';
import { HistoricalHighlightsCard } from './components/Dashboard/HistoricalHighlightsCard';
import api, { API_ENDPOINTS } from './api';

export function Dashboard() {
  const { theme, toggleTheme, performanceMode, setPerformanceMode, taxSlab, setTaxSlab } = useSettings();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'xray' | 'intersection' | 'tax' | 'insights'>('overview');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
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
  const [renamingProfile, setRenamingProfile] = useState<any>(null);
  const [newName, setNewName] = useState('');

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
            taxSlab: taxSlab
          }
        }),
        api.get(`${API_ENDPOINTS.FAMILY}/profiles`)
      ]);
      
      setPortfolio(summaryRes.data);
      setProfiles(profilesRes.data);
      
      if (summaryRes.data.id) {
        const [xrayRes, exposuresRes, taxRes, harvestingRes] = await Promise.all([
          api.get(`${API_ENDPOINTS.PORTFOLIO}/${summaryRes.data.id}/xray`),
          api.get(`${API_ENDPOINTS.PORTFOLIO}/${summaryRes.data.id}/exposures`),
          api.get(`${API_ENDPOINTS.PORTFOLIO}/${summaryRes.data.id}/tax-summary`, {
            params: { taxSlab }
          }),
          api.get(`${API_ENDPOINTS.TAX}/harvesting-opportunities`, {
            params: { scopeId: summaryRes.data.id }
          }),
        ]);
        setXRayData(xrayRes.data);
        setExposures(exposuresRes.data);
        setTaxSummary(taxRes.data);
        setHarvesting(harvestingRes.data);
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
  }, [selectedFamilyId, selectedProfileId, taxSlab]);

  const handleRename = async () => {
    if (!renamingProfile || !newName) return;
    try {
      await api.patch(`${API_ENDPOINTS.FAMILY}/profile/${renamingProfile.id}`, {
        name: newName
      });
      setRenamingProfile(null);
      setNewName('');
      fetchSummary();
    } catch (error) {
      console.error('Error renaming profile:', error);
      alert('Failed to rename member profile. Please try again.');
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
      await api.post(`${API_ENDPOINTS.PORTFOLIO}/upload`, formData);
      setShowUpload(false);
      setPassword('');
      await fetchSummary();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Upload failed. Please check your password or file format.';
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(2)}%`;
  };

  if (loading || uploading) {
    return <div className="loading-state">{uploading ? 'Parsing CAS and Generating History...' : 'Loading your portfolio...'}</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <LayoutDashboard size={24} />
          <span>Portfolio Tracker</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.25rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TAX SLAB</span>
            <input 
              type="number" 
              step="0.05"
              min="0"
              max="1"
              value={taxSlab}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTaxSlab(isNaN(val) ? 0 : val);
              }}
              style={{ width: '70px', paddingRight: '12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', outline: 'none' }}
            />
          </div>
          <button className="btn" style={{ border: '1px solid var(--border-color)' }} onClick={() => setShowAddAsset(true)}>
            <Plus size={18} /> Add Other Asset
          </button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            <Plus size={18} /> Import CAS
          </button>
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
              style={{ marginLeft: '0.5rem', backgroundColor: 'var(--danger-color)', color: 'white', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }} 
              onClick={handlePurge}
            >
              Purge
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <FamilySelector 
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          onSelect={(id) => {
            setSelectedProfileId(id);
            setSelectedFamilyId(null);
          }}
          onRename={(p) => {
            setRenamingProfile(p);
            setNewName(p.name);
          }}
        />

        {!portfolio ? (
          <div className="empty-state">
            <h2>No portfolio data found</h2>
            <p>Upload your CAMS CAS statement to get started.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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
                        <BarChart data={portfolio.folios.map((f: any) => ({ name: f.asset.name, value: f.metrics.currentValue }))}>
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
                            formatter={(val: any) => formatCurrency(Number(val))}
                          />
                          <Bar dataKey="value" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="card">
                    <h3>Key Insights</h3>
                    <div style={{ marginTop: '1rem' }}>
                      {portfolio.folios.length > 0 && (() => {
                        const sorted = [...portfolio.folios].sort((a, b) => {
                          const aVal = performanceMode === 'XIRR' ? (a.metrics.xirr ?? 0) : (a.metrics.absoluteReturn ?? 0);
                          const bVal = performanceMode === 'XIRR' ? (b.metrics.xirr ?? 0) : (b.metrics.absoluteReturn ?? 0);
                          return bVal - aVal;
                        });
                        const top = sorted[0];
                        const value = performanceMode === 'XIRR' ? top.metrics.xirr : top.metrics.absoluteReturn;
                        return (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Your top performing asset is <strong>{top.asset.name}</strong> with {performanceMode === 'XIRR' ? 'an XIRR' : 'a return'} of <span className="positive">{formatPercent(value || 0)}</span>.
                          </p>
                        );
                      })()}
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Top Stock Exposure</p>
                        {exposures[0] && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem' }}>{exposures[0].name}</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatPercent(exposures[0].percentage)}</span>
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
                        <th>Scheme Name</th>
                        <th>Type</th>
                        <th>Invested</th>
                        <th>Current Value</th>
                        <th>{performanceMode === 'XIRR' ? 'XIRR' : 'Return'}</th>
                        <th>Post-Tax {performanceMode === 'XIRR' ? 'XIRR' : 'Return'}</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.folios.map((folio: any) => (
                        <tr key={folio.id}>
                          <td style={{ fontWeight: 500 }}>
                            {folio.asset.name}
                          </td>
                          <td>
                            <span className="badge badge-slab">{folio.asset.type.replace('_', ' ')}</span>
                          </td>
                          <td>{formatCurrency(folio.metrics.investedAmount)}</td>
                          <td>{formatCurrency(folio.metrics.currentValue)}</td>
                          <td className={(performanceMode === 'XIRR' ? folio.metrics.xirr : folio.metrics.absoluteReturn) >= 0 ? 'positive' : 'negative'}>
                            {formatPercent(performanceMode === 'XIRR' ? folio.metrics.xirr : folio.metrics.absoluteReturn)}
                          </td>
                          <td 
                            className={(performanceMode === 'XIRR' ? folio.metrics.postTaxXirr : folio.metrics.postTaxAbsoluteReturn) >= 0 ? 'positive' : 'negative'}
                            style={{ opacity: isRefetching ? 0.5 : 1, transition: 'opacity 0.2s' }}
                          >
                            {formatPercent(performanceMode === 'XIRR' ? (folio.metrics.postTaxXirr ?? 0) : (folio.metrics.postTaxAbsoluteReturn ?? 0))}
                          </td>
                          <td>
                            <button 
                              className="theme-toggle" 
                              title="Simulate Sell Tax" 
                              onClick={() => {
                                setSimFolio(folio);
                                setSimUnits(null);
                              }}
                            >
                              <Calculator size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'xray' && <XRayView data={xrayData} />}
            {activeTab === 'intersection' && <IntersectionView exposures={exposures} />}
            {activeTab === 'tax' && (
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
            )}
            {activeTab === 'insights' && (
              <div className="xray-grid">
                <InsightsSidebar portfolioId={portfolio.id} />
                <GoalTracker portfolioId={portfolio.id} currentValue={portfolio.metrics.totalValue} />
              </div>
            )}
          </>
        )}
      </main>

      {simFolio && (
        <SimulationModal 
          folio={simFolio} 
          initialUnits={simUnits || undefined} 
          onClose={() => {
            setSimFolio(null);
            setSimUnits(null);
          }} 
        />
      )}

      {renamingProfile && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Rename Member</h2>
              <button onClick={() => setRenamingProfile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                DISPLAY NAME
              </label>
              <input 
                type="text" 
                className="card" 
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', outline: 'none' }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border-color)' }} onClick={() => setRenamingProfile(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRename}>
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddAsset && <AddAssetModal onClose={() => setShowAddAsset(false)} onSuccess={fetchSummary} />}

      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Import CAS Statement</h2>
            <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>
              Select your CAMS/Karvy PDF and enter the password (usually your PAN in capitals).
            </p>
            <input 
              type="password" 
              placeholder="PDF Password" 
              className="card" 
              style={{ width: '100%', marginBottom: '1rem', outline: 'none' }} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label className="btn btn-primary" style={{ flex: 1, cursor: 'pointer' }}>
                {uploading ? 'Parsing...' : 'Select File & Upload'}
                <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
              </label>
              <button className="btn" onClick={() => setShowUpload(false)} disabled={uploading} style={{ border: '1px solid var(--border-color)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
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
