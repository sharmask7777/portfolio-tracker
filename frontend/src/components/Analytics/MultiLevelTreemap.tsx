/**
 * @file MultiLevelTreemap.tsx
 * @module components/Analytics/MultiLevelTreemap
 * @description Accessible squarified multi-level Treemap component with zoomable drilldown.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';
import { TreemapHeader } from './TreemapHeader';
import { TreemapSvgCanvas } from './TreemapSvgCanvas';

export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: HierarchyNode;
}

export interface MultiLevelTreemapProps {
  rootNode: HierarchyNode;
  width?: number | undefined;
  height?: number | undefined;
  onSelectStock?: ((node: HierarchyNode) => void) | undefined;
}

export function computeTreemapLayout(
  root: HierarchyNode,
  width: number,
  height: number
): TreemapRect[] {
  const children = root.children ?? [];
  const validChildren = children.filter(c => c.metrics.layoutValue > 0);

  if (validChildren.length === 0) {
    if (root.metrics.layoutValue > 0) {
      return [{ x: 0, y: 0, width, height, node: root }];
    }
    return [];
  }

  const sortedChildren = [...validChildren].sort(
    (a, b) => b.metrics.layoutValue - a.metrics.layoutValue
  );

  const totalValue = sortedChildren.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
  if (totalValue <= 0) return [];

  return squarify(sortedChildren, [], { x: 0, y: 0, width, height }, totalValue);
}

function computeWorstAspect(candidateRow: HierarchyNode[], length: number, totalValue: number, rectArea: number): number {
  if (candidateRow.length === 0 || length <= 0) return Infinity;
  const rowSum = candidateRow.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
  if (rowSum <= 0) return Infinity;

  const rowArea = (rowSum / totalValue) * rectArea;
  const rowThickness = rowArea / length;
  if (rowThickness <= 0) return Infinity;

  let maxAspect = 0;
  for (const node of candidateRow) {
    const nodeVal = Math.max(0, node.metrics.layoutValue);
    const nodeArea = (nodeVal / totalValue) * rectArea;
    const nodeLength = nodeArea / rowThickness;
    if (nodeLength <= 0) continue;
    const aspect = Math.max(nodeLength / rowThickness, rowThickness / nodeLength);
    if (aspect > maxAspect) {
      maxAspect = aspect;
    }
  }
  return maxAspect;
}

function layoutFinalRow(
  finalRow: HierarchyNode[],
  currentRect: { x: number; y: number; width: number; height: number },
  totalValue: number
): { rects: TreemapRect[]; remainingRect: { x: number; y: number; width: number; height: number } } {
  const rowSum = finalRow.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
  const rowArea = (rowSum / totalValue) * (currentRect.width * currentRect.height);
  const isHorizontal = currentRect.width >= currentRect.height;
  const side = isHorizontal ? currentRect.height : currentRect.width;
  const thickness = side > 0 ? rowArea / side : 0;

  const rowRects: TreemapRect[] = [];
  let offset = 0;

  for (const node of finalRow) {
    const nodeVal = Math.max(0, node.metrics.layoutValue);
    const nodeArea = (nodeVal / totalValue) * (currentRect.width * currentRect.height);
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
}

function squarify(
  children: HierarchyNode[],
  row: HierarchyNode[],
  rect: { x: number; y: number; width: number; height: number },
  totalValue: number
): TreemapRect[] {
  if (children.length === 0 && row.length === 0) {
    return [];
  }

  const minSide = Math.min(rect.width, rect.height);
  if (minSide <= 0 || totalValue <= 0) {
    return [];
  }

  const results: TreemapRect[] = [];
  const remainingChildren = [...children];
  let currentRow = [...row];
  let currentBoundingRect = { ...rect };

  while (remainingChildren.length > 0) {
    const nextChild = remainingChildren[0];
    if (!nextChild) break;

    const candidateRow = [...currentRow, nextChild];
    const currentMinSide = Math.min(currentBoundingRect.width, currentBoundingRect.height);
    const rectArea = currentBoundingRect.width * currentBoundingRect.height;

    const currentWorst = computeWorstAspect(currentRow, currentMinSide, totalValue, rectArea);
    const candidateWorst = computeWorstAspect(candidateRow, currentMinSide, totalValue, rectArea);

    if (currentRow.length === 0 || candidateWorst <= currentWorst) {
      currentRow.push(nextChild);
      remainingChildren.shift();
    } else {
      const { rects, remainingRect } = layoutFinalRow(currentRow, currentBoundingRect, totalValue);
      results.push(...rects);
      currentBoundingRect = remainingRect;
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    const { rects } = layoutFinalRow(currentRow, currentBoundingRect, totalValue);
    results.push(...rects);
  }

  return results;
}

export const MultiLevelTreemap: React.FC<MultiLevelTreemapProps> = ({
  rootNode,
  width = 800,
  height = 500,
  onSelectStock,
}) => {
  const [navPath, setNavPath] = useState<HierarchyNode[]>([rootNode]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [announcement, setAnnouncement] = useState<string>('Displaying All Assets');

  const activeNode = navPath[navPath.length - 1] ?? rootNode;

  const layoutRects = useMemo(() => {
    return computeTreemapLayout(activeNode, width, height);
  }, [activeNode, width, height]);

  const handleDrillDown = useCallback(
    (childNode: HierarchyNode) => {
      const hasChildren = childNode.children && childNode.children.length > 0;
      if (hasChildren) {
        setNavPath(prev => [...prev, childNode]);
        setFocusedIndex(0);
        setAnnouncement(`Drilled into ${childNode.name}, ${childNode.children?.length ?? 0} items`);
      } else if (childNode.depth === 'stock' || childNode.contributions) {
        onSelectStock?.(childNode);
      }
    },
    [onSelectStock]
  );

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

  const handleTileKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number, rect: TreemapRect) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIdx = (index + 1) % layoutRects.length;
        setFocusedIndex(nextIdx);
        document.getElementById(`treemap-tile-${nextIdx}`)?.focus();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIdx = (index - 1 + layoutRects.length) % layoutRects.length;
        setFocusedIndex(prevIdx);
        document.getElementById(`treemap-tile-${prevIdx}`)?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleDrillDown(rect.node);
      }
    },
    [layoutRects.length, handleDrillDown]
  );

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.key === 'Escape' || event.key === 'Backspace') && navPath.length > 1) {
        const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          handleZoomOut();
        }
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [navPath.length, handleZoomOut]);

  return (
    <div className="flex flex-col w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <TreemapHeader
        navPath={navPath}
        canZoomOut={navPath.length > 1}
        onBreadcrumbClick={handleBreadcrumbClick}
        onZoomOut={handleZoomOut}
      />

      <TreemapSvgCanvas
        layoutRects={layoutRects}
        width={width}
        height={height}
        focusedIndex={focusedIndex}
        onTileClick={handleDrillDown}
        onTileKeyDown={handleTileKeyDown}
      />
    </div>
  );
};
