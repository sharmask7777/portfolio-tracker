import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  BrainCircuit
} from 'lucide-react';
import { XRayView } from './components/Analytics/XRayView';
import { IntersectionView } from './components/Analytics/IntersectionView';
import { TaxView } from './components/Tax/TaxView';
import { SimulationModal } from './components/Tax/SimulationModal';
import { FamilyManager } from './components/Family/FamilyManager';
import { AddAssetModal } from './components/Dashboard/AddAssetModal';
import { InsightsSidebar } from './components/Insights/InsightsSidebar';
import { GoalTracker } from './components/Insights/GoalTracker';
import { useSettings } from './contexts/SettingsContext';
import './App.css';

const API_BASE = 'http://localhost:3001/api/portfolio';
const API_TAX = 'http://localhost:3001/api/tax';

function App() {
  const { theme, toggleTheme } = useSettings();
  const [activeTab, setActiveTab] = useState<'overview' | 'xray' | 'intersection' | 'tax' | 'insights'>('overview');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [xrayData, setXRayData] = useState<any>(null);
  const [exposures, setExposures] = useState<any[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>(null);
  const [harvesting, setHarvesting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [simFolio, setSimFolio] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState('');

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params = selectedFamilyId ? { familyGroupId: selectedFamilyId } : {};
      const res = await axios.get(`${API_BASE}/summary`, { params });
      setPortfolio(res.data);
      
      if (res.data.id) {
        const [xrayRes, exposuresRes, taxRes, harvestingRes] = await Promise.all([
          axios.get(`${API_BASE}/${res.data.id}/xray`),
          axios.get(`${API_BASE}/${res.data.id}/exposures`),
          axios.get(`${API_BASE}/${res.data.id}/tax-summary`),
          axios.get(`${API_TAX}/harvesting-opportunities`),
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
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedFamilyId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    try {
      setUploading(true);
      await axios.post(`${API_BASE}/upload`, formData);
      setShowUpload(false);
      setPassword('');
      fetchSummary();
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

  if (loading) {
    return <div className="loading-state">Loading your portfolio...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <LayoutDashboard size={24} />
          <span>Portfolio Tracker</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn" style={{ border: '1px solid var(--border-color)' }} onClick={() => setShowAddAsset(true)}>
            <Plus size={18} /> Add Other Asset
          </button>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            <Plus size={18} /> Import CAS
          </button>
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="btn" style={{ marginLeft: '0.5rem' }} onClick={() => setPortfolio(null)}>
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        <FamilyManager 
          onSelect={(id) => setSelectedFamilyId(id)} 
          selectedId={selectedFamilyId} 
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
                <div className="stats-grid">
                  <div className="card">
                    <div className="stat-label">Net Worth</div>
                    <div className="stat-value">{formatCurrency(portfolio.metrics.totalValue)}</div>
                    <div className={`stat-change ${portfolio.metrics.totalGain >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(portfolio.metrics.totalGain)} ({formatPercent(portfolio.metrics.absoluteReturn)})
                    </div>
                  </div>
                  <div className="card">
                    <div className="stat-label">Invested Amount</div>
                    <div className="stat-value">{formatCurrency(portfolio.metrics.totalInvested)}</div>
                  </div>
                  <div className="card">
                    <div className="stat-label">Overall XIRR</div>
                    <div className={`stat-value ${portfolio.metrics.xirr >= 0 ? 'positive' : 'negative'}`}>
                      {formatPercent(portfolio.metrics.xirr)}
                    </div>
                  </div>
                  <div className="card">
                    <div className="stat-label">Total Assets</div>
                    <div className="stat-value">{portfolio.folios.length} Schemes</div>
                  </div>
                </div>

                <div className="dashboard-sections">
                  <div className="card">
                    <h3>Scheme Breakdown</h3>
                    <div className="chart-container" style={{ marginTop: '1rem' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={portfolio.folios.map((f: any) => ({ name: f.asset.name, value: f.metrics.currentValue }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                          <XAxis dataKey="name" hide />
                          <YAxis hide />
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
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Your top performing asset is <strong>{portfolio.folios[0]?.asset.name}</strong> with an XIRR of <span className="positive">{formatPercent(portfolio.folios[0]?.metrics.xirr)}</span>.
                      </p>
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
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Scheme Name</th>
                        <th>Type</th>
                        <th>Invested</th>
                        <th>Current Value</th>
                        <th>XIRR</th>
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
                          <td className={folio.metrics.xirr >= 0 ? 'positive' : 'negative'}>
                            {formatPercent(folio.metrics.xirr)}
                          </td>
                          <td>
                            <button className="theme-toggle" title="Simulate Sell Tax" onClick={() => setSimFolio(folio)}>
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
            {activeTab === 'tax' && <TaxView summary={taxSummary} harvesting={harvesting} />}
            {activeTab === 'insights' && (
              <div className="xray-grid">
                <InsightsSidebar portfolioId={portfolio.id} />
                <GoalTracker portfolioId={portfolio.id} currentValue={portfolio.metrics.totalValue} />
              </div>
            )}
          </>
        )}
      </main>

      {simFolio && <SimulationModal folio={simFolio} onClose={() => setSimFolio(null)} />}

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
              style={{ width: '100%', marginBottom: '1rem', background: 'var(--bg-secondary)', outline: 'none' }} 
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

export default App;
