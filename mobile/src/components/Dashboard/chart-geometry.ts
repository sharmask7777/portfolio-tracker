/**
 * Geometry and coordinate mapping helpers for SVG Historical Trend charting.
 *
 * @module chart-geometry
 */

import type {
  HistoricalCheckpoint,
} from '../../services/reality-check-service';

/**
 * Coordinate geometry data containing calculated paths and points for chart rendering.
 */
export interface Coordinates {
  valPoints: Array<{ x: number; y: number; cp: HistoricalCheckpoint }>;
  costPoints: Array<{ x: number; y: number }>;
  valPath: string;
  areaPath: string;
  costPath: string;
}

/**
 * Formats currency amount in Indian Rupees.
 *
 * @param val Numeric amount
 * @returns Formatted currency string
 */
export function formatInr(val: number): string {
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

/**
 * Formats a YYYY-MM-DD date string for chart tooltips.
 *
 * @param dateStr ISO date string
 * @returns Formatted short date string
 */
export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Computes SVG coordinate paths and points mapped to width and height.
 *
 * @param items Filtered historical checkpoints
 * @param width Canvas width in pixels
 * @param height Canvas height in pixels
 * @returns Coordinate paths and mapped points
 */
export function computeChartGeometry(
  items: HistoricalCheckpoint[],
  width: number,
  height: number,
): Coordinates {
  const padH = 16;
  const padV = 20;
  const chartW = width - padH * 2;
  const chartH = height - padV * 2;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const it of items) {
    min = Math.min(min, it.value, it.investedAmount);
    max = Math.max(max, it.value, it.investedAmount);
  }

  if (min === max || !Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const range = max - min || 1;

  const stepX = items.length > 1 ? chartW / (items.length - 1) : 0;
  const valPoints: Array<{ x: number; y: number; cp: HistoricalCheckpoint }> = [];
  const costPoints: Array<{ x: number; y: number }> = [];

  items.forEach((cp, idx) => {
    const x = padH + idx * stepX;
    const yVal = padV + chartH - ((cp.value - min) / range) * chartH;
    const yCost = padV + chartH - ((cp.investedAmount - min) / range) * chartH;
    valPoints.push({ x, y: yVal, cp });
    costPoints.push({ x, y: yCost });
  });

  const valPath = valPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const bottomY = padV + chartH;
  const first = valPoints[0];
  const last = valPoints[valPoints.length - 1];
  const areaPath = first && last
    ? `${valPath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`
    : '';

  const costPath = costPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return { valPoints, costPoints, valPath, areaPath, costPath };
}
