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
 * Bounds and scaling parameters for chart rendering.
 */
interface ChartBounds {
  min: number;
  range: number;
  padH: number;
  padV: number;
  chartW: number;
  chartH: number;
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
 * Computes value range bounds and chart dimensions.
 *
 * @param items Historical checkpoints
 * @param width Canvas width in pixels
 * @param height Canvas height in pixels
 * @returns Computed chart boundary parameters
 */
function computeBounds(
  items: HistoricalCheckpoint[],
  width: number,
  height: number,
): ChartBounds {
  const padH = 16;
  const padV = 20;
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

  return {
    min,
    range: max - min || 1,
    padH,
    padV,
    chartW: width - padH * 2,
    chartH: height - padV * 2,
  };
}

/**
 * Resolves coordinate X for a checkpoint.
 *
 * @param idx Index of the checkpoint
 * @param total Total number of checkpoints
 * @param bounds Chart boundary parameters
 * @returns Horizontal X coordinate
 */
function resolvePointX(idx: number, total: number, bounds: ChartBounds): number {
  if (total <= 1) return bounds.padH + bounds.chartW / 2;
  const stepX = bounds.chartW / (total - 1);
  return bounds.padH + idx * stepX;
}

/**
 * Maps checkpoints into rendered SVG point coordinates.
 *
 * @param items Filtered historical checkpoints
 * @param bounds Chart boundary parameters
 * @returns Value points and cost points
 */
function mapChartPoints(
  items: HistoricalCheckpoint[],
  bounds: ChartBounds,
): {
  valPoints: Array<{ x: number; y: number; cp: HistoricalCheckpoint }>;
  costPoints: Array<{ x: number; y: number }>;
} {
  const valPoints: Array<{ x: number; y: number; cp: HistoricalCheckpoint }> = [];
  const costPoints: Array<{ x: number; y: number }> = [];

  items.forEach((cp, idx) => {
    const x = resolvePointX(idx, items.length, bounds);
    const yVal = bounds.padV + bounds.chartH - ((cp.value - bounds.min) / bounds.range) * bounds.chartH;
    const yCost = bounds.padV + bounds.chartH - ((cp.investedAmount - bounds.min) / bounds.range) * bounds.chartH;
    valPoints.push({ x, y: yVal, cp });
    costPoints.push({ x, y: yCost });
  });

  return { valPoints, costPoints };
}

/**
 * Builds SVG path string from point array.
 *
 * @param points Array of 2D coordinates
 * @returns SVG path data string
 */
function buildPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
}

/**
 * Computes SVG coordinate paths and points mapped to width and height.
 *
 * @param items Filtered historical checkpoints
 * @param width Canvas width in pixels
 * @param height Canvas height in pixels
 * @param visibleRange Optional visible timestamp range [start, end]
 * @returns Coordinate paths and mapped points
 */
// eslint-disable-next-line max-params
export function computeChartGeometry(
  items: HistoricalCheckpoint[],
  width: number,
  height: number,
  visibleRange?: [number, number],
): Coordinates {
  void visibleRange;
  const bounds = computeBounds(items, width, height);
  const { valPoints, costPoints } = mapChartPoints(items, bounds);

  const valPath = buildPath(valPoints);
  const costPath = buildPath(costPoints);

  const bottomY = bounds.padV + bounds.chartH;
  const first = valPoints[0];
  const last = valPoints[valPoints.length - 1];
  const areaPath = first && last
    ? `${valPath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`
    : '';

  return { valPoints, costPoints, valPath, areaPath, costPath };
}

/**
 * Snaps a touch coordinate X to the nearest checkpoint index via binary search.
 *
 * @param touchX Raw X position of the touch gesture
 * @param points Rendered chart points with X positions
 * @param padH Horizontal padding in pixels
 * @param width Total chart width in pixels
 * @returns Index of the closest point in the array
 */
// eslint-disable-next-line max-params
export function findNearestCheckpointIndex(
  touchX: number,
  points: Array<{ x: number }>,
  padH: number,
  width: number,
): number {
  if (points.length <= 1) return 0;
  const clampedX = Math.max(padH, Math.min(touchX, width - padH));

  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const currX = points[mid]?.x ?? 0;
    if (currX < clampedX) {
      low = mid + 1;
    } else if (currX > clampedX) {
      high = mid - 1;
    } else {
      return mid;
    }
  }

  if (low >= points.length) return points.length - 1;
  if (high < 0) return 0;

  const pLow = points[low]!;
  const pHigh = points[high]!;
  return Math.abs(pLow.x - clampedX) < Math.abs(pHigh.x - clampedX) ? low : high;
}

/**
 * Slices checkpoints by time window without losing boundaries, then downsamples.
 *
 * @param items Array of historical checkpoints
 * @param startTime Start timestamp in milliseconds
 * @param endTime End timestamp in milliseconds
 * @param maxPoints Maximum target points (defaults to 300)
 * @returns Filtered and sampled checkpoints
 */
// eslint-disable-next-line max-params
export function sliceCheckpointsByTimeRange(
  items: HistoricalCheckpoint[],
  startTime: number,
  endTime: number,
  maxPoints: number = 300,
): HistoricalCheckpoint[] {
  const inRange = items.filter((cp) => {
    const t = new Date(cp.date).getTime();
    return t >= startTime && t <= endTime;
  });

  if (inRange.length === 0) return items.slice(-1);
  if (inRange.length <= maxPoints) return inRange;

  const interval = Math.ceil(inRange.length / maxPoints);
  return inRange.filter((_, idx) => idx % interval === 0 || idx === inRange.length - 1);
}
