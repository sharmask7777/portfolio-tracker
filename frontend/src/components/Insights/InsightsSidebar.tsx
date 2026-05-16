import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lightbulb, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface Insight {
  type: 'CONCENTRATION' | 'OVERLAP' | 'DRIFT' | 'INFO';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  recommendation: string;
}

interface InsightsSidebarProps {
  portfolioId: string;
}

export const InsightsSidebar: React.FC<InsightsSidebarProps> = ({ portfolioId }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:3001/api/health/${portfolioId}/insights`);
        setInsights(res.data);
      } catch (e) {
        console.error('Failed to fetch insights', e);
      } finally {
        setLoading(false);
      }
    };

    if (portfolioId) fetchInsights();
  }, [portfolioId]);

  if (loading) return <div>Analyzing portfolio...</div>;

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'HIGH': return <AlertTriangle className="negative" size={20} />;
      case 'MEDIUM': return <Info style={{ color: '#f59e0b' }} size={20} />;
      default: return <CheckCircle className="positive" size={20} />;
    }
  };

  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Lightbulb size={20} className="accent" /> Smart Insights
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {insights.map((insight, idx) => (
          <div key={idx} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              {getIcon(insight.severity)}
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{insight.message}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {insight.recommendation}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
