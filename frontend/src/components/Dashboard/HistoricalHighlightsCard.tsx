import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';
import { API_ENDPOINTS, API_CONFIG } from '../../config';

interface StatPoint {
  value: number;
  date: string;
}

interface YearlyStat {
  year: number;
  ath: number;
  maxInvested: number;
}

interface HistoricalStats {
  ath: StatPoint;
  maxInvested: StatPoint;
  yearly: YearlyStat[];
}

interface HistoricalHighlightsCardProps {
  portfolioId: string;
}

export const HistoricalHighlightsCard: React.FC<HistoricalHighlightsCardProps> = ({ portfolioId }) => {
  const [stats, setStats] = useState<HistoricalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!portfolioId) {
        setStats(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/stats`, {
          params: { userId: API_CONFIG.MOCK_USER_ID }
        });
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch historical stats:', err);
        setError('Failed to load historical highlights.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [portfolioId]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (str: string) => {
    return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading highlights...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <p style={{ color: error ? 'var(--danger-color)' : 'var(--text-secondary)' }}>
          {error || 'No historical highlights available.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Historical Highlights</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <Trophy size={18} style={{ color: '#FFD700' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>All-Time High Corpus</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {formatCurrency(stats.ath.value)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calendar size={12} />
            {formatDate(stats.ath.date)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            <TrendingUp size={18} style={{ color: 'var(--accent-color)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Maximum Invested</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {formatCurrency(stats.maxInvested.value)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calendar size={12} />
            {formatDate(stats.maxInvested.date)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Yearly Breakdown</p>
        <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.5rem 0', fontWeight: '500' }}>Year</th>
                <th style={{ padding: '0.5rem 0', fontWeight: '500' }}>Peak Value</th>
                <th style={{ padding: '0.5rem 0', fontWeight: '500' }}>Max Invested</th>
              </tr>
            </thead>
            <tbody>
              {stats.yearly.map((y) => (
                <tr key={y.year} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                  <td style={{ padding: '0.5rem 0', fontWeight: '600' }}>{y.year}</td>
                  <td style={{ padding: '0.5rem 0' }}>{formatCurrency(y.ath)}</td>
                  <td style={{ padding: '0.5rem 0' }}>{formatCurrency(y.maxInvested)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
