import React from 'react';
import type { HistoryPoint } from '../../types/generated/HistoryPoint';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { HistoryChartTooltip } from './HistoryChartTooltip';

interface HistoryChartAreaProps {
  sampledData: HistoryPoint[];
  formatDate: (str: string) => string;
}

export const HistoryChartArea: React.FC<HistoryChartAreaProps> = ({ sampledData, formatDate }) => (
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
      <Tooltip content={<HistoryChartTooltip />} />
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
);
