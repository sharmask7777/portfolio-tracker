import React, { useEffect, useRef, useMemo } from 'react';
import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import type { HistoricalCheckpoint } from '../../services/reality-check-service';
import {
  CHART_PAD_H,
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
  provisionalProbe: React.MutableRefObject<boolean>;
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

/** Minimum zoom window duration (7 days in milliseconds). */
const MIN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Slices range checkpoints based on zoom scale factor and pan offset ratio.
 * Enforces a minimum 7-day window to prevent over-zooming.
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

  const visibleDuration = Math.max(Math.min(duration, MIN_WINDOW_MS), duration / zoomLevel);
  const maxOffset = Math.max(0, duration - visibleDuration);
  const clampedPan = Math.max(0, Math.min(1, panOffset));
  const visibleStart = startMs + maxOffset * clampedPan;
  const visibleEnd = visibleStart + visibleDuration;
  return sliceCheckpointsByTimeRange({ items, startTime: visibleStart, endTime: visibleEnd });
}

function extractTouchLocationX(event: GestureResponderEvent): number {
  const native = event.nativeEvent;
  if (!native) return 0;
  const touches = native.touches;
  if (touches && touches.length > 0 && touches[0]) {
    return touches[0].locationX;
  }
  return native.locationX ?? 0;
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
  const touchX = extractTouchLocationX(event);
  const nearestIdx = findNearestCheckpointIndex({
    touchX,
    points: ctx.geometry.valPoints,
    padH: CHART_PAD_H,
    width: ctx.width,
  });
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
 * Options for pinch and pan movement handler.
 */
export interface PinchAndPanOptions {
  event: GestureResponderEvent;
  refs: GestureRefs;
  callbacks: GestureCallbacks;
  width: number;
  zoom: number;
}

/**
 * Processes two-finger pinch zoom and scaled pan midpoint movement.
 *
 * @param opts Options including event, refs, callbacks, width, and zoom
 */
export function handlePinchAndPanMove(opts: PinchAndPanOptions): void {
  const { event, refs, callbacks, width, zoom } = opts;
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
    const chartW = width > 0 ? width : 300;
    const zoomScale = Math.max(0.1, zoom - 1);
    const deltaRatio = -dx / (chartW * zoomScale);
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

function startCooldown(refs: GestureRefs): void {
  refs.state.current = 'COOLDOWN';
  refs.dist.current = null;
  refs.lastMidX.current = null;
  if (refs.cooldown.current) clearTimeout(refs.cooldown.current);
  refs.cooldown.current = setTimeout(() => {
    refs.state.current = 'IDLE';
    refs.cooldown.current = null;
  }, 150);
}

function handleMultiTouch(
  event: GestureResponderEvent,
  opts: TouchMoveOptions,
): void {
  const { refs, ctx, callbacks, zoom } = opts;
  if (refs.provisionalProbe.current) {
    refs.provisionalProbe.current = false;
    callbacks.setProbedDate(null);
    callbacks.setSelectedIdx(null);
  }
  if (refs.dist.current === null) {
    refs.baseZoom.current = zoom;
  }
  handlePinchAndPanMove({ event, refs, callbacks, width: ctx.width, zoom });
}

/**
 * Handles touch movement: routes to pinch/pan for 2 touches or scrub for 1 touch with cooldown guard.
 */
function handleTouchMove(
  event: GestureResponderEvent,
  opts: TouchMoveOptions,
): void {
  const { refs, ctx, callbacks } = opts;
  const touches = event.nativeEvent ? event.nativeEvent.touches : null;
  const touchCount = touches ? touches.length : 0;
  if (touchCount >= 2) {
    handleMultiTouch(event, opts);
    return;
  }
  if (touchCount === 1) {
    refs.provisionalProbe.current = false;
    if (refs.state.current === 'PINCHING') {
      startCooldown(refs);
      return;
    }
    if (refs.state.current !== 'COOLDOWN') {
      refs.state.current = 'SCRUBBING';
      handleSingleTouch(event, ctx, callbacks);
    }
  }
}

interface PanHandlerOptions {
  refs: GestureRefs;
  ctxRef: React.MutableRefObject<ScrubContext>;
  callbacksRef: React.MutableRefObject<GestureCallbacks>;
  zoomRef: React.MutableRefObject<number>;
}

function createPanHandlers(opts: PanHandlerOptions) {
  const { refs, ctxRef, callbacksRef, zoomRef } = opts;
  return {
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (evt?: GestureResponderEvent) => {
      const touches = evt && evt.nativeEvent ? evt.nativeEvent.touches : null;
      const count = touches ? touches.length : 1;
      if (count <= 1 && refs.state.current !== 'COOLDOWN') {
        refs.state.current = 'SCRUBBING';
        refs.provisionalProbe.current = true;
        if (evt) handleSingleTouch(evt, ctxRef.current, callbacksRef.current);
      }
    },
    onPanResponderMove: (evt?: GestureResponderEvent) => {
      if (evt) handleTouchMove(evt, { refs, ctx: ctxRef.current, callbacks: callbacksRef.current, zoom: zoomRef.current });
    },
    onPanResponderRelease: (evt?: GestureResponderEvent) => {
      refs.provisionalProbe.current = false;
      if (evt && evt.nativeEvent && refs.state.current === 'SCRUBBING') {
        handleSingleTouch(evt, ctxRef.current, callbacksRef.current);
      }
      handleTouchRelease(refs, callbacksRef.current.onGestureActive);
    },
    onPanResponderTerminate: () => {
      refs.provisionalProbe.current = false;
      handleTouchRelease(refs, callbacksRef.current.onGestureActive);
    },
  };
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
    provisionalProbe: useRef<boolean>(false),
  };
  const ctxRef = useRef(ctx);
  const callbacksRef = useRef(callbacks);
  const zoomRef = useRef(zoomLevel);
  ctxRef.current = ctx;
  callbacksRef.current = callbacks;
  zoomRef.current = zoomLevel;

  const onGestureActive = callbacks.onGestureActive;
  useEffect(() => {
    return () => {
      if (refs.cooldown.current) {
        clearTimeout(refs.cooldown.current);
        refs.cooldown.current = null;
      }
      if (refs.state.current !== 'IDLE') {
        refs.state.current = 'IDLE';
        onGestureActive?.(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => PanResponder.create(createPanHandlers({ refs, ctxRef, callbacksRef, zoomRef })), []);
}
