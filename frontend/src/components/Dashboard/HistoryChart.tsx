import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import type { HistoryPoint } from '../../types/generated/HistoryPoint';
import { HistoryChartArea } from './HistoryChartArea';

interface HistoryChartProps {
  portfolioId: string;
}

type RangePreset = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';

const RANGES: RangePreset[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];

function filterByRange(historyData: HistoryPoint[], selectedRange: RangePreset): HistoryPoint[] {
  if (!historyData.length) return [];
  const now = new Date();
  let startDate = new Date();

  switch (selectedRange) {
    case '1M': startDate.setMonth(now.getMonth() - 1); break;
    case '3M': startDate.setMonth(now.getMonth() - 3); break;
    case '6M': startDate.setMonth(now.getMonth() - 6); break;
    case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
    case '3Y': startDate.setFullYear(now.getFullYear() - 3); break;
    case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
    case 'ALL': startDate = new Date(0); break;
  }

  return historyData.filter(d => new Date(d.date) >= startDate);
}

function sampleData(data: HistoryPoint[]): HistoryPoint[] {
  const MAX_POINTS = 300;
  if (data.length <= MAX_POINTS) return data;
  const samplingInterval = Math.ceil(data.length / MAX_POINTS);
  return data.filter((_, index) => index % samplingInterval === 0 || index === data.length - 1);
}

const formatDate = (str: string) => {
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
};

export const HistoryChart: React.FC<HistoryChartProps> = ({ portfolioId }) => {
  const [selectedRange, setSelectedRange] = useState<RangePreset>('3M');
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!portfolioId) {
        setHistoryData([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/history`);
        setHistoryData(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setError('Failed to load history data. Please try again later.');
        setHistoryData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [portfolioId]);

  const filteredData = filterByRange(historyData, selectedRange);
  const sampledData = sampleData(filteredData);

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Portfolio History</h3>
        <div className="segmented-control">
          {RANGES.map((range) => (
            <button
              key={range}
              className={selectedRange === range ? 'active' : ''}
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container" style={{ height: '350px' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading history...</p>
          </div>
        ) : error ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--danger-color)' }}>{error}</p>
          </div>
        ) : sampledData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>No History Data</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>Upload your portfolio to see growth over time.</p>
          </div>
        ) : (
          <HistoryChartArea sampledData={sampledData} formatDate={formatDate} />
        )}
      </div>
    </div>
  );
};
