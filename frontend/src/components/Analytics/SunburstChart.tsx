/**
 * @file SunburstChart.tsx
 * @module components/Analytics/SunburstChart
 * @description Accessible, institutional-grade concentric radial sunburst chart.
 *
 * Implements pure trigonometry SVG arc generators, concentric radius scaling,
 * ragged hierarchy outer radius expansion, angular threshold grouping (< 1.5°),
 * dynamic Center Summary Hub, mobile tap-to-lock interaction, and keyboard accessibility.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';
import { formatIndianRupee } from '../../utils/hierarchy-builder';

/**
 * Geometric arc slice data for rendering a sunburst path.
 */
export interface SunburstArc {
  node: HierarchyNode;
  depth: number;
  rIn: number;
  rOut: number;
  startAngle: number;
  endAngle: number;
  pathD: string;
}

/**
 * Props for {@link SunburstChart}.
 */
export interface SunburstChartProps {
  /** Root hierarchy tree node. */
  rootNode: HierarchyNode;
  /** Width of the SVG canvas in pixels. Defaults to 600. */
  width?: number | undefined;
  /** Height of the SVG canvas in pixels. Defaults to 600. */
  height?: number | undefined;
  /** Callback fired when an underlying stock node is selected or clicked. */
  onSelectStock?: ((node: HierarchyNode) => void) | undefined;
  /** Callback fired when a non-stock node is clicked for drilldown. */
  onDrilldown?: ((node: HierarchyNode) => void) | undefined;
  /** Whether dark mode theme colors should be applied. */
  isDarkMode?: boolean | undefined;
}

/** Minimum angular span threshold in radians (1.5 degrees = 1.5 * PI / 180 ≈ 0.02618 rad). */
const MIN_ANGULAR_THRESHOLD_RAD = (1.5 * Math.PI) / 180;

/**
 * Computes the maximum hierarchical tree depth from a given node.
 */
function getMaxDepth(node: HierarchyNode, currentDepth = 0): number {
  if (!node.children || node.children.length === 0) {
    return currentDepth;
  }
  let maxChildDepth = currentDepth;
  for (const child of node.children) {
    const d = getMaxDepth(child, currentDepth + 1);
    if (d > maxChildDepth) {
      maxChildDepth = d;
    }
  }
  return maxChildDepth;
}

/**
 * Generates an SVG path string for an annular arc segment.
 *
 * Angles are measured clockwise from top (12 o'clock, -PI/2):
 * (x, y) = (cx + r * cos(theta), cy + r * sin(theta))
 */
function createArcPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startAngle: number,
  endAngle: number
): string {
  // Clamp angle sweep to avoid wrap-around singularities (360 degrees = 2 * PI - epsilon)
  const sweep = Math.min(endAngle - startAngle, 2 * Math.PI - 1e-6);
  if (sweep <= 0 || rOut <= rIn) {
    return '';
  }

  const effectiveEnd = startAngle + sweep;
  const largeArcFlag = sweep > Math.PI ? 1 : 0;

  // Polar to Cartesian conversion (0 is at top: -PI/2)
  const polarToCartesian = (r: number, angleRad: number) => ({
    x: cx + r * Math.cos(angleRad - Math.PI / 2),
    y: cy + r * Math.sin(angleRad - Math.PI / 2),
  });

  const p1 = polarToCartesian(rOut, startAngle);
  const p2 = polarToCartesian(rOut, effectiveEnd);
  const p3 = polarToCartesian(rIn, effectiveEnd);
  const p4 = polarToCartesian(rIn, startAngle);

  if (rIn <= 0.001) {
    // Pie slice with apex at center
    return [
      `M ${cx} ${cy}`,
      `L ${p1.x} ${p1.y}`,
      `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
      'Z',
    ].join(' ');
  }

  // Annular ring segment
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/**
 * Recursively builds layout arc segments for the sunburst hierarchy.
 */
function buildSunburstArcs(
  node: HierarchyNode,
  startAngle: number,
  endAngle: number,
  depth: number,
  maxDepth: number,
  rMax: number,
  cx: number,
  cy: number
): SunburstArc[] {
  const arcs: SunburstArc[] = [];
  const children = node.children ?? [];
  const validChildren = children.filter(c => c.metrics.layoutValue > 0);

  if (validChildren.length === 0) {
    return arcs;
  }

  // Tiered radii configuration based on R_max:
  // Hub: [0, 0.24 * R_max]
  // Asset Class (depth 1): [0.26 * R_max, 0.48 * R_max]
  // Sector (depth 2): [0.50 * R_max, 0.74 * R_max]
  // Stock (depth 3): [0.76 * R_max, 1.00 * R_max]
  const getRadiiForDepth = (d: number, isLeaf: boolean): { rIn: number; rOut: number } => {
    let rIn: number;
    let rOut: number;

    if (d === 1) {
      rIn = 0.26 * rMax;
      rOut = 0.48 * rMax;
    } else if (d === 2) {
      rIn = 0.50 * rMax;
      rOut = 0.74 * rMax;
    } else {
      rIn = 0.76 * rMax;
      rOut = 1.00 * rMax;
    }

    // Ragged hierarchy handling: if leaf node at depth d < maxDepth, expand rOut to rMax
    if (isLeaf && d < maxDepth) {
      rOut = rMax;
    }

    return { rIn, rOut };
  };

  const totalValue = validChildren.reduce((sum, c) => sum + c.metrics.layoutValue, 0);
  if (totalValue <= 0) {
    return arcs;
  }

  const angularSpan = endAngle - startAngle;

  // Angular threshold coalescing check:
  // Slices with span < MIN_ANGULAR_THRESHOLD_RAD are grouped into an Other (<0.4%) segment.
  const standardChildren: HierarchyNode[] = [];
  const microChildren: HierarchyNode[] = [];

  for (const child of validChildren) {
    const childSpan = (child.metrics.layoutValue / totalValue) * angularSpan;
    if (childSpan < MIN_ANGULAR_THRESHOLD_RAD) {
      microChildren.push(child);
    } else {
      standardChildren.push(child);
    }
  }

  // Effective children list with synthesized micro cluster if needed
  const effectiveChildren: HierarchyNode[] = [...standardChildren];
  if (microChildren.length > 0) {
    const microSum = microChildren.reduce((sum, c) => sum + c.metrics.layoutValue, 0);
    const firstMicro = microChildren[0];
    const parentDepth = firstMicro?.depth ?? 'stock';

    effectiveChildren.push({
      id: `${node.id}-micro-other`,
      name: 'Other (<0.4%)',
      depth: parentDepth,
      metrics: {
        signedValue: microSum,
        layoutValue: microSum,
        weightOfPortfolio: node.metrics.weightOfPortfolio * (microSum / totalValue),
        weightOfAssetClass: node.metrics.weightOfAssetClass * (microSum / totalValue),
        weightOfParent: microSum / totalValue,
      },
      color: '#64748b',
      textColor: '#ffffff',
      isSynthetic: true,
      isTail: true,
    });
  }

  let currentStartAngle = startAngle;

  for (const child of effectiveChildren) {
    const childFraction = child.metrics.layoutValue / totalValue;
    const childAngleSpan = childFraction * angularSpan;
    const childEndAngle = currentStartAngle + childAngleSpan;

    const childHasKids = Boolean(child.children && child.children.length > 0);
    const isLeaf = !childHasKids;
    const childDepth = depth + 1;
    const { rIn, rOut } = getRadiiForDepth(childDepth, isLeaf);

    const pathD = createArcPath(cx, cy, rIn, rOut, currentStartAngle, childEndAngle);

    arcs.push({
      node: child,
      depth: childDepth,
      rIn,
      rOut,
      startAngle: currentStartAngle,
      endAngle: childEndAngle,
      pathD,
    });

    if (childHasKids) {
      const descendantArcs = buildSunburstArcs(
        child,
        currentStartAngle,
        childEndAngle,
        childDepth,
        maxDepth,
        rMax,
        cx,
        cy
      );
      arcs.push(...descendantArcs);
    }

    currentStartAngle = childEndAngle;
  }

  return arcs;
}

/**
 * Concentric radial Sunburst chart with interactive Center Summary Hub.
 */
export const SunburstChart: React.FC<SunburstChartProps> = ({
  rootNode,
  width = 600,
  height = 600,
  onSelectStock,
  onDrilldown,
}) => {
  // Mobile tap-to-lock state
  const [lockedNode, setLockedNode] = useState<HierarchyNode | null>(null);
  // Hovered active node
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode | null>(null);
  // Keyboard focus active index
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const cx = width / 2;
  const cy = height / 2;
  const rMax = Math.max(10, Math.min(width, height) / 2 - 16);

  // Maximum hierarchy depth across the tree
  const maxDepth = useMemo(() => getMaxDepth(rootNode), [rootNode]);

  // Compute all radial arcs
  const sunburstArcs = useMemo(() => {
    return buildSunburstArcs(rootNode, 0, 2 * Math.PI, 0, maxDepth, rMax, cx, cy);
  }, [rootNode, maxDepth, rMax, cx, cy]);

  // Currently displayed node in the Center Summary Hub (hovered takes precedence, or locked, or root)
  const activeHubNode = hoveredNode ?? lockedNode ?? rootNode;

  // Handle arc segment click (mobile tap-to-lock or drilldown)
  const handleArcClick = useCallback(
    (node: HierarchyNode) => {
      if (lockedNode?.id === node.id) {
        // Second tap on the locked node triggers action
        if (node.depth === 'stock' || node.contributions) {
          if (onSelectStock) {
            onSelectStock(node);
          }
        } else if (onDrilldown) {
          onDrilldown(node);
        }
      } else {
        // First tap locks center hub
        setLockedNode(node);
      }
    },
    [lockedNode, onSelectStock, onDrilldown]
  );

  // Unlock and reset center hub
  const handleBackdropClick = useCallback(() => {
    setLockedNode(null);
    setHoveredNode(null);
  }, []);

  // Keyboard navigation across concentric arcs
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number, node: HierarchyNode) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIdx = (index + 1) % sunburstArcs.length;
        setFocusedIndex(nextIdx);
        const nextElem = document.getElementById(`sunburst-arc-${nextIdx}`);
        nextElem?.focus();
        if (!lockedNode) {
          const nextArc = sunburstArcs[nextIdx];
          if (nextArc) setHoveredNode(nextArc.node);
        }
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIdx = (index - 1 + sunburstArcs.length) % sunburstArcs.length;
        setFocusedIndex(prevIdx);
        const prevElem = document.getElementById(`sunburst-arc-${prevIdx}`);
        prevElem?.focus();
        if (!lockedNode) {
          const prevArc = sunburstArcs[prevIdx];
          if (prevArc) setHoveredNode(prevArc.node);
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleArcClick(node);
      }
    },
    [sunburstArcs, lockedNode, handleArcClick]
  );

  // Formatting center hub metrics
  const hubRupee = formatIndianRupee(activeHubNode.metrics.signedValue);
  const hubPortfolioPct = (activeHubNode.metrics.weightOfPortfolio * 100).toFixed(1);
  const hubParentPct = (activeHubNode.metrics.weightOfParent * 100).toFixed(1);
  const isRoot = activeHubNode.id === rootNode.id;

  return (
    <div className="relative flex flex-col items-center justify-center w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden select-none p-4">
      {/* SVG Radial Canvas */}
      <svg
        role="region"
        aria-label="Portfolio Sunburst"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Background Click Target to Unlock */}
        <rect
          data-testid="sunburst-backdrop"
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={handleBackdropClick}
        />

        {/* Concentric Arc Paths */}
        {sunburstArcs.map((arc, index) => {
          const { node } = arc;
          const isSelected = lockedNode?.id === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const weightPct = (node.metrics.weightOfPortfolio * 100).toFixed(1);
          const rupeeStr = formatIndianRupee(node.metrics.signedValue);

          return (
            <path
              key={`${node.id}-${index}`}
              id={`sunburst-arc-${index}`}
              d={arc.pathD}
              fill={node.color}
              stroke="var(--card-bg, #ffffff)"
              strokeWidth="1.5"
              role="button"
              tabIndex={index === focusedIndex ? 0 : -1}
              aria-label={`${node.name}, ${rupeeStr}, ${weightPct}%`}
              data-id={node.id}
              data-name={node.name}
              data-depth={node.depth}
              data-start-angle={arc.startAngle}
              data-end-angle={arc.endAngle}
              data-r-out={arc.rOut}
              opacity={isSelected || isHovered ? 1 : 0.88}
              className="cursor-pointer transition-all duration-150 outline-none hover:opacity-100"
              style={{ outline: 'none' }}
              onMouseEnter={() => {
                if (!lockedNode) {
                  setHoveredNode(node);
                }
              }}
              onMouseLeave={() => {
                if (!lockedNode) {
                  setHoveredNode(null);
                }
              }}
              onClick={e => {
                e.stopPropagation();
                handleArcClick(node);
              }}
              onKeyDown={e => handleKeyDown(e, index, node)}
            />
          );
        })}
      </svg>

      {/* Prominent Center Summary Hub Card */}
      <div
        data-testid="center-summary-hub"
        className="absolute pointer-events-none flex flex-col items-center justify-center text-center p-3 rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-xs"
        style={{
          width: Math.max(90, 0.46 * rMax * 2),
          height: Math.max(90, 0.46 * rMax * 2),
        }}
      >
        <span
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-[85%] truncate uppercase tracking-wider"
          title={activeHubNode.name}
        >
          {activeHubNode.name}
        </span>
        <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white my-0.5 tracking-tight">
          {hubRupee}
        </span>
        {isRoot ? (
          <span className="text-[11px] font-medium text-slate-400">Total Net Worth</span>
        ) : (
          <div className="flex flex-col items-center text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <span>{hubPortfolioPct}% of Portfolio</span>
            <span className="text-slate-400">{hubParentPct}% of Parent</span>
          </div>
        )}
      </div>
    </div>
  );
};
