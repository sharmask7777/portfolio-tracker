/**
 * @file MultiLevelTreemap.tsx
 * @module components/Analytics/MultiLevelTreemap
 * @description Accessible, interactive, multi-level squarified treemap visualization.
 *
 * Implements the Bruls-Huizing-van Wijk squarified layout algorithm (aspect ratios <= 4:1)
 * with 4-tier tile rendering rules, hatched SVG styling for hedged arbitrage positions,
 * breadcrumb navigation, roving tabindex keyboard controls, and screen reader announcements.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';
import { formatIndianRupee } from '../../utils/hierarchy-builder';

/**
 * Geometric rectangle partition for treemap tiles.
 */
export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: HierarchyNode;
}

/**
 * Props for {@link MultiLevelTreemap}.
 */
export interface MultiLevelTreemapProps {
  /** Root hierarchy tree node. */
  rootNode: HierarchyNode;
  /** Width of the SVG canvas in pixels. */
  width?: number | undefined;
  /** Height of the SVG canvas in pixels. */
  height?: number | undefined;
  /** Callback fired when an underlying stock node is clicked or selected. */
  onSelectStock?: ((node: HierarchyNode) => void) | undefined;
}

/**
 * Pure squarified layout algorithm (Bruls-Huizing-van Wijk).
 * Recursively partitions a bounding rectangle into aspect-ratio-optimized tiles.
 */
function squarify(
  children: HierarchyNode[],
  row: HierarchyNode[],
  rect: { x: number; y: number; width: number; height: number },
  totalValue: number
): TreemapRect[] {
  if (children.length === 0 && row.length === 0) {
    return [];
  }

  const results: TreemapRect[] = [];
  const minSide = Math.min(rect.width, rect.height);

  if (minSide <= 0 || totalValue <= 0) {
    return [];
  }

  // Helper to compute worst aspect ratio of row if placed along minSide
  const worstAspectRatio = (candidateRow: HierarchyNode[], length: number): number => {
    if (candidateRow.length === 0 || length <= 0) return Infinity;
    const rowSum = candidateRow.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
    if (rowSum <= 0) return Infinity;

    const rowArea = (rowSum / totalValue) * (rect.width * rect.height);
    const rowThickness = rowArea / length;
    if (rowThickness <= 0) return Infinity;

    let maxAspect = 0;
    for (const node of candidateRow) {
      const nodeVal = Math.max(0, node.metrics.layoutValue);
      const nodeArea = (nodeVal / totalValue) * (rect.width * rect.height);
      const nodeLength = nodeArea / rowThickness;
      if (nodeLength <= 0) continue;
      const aspect = Math.max(nodeLength / rowThickness, rowThickness / nodeLength);
      if (aspect > maxAspect) {
        maxAspect = aspect;
      }
    }
    return maxAspect;
  };

  // Layout a finalized row along the shorter dimension of rect
  const layoutRow = (
    finalRow: HierarchyNode[],
    currentRect: { x: number; y: number; width: number; height: number }
  ): { rects: TreemapRect[]; remainingRect: { x: number; y: number; width: number; height: number } } => {
    const rowSum = finalRow.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
    const rowArea = (rowSum / totalValue) * (rect.width * rect.height);
    const isHorizontal = currentRect.width >= currentRect.height;
    const side = isHorizontal ? currentRect.height : currentRect.width;
    const thickness = side > 0 ? rowArea / side : 0;

    const rowRects: TreemapRect[] = [];
    let offset = 0;

    for (const node of finalRow) {
      const nodeVal = Math.max(0, node.metrics.layoutValue);
      const nodeArea = (nodeVal / totalValue) * (rect.width * rect.height);
      const itemLength = thickness > 0 ? nodeArea / thickness : 0;

      if (isHorizontal) {
        rowRects.push({
          x: currentRect.x,
          y: currentRect.y + offset,
          width: thickness,
          height: itemLength,
          node,
        });
        offset += itemLength;
      } else {
        rowRects.push({
          x: currentRect.x + offset,
          y: currentRect.y,
          width: itemLength,
          height: thickness,
          node,
        });
        offset += itemLength;
      }
    }

    const remainingRect = isHorizontal
      ? {
          x: currentRect.x + thickness,
          y: currentRect.y,
          width: Math.max(0, currentRect.width - thickness),
          height: currentRect.height,
        }
      : {
          x: currentRect.x,
          y: currentRect.y + thickness,
          width: currentRect.width,
          height: Math.max(0, currentRect.height - thickness),
        };

    return { rects: rowRects, remainingRect };
  };

  const remainingChildren = [...children];
  let currentRow = [...row];
  let currentBoundingRect = { ...rect };

  while (remainingChildren.length > 0) {
    const nextChild = remainingChildren[0];
    if (!nextChild) break;

    const candidateRow = [...currentRow, nextChild];
    const currentMinSide = Math.min(currentBoundingRect.width, currentBoundingRect.height);

    if (
      currentRow.length === 0 ||
      worstAspectRatio(candidateRow, currentMinSide) <= worstAspectRatio(currentRow, currentMinSide)
    ) {
      // Adding candidate improves or maintains aspect ratio
      currentRow.push(nextChild);
      remainingChildren.shift();
    } else {
      // Row is full; layout currentRow and reset
      const { rects, remainingRect } = layoutRow(currentRow, currentBoundingRect);
      results.push(...rects);
      currentBoundingRect = remainingRect;
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    const { rects } = layoutRow(currentRow, currentBoundingRect);
    results.push(...rects);
  }

  return results;
}

/**
 * Computes squarified tile rectangles for a node's immediate children.
 */
function computeTreemapLayout(
  activeNode: HierarchyNode,
  containerWidth: number,
  containerHeight: number
): TreemapRect[] {
  const children = activeNode.children ?? [];
  const validChildren = children.filter(c => c.metrics.layoutValue > 0);

  if (validChildren.length === 0) {
    // Single leaf representation filling the canvas
    return [
      {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight,
        node: activeNode,
      },
    ];
  }

  // Sort descending by value for squarify stability
  const sortedChildren = [...validChildren].sort(
    (a, b) => b.metrics.layoutValue - a.metrics.layoutValue
  );

  const totalChildValue = sortedChildren.reduce((sum, c) => sum + c.metrics.layoutValue, 0);

  return squarify(
    sortedChildren,
    [],
    { x: 0, y: 0, width: containerWidth, height: containerHeight },
    totalChildValue
  );
}

/**
 * Renders an accessible squarified multi-level Treemap component.
 */
export const MultiLevelTreemap: React.FC<MultiLevelTreemapProps> = ({
  rootNode,
  width = 800,
  height = 500,
  onSelectStock,
}) => {
  // Navigation stack for drilldown path
  const [navPath, setNavPath] = useState<HierarchyNode[]>([rootNode]);
  // Roving tabindex active tile index
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  // Screen reader polite announcement message
  const [announcement, setAnnouncement] = useState<string>('Displaying All Assets');

  const activeNode = navPath[navPath.length - 1] ?? rootNode;

  // Memoized layout geometry calculation
  const layoutRects = useMemo(() => {
    return computeTreemapLayout(activeNode, width, height);
  }, [activeNode, width, height]);

  // Handle drilldown navigation into a child node
  const handleDrillDown = useCallback(
    (childNode: HierarchyNode) => {
      const hasChildren = childNode.children && childNode.children.length > 0;
      if (hasChildren) {
        setNavPath(prev => [...prev, childNode]);
        setFocusedIndex(0);
        setAnnouncement(`Drilled into ${childNode.name}, ${childNode.children?.length ?? 0} items`);
      } else if (childNode.depth === 'stock' || childNode.contributions) {
        if (onSelectStock) {
          onSelectStock(childNode);
        }
      }
    },
    [onSelectStock]
  );

  // Navigate up one level
  const handleZoomOut = useCallback(() => {
    if (navPath.length > 1) {
      setNavPath(prev => {
        const next = prev.slice(0, prev.length - 1);
        const current = next[next.length - 1] ?? rootNode;
        const displayName = next.length === 1 ? 'All Assets' : current.name;
        setAnnouncement(`Navigated up to ${displayName}`);
        return next;
      });
      setFocusedIndex(0);
    }
  }, [navPath.length, rootNode]);

  // Navigate directly to a specific breadcrumb level
  const handleBreadcrumbClick = useCallback((targetIndex: number) => {
    setNavPath(prev => {
      const next = prev.slice(0, targetIndex + 1);
      const current = next[next.length - 1];
      if (current) {
        const displayName = next.length === 1 ? 'All Assets' : current.name;
        setAnnouncement(`Navigated to ${displayName}`);
      }
      return next;
    });
    setFocusedIndex(0);
  }, []);

  // Keyboard navigation across tiles (roving tabindex)
  const handleTileKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number, rect: TreemapRect) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIdx = (index + 1) % layoutRects.length;
        setFocusedIndex(nextIdx);
        const nextElem = document.getElementById(`treemap-tile-${nextIdx}`);
        nextElem?.focus();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIdx = (index - 1 + layoutRects.length) % layoutRects.length;
        setFocusedIndex(prevIdx);
        const prevElem = document.getElementById(`treemap-tile-${prevIdx}`);
        prevElem?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleDrillDown(rect.node);
      }
    },
    [layoutRects.length, handleDrillDown]
  );

  // Global escape key listener to zoom out
  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.key === 'Escape' || event.key === 'Backspace') && navPath.length > 1) {
        // Prevent default only if not in an input/textarea
        const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          handleZoomOut();
        }
      }
    },
    [navPath.length, handleZoomOut]
  );

  React.useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  const canZoomOut = navPath.length > 1;

  return (
    <div className="flex flex-col w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Screen Reader Live Announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Breadcrumb Navigation & Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
        <nav aria-label="Hierarchy Breadcrumbs" className="flex items-center flex-wrap gap-1 text-sm">
          {navPath.map((item, idx) => {
            const isLast = idx === navPath.length - 1;
            const displayName = idx === 0 ? 'All Assets' : item.name;

            return (
              <React.Fragment key={item.id}>
                {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                {isLast ? (
                  <span className="font-semibold text-slate-900 dark:text-white" aria-current="page">
                    {displayName}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(idx)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                  >
                    {displayName}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {canZoomOut && (
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Zoom Out</span>
          </button>
        )}
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden" style={{ height }}>
        <svg
          role="region"
          aria-label="Portfolio Treemap"
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="select-none"
        >
          <defs>
            {/* Striped hatched pattern for hedged arbitrage positions */}
            <pattern
              id="hedged-stripes"
              patternUnits="userSpaceOnUse"
              width="10"
              height="10"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="10"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="3"
              />
            </pattern>

            {/* Individual clip paths for tiles to prevent text overflow */}
            {layoutRects.map((rect, idx) => (
              <clipPath key={`clip-${rect.node.id}-${idx}`} id={`clip-${rect.node.id}-${idx}`}>
                <rect x={rect.x + 2} y={rect.y + 2} width={Math.max(0, rect.width - 4)} height={Math.max(0, rect.height - 4)} />
              </clipPath>
            ))}
          </defs>

          {/* Render Tiles */}
          {layoutRects.map((rect, index) => {
            const { node } = rect;
            const tileWidth = rect.width;
            const tileHeight = rect.height;

            // 4-Tier tile dimension rules:
            // Tier 1 (>= 80x52px): Name + Rupee Value + Percentage
            // Tier 2 (>= 50x32px): Name + Percentage
            // Tier 3 (< 50x32px): Color block only (NO text nodes rendered)
            const isTier1 = tileWidth >= 80 && tileHeight >= 52;
            const isTier2 = !isTier1 && tileWidth >= 50 && tileHeight >= 32;

            const isInteractive = (node.children && node.children.length > 0) || node.depth === 'stock';
            const weightPct = (node.metrics.weightOfParent * 100).toFixed(1);
            const rupeeStr = formatIndianRupee(node.metrics.signedValue);

            return (
              <g
                key={`${node.id}-${index}`}
                id={`treemap-tile-${index}`}
                role="button"
                tabIndex={index === focusedIndex ? 0 : -1}
                aria-label={`${node.name}, ${rupeeStr}, ${weightPct}%`}
                onClick={() => handleDrillDown(node)}
                onKeyDown={e => handleTileKeyDown(e, index, rect)}
                className={`cursor-pointer transition-opacity duration-200 outline-none focus:ring-2 focus:ring-offset-2 ${
                  isInteractive ? 'hover:opacity-90' : ''
                }`}
                style={{ outline: 'none' }}
              >
                {/* Tile Base Rectangle */}
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill={node.color}
                  stroke="var(--card-bg, #ffffff)"
                  strokeWidth="2"
                  rx="3"
                />

                {/* Hedged Arbitrage Hatching Overlay */}
                {node.isHedged && (
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill="url(#hedged-stripes)"
                    stroke="var(--card-bg, #ffffff)"
                    strokeWidth="2"
                    rx="3"
                  />
                )}

                {/* Text Content based on 4-Tier Rules */}
                {(isTier1 || isTier2) && (
                  <g clipPath={`url(#clip-${node.id}-${index})`}>
                    <text
                      x={rect.x + 6}
                      y={rect.y + 16}
                      fill={node.textColor}
                      fontSize="12"
                      fontWeight="bold"
                      className="pointer-events-none"
                    >
                      {node.name}
                    </text>

                    {isTier1 && (
                      <text
                        x={rect.x + 6}
                        y={rect.y + 32}
                        fill={node.textColor}
                        fontSize="11"
                        opacity="0.9"
                        className="pointer-events-none"
                      >
                        {rupeeStr}
                      </text>
                    )}

                    <text
                      x={rect.x + 6}
                      y={isTier1 ? rect.y + 46 : rect.y + 28}
                      fill={node.textColor}
                      fontSize="10"
                      opacity="0.8"
                      className="pointer-events-none"
                    >
                      {weightPct}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
