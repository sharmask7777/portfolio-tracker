import { describe, it, expect } from 'vitest';
import {
  findNearestCheckpointIndex,
  sliceCheckpointsByTimeRange,
  computeChartGeometry,
  formatInr,
  formatDate,
} from '../src/components/Dashboard/chart-geometry';
import type { HistoricalCheckpoint } from '../src/services/reality-check-service';

describe('chart-geometry interactive extensions', () => {
  const mockCheckpoints: HistoricalCheckpoint[] = [
    {
      date: '2026-01-01',
      value: 100000,
      investedAmount: 80000,
      unrealizedGain: 20000,
      gainPct: 25,
      isAth: true,
      athValue: 100000,
      drawdownPct: 0,
    },
    {
      date: '2026-01-15',
      value: 105000,
      investedAmount: 80000,
      unrealizedGain: 25000,
      gainPct: 31.25,
      isAth: true,
      athValue: 105000,
      drawdownPct: 0,
    },
    {
      date: '2026-02-01',
      value: 95000,
      investedAmount: 80000,
      unrealizedGain: 15000,
      gainPct: 18.75,
      isAth: false,
      athValue: 105000,
      drawdownPct: 9.52,
    },
  ];

  describe('formatInr and formatDate', () => {
    it('formats currency in Indian Rupees', () => {
      expect(formatInr(100000)).toBe('₹1,00,000');
    });

    it('formats ISO dates correctly', () => {
      expect(formatDate('2026-01-15')).toContain('Jan');
    });

    it('handles invalid date strings gracefully', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date');
    });
  });

  describe('findNearestCheckpointIndex', () => {
    it('snaps touchX to the nearest checkpoint index via binary search', () => {
      const points = [{ x: 16 }, { x: 165 }, { x: 314 }];
      expect(findNearestCheckpointIndex({ touchX: 10, points, padH: 16, width: 330 })).toBe(0);
      expect(findNearestCheckpointIndex({ touchX: 160, points, padH: 16, width: 330 })).toBe(1);
      expect(findNearestCheckpointIndex({ touchX: 165, points, padH: 16, width: 330 })).toBe(1);
      expect(findNearestCheckpointIndex({ touchX: 300, points, padH: 16, width: 330 })).toBe(2);
    });

    it('handles single-point or empty point arrays', () => {
      expect(findNearestCheckpointIndex({ touchX: 100, points: [], padH: 16, width: 330 })).toBe(0);
      expect(findNearestCheckpointIndex({ touchX: 100, points: [{ x: 50 }], padH: 16, width: 330 })).toBe(0);
    });

    it('clamps touchX within padH and width - padH boundaries', () => {
      const points = [{ x: 16 }, { x: 100 }, { x: 314 }];
      expect(findNearestCheckpointIndex({ touchX: 0, points, padH: 16, width: 330 })).toBe(0);
      expect(findNearestCheckpointIndex({ touchX: 400, points, padH: 16, width: 330 })).toBe(2);
    });
  });

  describe('sliceCheckpointsByTimeRange', () => {
    it('slices checkpoints dynamically by time window without losing boundaries', () => {
      const startTime = new Date('2026-01-10').getTime();
      const endTime = new Date('2026-02-05').getTime();
      const sliced = sliceCheckpointsByTimeRange({ items: mockCheckpoints, startTime, endTime });
      expect(sliced.length).toBe(2);
      expect(sliced[0]?.date).toBe('2026-01-15');
      expect(sliced[1]?.date).toBe('2026-02-01');
    });

    it('includes bracketing neighbors when fewer than 2 checkpoints fall in window to prevent collapse', () => {
      // Narrow window that only contains 2026-01-15 (length 1)
      const startTime = new Date('2026-01-14').getTime();
      const endTime = new Date('2026-01-16').getTime();
      const sliced = sliceCheckpointsByTimeRange({ items: mockCheckpoints, startTime, endTime });
      expect(sliced.length).toBeGreaterThanOrEqual(2);
      expect(sliced.some((cp) => cp.date === '2026-01-15')).toBe(true);
    });

    it('returns bracketing boundaries when no checkpoints fall in range', () => {
      const startTime = new Date('2025-01-01').getTime();
      const endTime = new Date('2025-01-05').getTime();
      const sliced = sliceCheckpointsByTimeRange({ items: mockCheckpoints, startTime, endTime });
      expect(sliced.length).toBe(2);
      expect(sliced[0]?.date).toBe('2026-01-01');
    });

    it('downsamples dense checkpoints exceeding maxPoints while preserving last item', () => {
      const manyCheckpoints: HistoricalCheckpoint[] = Array.from({ length: 50 }, (_, i) => ({
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        value: 100000 + i * 100,
        investedAmount: 80000,
        unrealizedGain: 20000 + i * 100,
        gainPct: 25,
        isAth: true,
        athValue: 100000 + i * 100,
        drawdownPct: 0,
      }));

      const startTime = new Date('2026-01-01').getTime();
      const endTime = new Date('2026-02-28').getTime();
      const sliced = sliceCheckpointsByTimeRange({ items: manyCheckpoints, startTime, endTime, maxPoints: 10 });
      expect(sliced.length).toBeLessThanOrEqual(11);
      expect(sliced[sliced.length - 1]?.value).toBe(manyCheckpoints[manyCheckpoints.length - 1]?.value);
    });
  });

  describe('computeChartGeometry', () => {
    it('handles single-point checkpoints safely without division by zero', () => {
      const single = [mockCheckpoints[0]!];
      const geom = computeChartGeometry(single, 330, 200);
      expect(geom.valPoints.length).toBe(1);
      expect(Number.isFinite(geom.valPoints[0]?.x)).toBe(true);
      expect(Number.isFinite(geom.valPoints[0]?.y)).toBe(true);
    });

    it('handles flat values without division by zero', () => {
      const flat = [
        { ...mockCheckpoints[0]!, value: 100000, investedAmount: 100000 },
        { ...mockCheckpoints[1]!, value: 100000, investedAmount: 100000 },
      ];
      const geom = computeChartGeometry(flat, 330, 200);
      expect(geom.valPoints.length).toBe(2);
      expect(Number.isFinite(geom.valPoints[0]?.y)).toBe(true);
    });

    it('computes geometry correctly mapped to width and height', () => {
      const geom = computeChartGeometry(mockCheckpoints, 330, 200);
      expect(geom.valPoints.length).toBe(3);
      expect(geom.valPoints[0]?.x).toBe(16);
      expect(geom.valPoints[2]?.x).toBe(314);
      expect(geom.valPath).toContain('M 16');
      expect(geom.areaPath).toContain('Z');
      expect(geom.costPath).toContain('M 16');
    });

    it('handles empty checkpoints array safely', () => {
      const geom = computeChartGeometry([], 330, 200);
      expect(geom.valPoints.length).toBe(0);
      expect(geom.costPoints.length).toBe(0);
      expect(geom.valPath).toBe('');
      expect(geom.areaPath).toBe('');
      expect(geom.costPath).toBe('');
    });
  });
});
