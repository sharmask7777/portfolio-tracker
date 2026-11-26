import React, { useRef, useMemo } from 'react';
import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import type { HistoricalCheckpoint } from '../../services/reality-check-service';
import {
  findNearestCheckpointIndex,
  sliceCheckpointsByTimeRange,
  type Coordinates,
} from './chart-geometry';

/**
 * Context parameters required for single-touch scrub snapping.
 */
export interface ScrubContext {
  geometry: Coordinates;
  filtered: HistoricalCheckpoint[];
  width: number;
}

/**
 * State callbacks invoked during gestures.
 */
export interface GestureCallbacks {
  setProbedDate: (d: string | null) => void;
  setSelectedIdx: (i: number | null) => void;
  setScrubX: (x: number | null) => void;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<number>>;
  onGestureActive?: ((active: boolean) => void) | undefined;
}

/**
 * Persistent gesture state references across renders.
 */
export interface GestureRefs {
  state: React.MutableRefObject<'IDLE' | 'SCRUBBING' | 'PINCHING' | 'COOLDOWN'>;
  dist: React.MutableRefObject<number | null>;
  baseZoom: React.MutableRefObject<number>;
  lastMidX: React.MutableRefObject<number | null>;
  cooldown: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

/**
 * Downsamples dense history points so SVG chart performance remains smooth.
 *
 * @param data Array of checkpoints
 * @param maxPoints Maximum target points
 * @returns Sampled checkpoints
 */
export function sampleCheckpoints(
  data: HistoricalCheckpoint[],
  maxPoints: number = 300,
): HistoricalCheckpoint[] {
  if (data.length <= maxPoints) return data;
  const interval = Math.ceil(data.length / maxPoints);
  return data.filter((_, idx) => idx % interval === 0 || idx === data.length - 1);
}

/**
 * Slices range checkpoints based on zoom scale factor and pan offset ratio.
 *
 * @param items Filtered range checkpoints
 * @param zoomLevel Current zoom scale factor >= 1
 * @param panOffset Pan offset ratio (0.0 = oldest, 1.0 = newest)
 * @returns Sliced or downsampled checkpoints
 */
export function sliceForZoomAndPan(
  items: HistoricalCheckpoint[],
  zoomLevel: number,
  panOffset: number,
): HistoricalCheckpoint[] {
  if (zoomLevel <= 1 || items.length < 2) return sampleCheckpoints(items);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return sampleCheckpoints(items);

  const startMs = new Date(first.date).getTime();
  const endMs = new Date(last.date).getTime();
  const duration = endMs - startMs;
  if (duration <= 0) return sampleCheckpoints(items);

  const visibleDuration = duration / zoomLevel;
  const maxOffset = duration - visibleDuration;
  const clampedPan = Math.max(0, Math.min(1, panOffset));
  const visibleStart = startMs + maxOffset * clampedPan;
  const visibleEnd = visibleStart + visibleDuration;
  return sliceCheckpointsByTimeRange(items, visibleStart, visibleEnd);
}

/**
 * Snaps touch coordinate to nearest checkpoint and updates probe state.
 *
 * @param event Native touch event
 * @param ctx Scrub geometry and data context
 * @param callbacks State updater callbacks
 */
export function handleSingleTouch(
  event: GestureResponderEvent,
  ctx: ScrubContext,
  callbacks: GestureCallbacks,
): void {
  const touches = event.nativeEvent.touches;
  const touchX = touches[0]?.locationX ?? event.nativeEvent.locationX;
  const nearestIdx = findNearestCheckpointIndex(touchX, ctx.geometry.valPoints, 16, ctx.width);
  const targetCp = ctx.filtered[nearestIdx];
  if (targetCp) {
    callbacks.setProbedDate(targetCp.date);
    callbacks.setSelectedIdx(nearestIdx);
  }
  const snappedX = ctx.geometry.valPoints[nearestIdx]?.x ?? touchX;
  callbacks.setScrubX(snappedX);
  callbacks.onGestureActive?.(true);
}

/**
 * Computes Euclidean distance between two active touch points for pinch gestures.
 *
 * @param event Native touch event
 * @returns Distance in points
 */
export function computeTouchDistance(event: GestureResponderEvent): number {
  const touches = event.nativeEvent.touches;
  const t0 = touches[0];
  const t1 = touches[1];
  if (!t0 || !t1) return 0;
  return Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
}

/**
 * Computes the midpoint X coordinate between two active touches.
 *
 * @param event Native touch event
 * @returns Midpoint X in page coordinates
 */
export function computeTouchMidpointX(event: GestureResponderEvent): number {
  const touches = event.nativeEvent.touches;
  const t0 = touches[0];
  const t1 = touches[1];
  if (!t0 || !t1) return 0;
  return (t0.pageX + t1.pageX) / 2;
}

/**
 * Processes two-finger pinch zoom and pan midpoint movement.
 *
 * @param event Native touch event
 * @param refs Gesture tracking references
 * @param callbacks State updater callbacks
 */
export function handlePinchAndPanMove(
  event: GestureResponderEvent,
  refs: GestureRefs,
  callbacks: GestureCallbacks,
): void {
  if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
  refs.state.current = 'PINCHING';

  const dist = computeTouchDistance(event);
  if (refs.dist.current === null) {
    refs.dist.current = dist;
  } else if (refs.dist.current > 0 && dist > 0) {
    const scale = dist / refs.dist.current;
    callbacks.setZoomLevel(Math.max(1, Math.min(5, refs.baseZoom.current * scale)));
  }

  const midX = computeTouchMidpointX(event);
  if (refs.lastMidX.current !== null) {
    const dx = midX - refs.lastMidX.current;
    const deltaRatio = -dx / 300;
    callbacks.setPanOffset((prev) => Math.max(0, Math.min(1, prev + deltaRatio)));
  }
  refs.lastMidX.current = midX;
  callbacks.setScrubX(null);
  callbacks.onGestureActive?.(true);
}

/**
 * Handles release or termination of active chart gestures.
 *
 * @param refs Gesture tracking references
 * @param onGestureActive Optional scroll lock notification callback
 */
export function handleTouchRelease(
  refs: GestureRefs,
  onGestureActive?: ((a: boolean) => void) | undefined,
): void {
  onGestureActive?.(false);
  refs.dist.current = null;
  refs.lastMidX.current = null;
  if (refs.state.current === 'PINCHING') {
    refs.state.current = 'COOLDOWN';
    if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
    refs.cooldown.current = setTimeout(() => {
      refs.state.current = 'IDLE';
      refs.cooldown.current = null;
    }, 150);
  } else if (refs.state.current !== 'COOLDOWN') {
    refs.state.current = 'IDLE';
  }
}

interface TouchMoveOptions {
  refs: GestureRefs;
  ctx: ScrubContext;
  callbacks: GestureCallbacks;
  zoom: number;
}

/**
 * Handles touch movement: routes to pinch/pan for 2 touches or scrub for 1 touch with cooldown guard.
 */
function handleTouchMove(
  event: GestureResponderEvent,
  opts: TouchMoveOptions,
): void {
  const { refs, ctx, callbacks, zoom } = opts;
  const touchCount = event.nativeEvent.touches.length;
  if (touchCount >= 2) {
    if (refs.dist.current === null) {
      refs.baseZoom.current = zoom;
    }
    handlePinchAndPanMove(event, refs, callbacks);
    return;
  }
  if (touchCount === 1) {
    if (refs.state.current === 'PINCHING') {
      refs.state.current = 'COOLDOWN';
      refs.dist.current = null;
      refs.lastMidX.current = null;
      if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
      refs.cooldown.current = setTimeout(() => {
        refs.state.current = 'IDLE';
        refs.cooldown.current = null;
      }, 150);
      return;
    }
    if (refs.state.current !== 'COOLDOWN') {
      refs.state.current = 'SCRUBBING';
      handleSingleTouch(event, ctx, callbacks);
    }
  }
}

/**
 * Creates a stable PanResponder instance managing scrub, pinch zoom, pan offset, and cooldown debounce.
 *
 * @param ctx Scrub geometry context
 * @param callbacks State callbacks
 * @param zoomLevel Current zoom level
 * @returns PanResponder instance
 */
export function useChartPanResponder(
  ctx: ScrubContext,
  callbacks: GestureCallbacks,
  zoomLevel: number,
): PanResponderInstance {
  const refs: GestureRefs = {
    state: useRef<'IDLE' | 'SCRUBBING' | 'PINCHING' | 'COOLDOWN'>('IDLE'),
    dist: useRef<number | null>(null),
    baseZoom: useRef<number>(1),
    lastMidX: useRef<number | null>(null),
    cooldown: useRef<ReturnType<typeof setTimeout> | null>(null),
  };
  const ctxRef = useRef(ctx);
  const callbacksRef = useRef(callbacks);
  const zoomRef = useRef(zoomLevel);
  ctxRef.current = ctx;
  callbacksRef.current = callbacks;
  zoomRef.current = zoomLevel;

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length <= 1 && refs.state.current !== 'COOLDOWN') {
            refs.state.current = 'SCRUBBING';
            handleSingleTouch(evt, ctxRef.current, callbacksRef.current);
          }
        },
        onPanResponderMove: (evt) => {
          handleTouchMove(evt, { refs, ctx: ctxRef.current, callbacks: callbacksRef.current, zoom: zoomRef.current });
        },
        onPanResponderRelease: () => handleTouchRelease(refs, callbacksRef.current.onGestureActive),
        onPanResponderTerminate: () => handleTouchRelease(refs, callbacksRef.current.onGestureActive),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
