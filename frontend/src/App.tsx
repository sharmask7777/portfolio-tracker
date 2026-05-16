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
  Plus
} from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:3001/api/portfolio';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState('');

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/summary`);
      setPortfolio(res.data);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

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
    } catch (err) {
      alert('Upload failed. Please check your password or file format.');
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
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            <Plus size={18} /> Import CAS
          </button>
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      <main className="main-content">
        {!portfolio ? (
          <div className="empty-state">
            <h2>No portfolio data found</h2>
            <p>Upload your CAMS CAS statement to get started.</p>
            <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ marginTop: '1rem' }}>
              <UploadIcon size={18} /> Upload Now
            </button>
          </div>
        ) : (
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
                <h3>Asset Allocation</h3>
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
                <h3>Key Indicators</h3>
                <div style={{ marginTop: '1rem' }}>
                  {/* Summary list or other widgets */}
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Your top performing asset is {portfolio.folios[0]?.asset.name} with an XIRR of {formatPercent(portfolio.folios[0]?.metrics.xirr)}.
                  </p>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Scheme Name</th>
                    <th>Invested</th>
                    <th>Current Value</th>
                    <th>Gain/Loss</th>
                    <th>XIRR</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.folios.map((folio: any) => (
                    <tr key={folio.id}>
                      <td style={{ fontWeight: 500 }}>{folio.asset.name}</td>
                      <td>{formatCurrency(folio.metrics.investedAmount)}</td>
                      <td>{formatCurrency(folio.metrics.currentValue)}</td>
                      <td className={folio.metrics.totalGain >= 0 ? 'positive' : 'negative'}>
                        {formatCurrency(folio.metrics.totalGain)}
                      </td>
                      <td className={folio.metrics.xirr >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(folio.metrics.xirr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

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
              style={{ width: '100%', marginBottom: '1rem' }} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label className="btn btn-primary" style={{ flex: 1, cursor: 'pointer' }}>
                {uploading ? 'Parsing...' : 'Select File & Upload'}
                <input type="file" hidden onChange={handleFileUpload} disabled={uploading} />
              </label>
              <button className="btn" onClick={() => setShowUpload(false)} disabled={uploading}>
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
