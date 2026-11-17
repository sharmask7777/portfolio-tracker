/**
 * @file SunburstChart.tsx
 * @module components/Analytics/SunburstChart
 * @description Concentric radial Sunburst chart with interactive Center Summary Hub.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';
import { formatIndianRupee } from '../../utils/hierarchy-builder';

export interface SunburstChartProps {
  rootNode: HierarchyNode;
  width?: number;
  height?: number;
  onSelectStock?: (node: HierarchyNode) => void;
  onDrilldown?: (node: HierarchyNode) => void;
}

export interface SunburstArc {
  node: HierarchyNode;
  depth: number;
  rIn: number;
  rOut: number;
  startAngle: number;
  endAngle: number;
  pathD: string;
}

export interface ArcDimensions {
  cx: number;
  cy: number;
  rIn: number;
  rOut: number;
  startAngle: number;
  endAngle: number;
}

const MIN_ANGULAR_THRESHOLD_RAD = (0.4 / 100) * 2 * Math.PI;

export function getMaxDepth(node: HierarchyNode): number {
  if (!node.children || node.children.length === 0) {
    return 0;
  }
  let maxChildDepth = 0;
  for (const child of node.children) {
    const d = 1 + getMaxDepth(child);
    if (d > maxChildDepth) {
      maxChildDepth = d;
    }
  }
  return maxChildDepth;
}

export function createArcPath(dims: ArcDimensions): string {
  const { cx, cy, rIn, rOut, startAngle, endAngle } = dims;
  const sweep = Math.min(endAngle - startAngle, 2 * Math.PI - 1e-6);
  if (sweep <= 0 || rOut <= rIn) {
    return '';
  }

  const effectiveEnd = startAngle + sweep;
  const largeArcFlag = sweep > Math.PI ? 1 : 0;

  const polarToCartesian = (r: number, angleRad: number) => ({
    x: cx + r * Math.cos(angleRad - Math.PI / 2),
    y: cy + r * Math.sin(angleRad - Math.PI / 2),
  });

  const p1 = polarToCartesian(rOut, startAngle);
  const p2 = polarToCartesian(rOut, effectiveEnd);
  const p3 = polarToCartesian(rIn, effectiveEnd);
  const p4 = polarToCartesian(rIn, startAngle);

  if (rIn <= 0.001) {
    return [
      `M ${cx} ${cy}`,
      `L ${p1.x} ${p1.y}`,
      `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

export interface SunburstGeometryContext {
  maxDepth: number;
  rMax: number;
  cx: number;
  cy: number;
}

export interface RadialSegmentProps {
  startAngle: number;
  endAngle: number;
  depth: number;
}

function getRadiiForDepth(
  d: number,
  isLeaf: boolean,
  geom: SunburstGeometryContext
): { rIn: number; rOut: number } {
  let rIn: number;
  let rOut: number;

  if (d === 1) {
    rIn = 0.26 * geom.rMax;
    rOut = 0.48 * geom.rMax;
  } else if (d === 2) {
    rIn = 0.50 * geom.rMax;
    rOut = 0.74 * geom.rMax;
  } else {
    rIn = 0.76 * geom.rMax;
    rOut = 1.00 * geom.rMax;
  }

  if (isLeaf && d < geom.maxDepth) {
    rOut = geom.rMax;
  }

  return { rIn, rOut };
}

function partitionChildren(children: HierarchyNode[], angularSpan: number, totalValue: number) {
  const standard: HierarchyNode[] = [];
  const micro: HierarchyNode[] = [];

  for (const child of children) {
    const span = (child.metrics.layoutValue / totalValue) * angularSpan;
    if (span < MIN_ANGULAR_THRESHOLD_RAD) {
      micro.push(child);
    } else {
      standard.push(child);
    }
  }

  return { standard, micro };
}

function synthesizeMicroNode(
  micro: HierarchyNode[],
  parent: HierarchyNode,
  totalValue: number
): HierarchyNode | null {
  if (micro.length === 0) return null;
  const microSum = micro.reduce((sum, c) => sum + c.metrics.layoutValue, 0);
  const firstMicro = micro[0];
  const parentDepth = firstMicro?.depth ?? 'stock';

  return {
    id: `${parent.id}-micro-other`,
    name: 'Other (<0.4%)',
    depth: parentDepth,
    metrics: {
      signedValue: microSum,
      layoutValue: microSum,
      weightOfPortfolio: parent.metrics.weightOfPortfolio * (microSum / totalValue),
      weightOfAssetClass: parent.metrics.weightOfAssetClass * (microSum / totalValue),
      weightOfParent: microSum / totalValue,
    },
    color: '#64748b',
    textColor: '#ffffff',
    isSynthetic: true,
    isTail: true,
  };
}

export function buildSunburstArcs(
  node: HierarchyNode,
  segment: RadialSegmentProps,
  geom: SunburstGeometryContext
): SunburstArc[] {
  const arcs: SunburstArc[] = [];
  const validChildren = (node.children ?? []).filter(c => c.metrics.layoutValue > 0);
  const totalValue = validChildren.reduce((sum, c) => sum + c.metrics.layoutValue, 0);

  if (validChildren.length === 0 || totalValue <= 0) {
    return arcs;
  }

  const { startAngle, endAngle, depth } = segment;
  const angularSpan = endAngle - startAngle;
  const { standard, micro } = partitionChildren(validChildren, angularSpan, totalValue);
  const effectiveChildren: HierarchyNode[] = [...standard];
  const microNode = synthesizeMicroNode(micro, node, totalValue);
  if (microNode) effectiveChildren.push(microNode);

  let currentStartAngle = startAngle;

  for (const child of effectiveChildren) {
    const childFraction = child.metrics.layoutValue / totalValue;
    const childAngleSpan = childFraction * angularSpan;
    const childEndAngle = currentStartAngle + childAngleSpan;

    const childHasKids = Boolean(child.children && child.children.length > 0);
    const childDepth = depth + 1;
    const { rIn, rOut } = getRadiiForDepth(childDepth, !childHasKids, geom);

    const pathD = createArcPath({
      cx: geom.cx,
      cy: geom.cy,
      rIn,
      rOut,
      startAngle: currentStartAngle,
      endAngle: childEndAngle,
    });

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
      const descendants = buildSunburstArcs(
        child,
        { startAngle: currentStartAngle, endAngle: childEndAngle, depth: childDepth },
        geom
      );
      arcs.push(...descendants);
    }

    currentStartAngle = childEndAngle;
  }

  return arcs;
}

interface CenterSummaryHubProps {
  activeHubNode: HierarchyNode;
  rootNodeId: string;
  rMax: number;
}

const CenterSummaryHub: React.FC<CenterSummaryHubProps> = ({ activeHubNode, rootNodeId, rMax }) => {
  const hubRupee = formatIndianRupee(activeHubNode.metrics.signedValue);
  const hubPortfolioPct = (activeHubNode.metrics.weightOfPortfolio * 100).toFixed(1);
  const hubParentPct = (activeHubNode.metrics.weightOfParent * 100).toFixed(1);
  const isRoot = activeHubNode.id === rootNodeId;

  return (
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
  );
};

export const SunburstChart: React.FC<SunburstChartProps> = ({
  rootNode,
  width = 600,
  height = 600,
  onSelectStock,
  onDrilldown,
}) => {
  const [lockedNode, setLockedNode] = useState<HierarchyNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const cx = width / 2;
  const cy = height / 2;
  const rMax = Math.max(10, Math.min(width, height) / 2 - 16);
  const maxDepth = useMemo(() => getMaxDepth(rootNode), [rootNode]);

  const sunburstArcs = useMemo(() => {
    return buildSunburstArcs(
      rootNode,
      { startAngle: 0, endAngle: 2 * Math.PI, depth: 0 },
      { maxDepth, rMax, cx, cy }
    );
  }, [rootNode, maxDepth, rMax, cx, cy]);

  const activeHubNode = hoveredNode ?? lockedNode ?? rootNode;

  const handleArcClick = useCallback(
    (node: HierarchyNode) => {
      if (lockedNode?.id === node.id) {
        if (node.depth === 'stock' || node.contributions) {
          onSelectStock?.(node);
        } else {
          onDrilldown?.(node);
        }
      } else {
        setLockedNode(node);
      }
    },
    [lockedNode, onSelectStock, onDrilldown]
  );

  const handleBackdropClick = useCallback(() => {
    setLockedNode(null);
    setHoveredNode(null);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number, node: HierarchyNode) => {
      const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const isPrev = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      if (isNext || isPrev) {
        event.preventDefault();
        const nextIdx = isNext
          ? (index + 1) % sunburstArcs.length
          : (index - 1 + sunburstArcs.length) % sunburstArcs.length;
        setFocusedIndex(nextIdx);
        document.getElementById(`sunburst-arc-${nextIdx}`)?.focus();
        if (!lockedNode) {
          const arc = sunburstArcs[nextIdx];
          if (arc) setHoveredNode(arc.node);
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleArcClick(node);
      }
    },
    [sunburstArcs, lockedNode, handleArcClick]
  );

  return (
    <div className="relative flex flex-col items-center justify-center w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden select-none p-4">
      <svg
        role="region"
        aria-label="Portfolio Sunburst"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <rect
          data-testid="sunburst-backdrop"
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={handleBackdropClick}
        />
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
              onMouseEnter={() => { if (!lockedNode) setHoveredNode(node); }}
              onMouseLeave={() => { if (!lockedNode) setHoveredNode(null); }}
              onClick={e => { e.stopPropagation(); handleArcClick(node); }}
              onKeyDown={e => handleKeyDown(e, index, node)}
            />
          );
        })}
      </svg>
      <CenterSummaryHub activeHubNode={activeHubNode} rootNodeId={rootNode.id} rMax={rMax} />
    </div>
  );
};
