import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { API_ENDPOINTS, API_CONFIG } from '../../config';

interface HistoryPoint {
  date: string;
  value: number;
  investedAmount: number;
}

interface HistoryChartProps {
  portfolioId: string;
}

type RangePreset = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';

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
        const response = await axios.get(`${API_ENDPOINTS.PORTFOLIO}/${portfolioId}/history`, {
          params: { userId: API_CONFIG.MOCK_USER_ID }
        });
        
        // Ensure we always have an array
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

  const ranges: RangePreset[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];

  const getFilteredData = () => {
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
  };

  const getSampledData = (data: HistoryPoint[]) => {
    if (selectedRange === 'ALL' || selectedRange === '5Y' || selectedRange === '3Y') {
      // Sample every 7th day for ranges longer than 3 years
      return data.filter((_, index) => index % 7 === 0 || index === data.length - 1);
    }
    if (selectedRange === '1Y' || selectedRange === '6M') {
      // Sample every 2nd day for 6M - 1Y
      return data.filter((_, index) => index % 2 === 0 || index === data.length - 1);
    }
    return data;
  };

  const filteredData = getFilteredData();
  const sampledData = getSampledData(filteredData);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (str: string) => {
    return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const gain = data.value - data.investedAmount;
      const gainPercent = data.investedAmount > 0 ? (gain / data.investedAmount) * 100 : 0;
      const isPositive = gain >= 0;

      return (
        <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', minWidth: '200px' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{formatDate(label)}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Value:</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(data.value)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Invested:</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(data.investedAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gain:</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPositive ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {formatCurrency(gain)} ({gainPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Portfolio History</h3>
        <div className="segmented-control">
          {ranges.map((range) => (
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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sampledData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--text-secondary)" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="var(--text-secondary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate} 
                minTickGap={30}
                stroke="var(--text-secondary)"
                fontSize={12}
              />
              <YAxis 
                hide 
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                name="Current Value"
                stroke="var(--accent-color)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                isAnimationActive={false}
              />
              <Area 
                type="monotone" 
                dataKey="investedAmount" 
                name="Invested Amount"
                stroke="var(--text-secondary)" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1} 
                fill="url(#colorInvested)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
