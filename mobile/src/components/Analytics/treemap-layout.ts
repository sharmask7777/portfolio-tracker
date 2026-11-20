import type { HierarchyNode } from '../../services/hierarchy-builder';

/**
 * Geometric bounds and associated hierarchy node for a rendered treemap tile.
 */
export interface TreemapRect {
  x: number;
  y: number;
  width: number;
  height: number;
  node: HierarchyNode;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AspectParams {
  candidateRow: HierarchyNode[];
  length: number;
  totalValue: number;
  initialArea: number;
}

/**
 * Computes the worst aspect ratio among all nodes in a candidate row.
 *
 * @param params Aspect calculation parameters
 * @returns Worst aspect ratio (closer to 1.0 is more squarified)
 */
function computeWorstAspect(params: AspectParams): number {
  const { candidateRow, length, totalValue, initialArea } = params;
  if (candidateRow.length === 0 || length <= 0 || totalValue <= 0 || initialArea <= 0) {
    return Infinity;
  }
  const rowSum = candidateRow.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
  if (rowSum <= 0) return Infinity;

  const rowArea = (rowSum / totalValue) * initialArea;
  const rowThickness = rowArea / length;
  if (rowThickness <= 0) return Infinity;

  let maxAspect = 0;
  for (const node of candidateRow) {
    const nodeVal = Math.max(0, node.metrics.layoutValue);
    const nodeArea = (nodeVal / totalValue) * initialArea;
    const nodeLength = nodeArea / rowThickness;
    if (nodeLength <= 0) continue;
    const aspect = Math.max(nodeLength / rowThickness, rowThickness / nodeLength);
    if (aspect > maxAspect) {
      maxAspect = aspect;
    }
  }
  return maxAspect;
}

interface FinalRowResult {
  rects: TreemapRect[];
  remainingRect: BoundingBox;
}

interface FinalRowParams {
  finalRow: HierarchyNode[];
  currentRect: BoundingBox;
  totalValue: number;
  initialArea: number;
}

function computeRemainingRect(
  currentRect: BoundingBox,
  thickness: number,
  isHorizontal: boolean,
): BoundingBox {
  if (isHorizontal) {
    return {
      x: currentRect.x + thickness,
      y: currentRect.y,
      width: Math.max(0, currentRect.width - thickness),
      height: currentRect.height,
    };
  }
  return {
    x: currentRect.x,
    y: currentRect.y + thickness,
    width: currentRect.width,
    height: Math.max(0, currentRect.height - thickness),
  };
}

interface TileBuildParams {
  node: HierarchyNode;
  rect: BoundingBox;
  isHorizontal: boolean;
  offset: number;
  thickness: number;
  itemLength: number;
}

function buildTile(params: TileBuildParams): TreemapRect {
  const { node, rect, isHorizontal, offset, thickness, itemLength } = params;
  return {
    x: isHorizontal ? rect.x : rect.x + offset,
    y: isHorizontal ? rect.y + offset : rect.y,
    width: isHorizontal ? thickness : itemLength,
    height: isHorizontal ? itemLength : thickness,
    node,
  };
}

/**
 * Lays out a finalized squarified row along the shorter axis of the current rectangle.
 *
 * @param params Layout parameters
 * @returns Placed tile rectangles and the remaining available bounding box
 */
function layoutFinalRow(params: FinalRowParams): FinalRowResult {
  const { finalRow, currentRect, totalValue, initialArea } = params;
  const rowSum = finalRow.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
  const rowArea = totalValue > 0 ? (rowSum / totalValue) * initialArea : 0;
  const isHorizontal = currentRect.width >= currentRect.height;
  const side = isHorizontal ? currentRect.height : currentRect.width;
  const thickness = side > 0 ? rowArea / side : 0;

  const rowRects: TreemapRect[] = [];
  let offset = 0;

  for (const node of finalRow) {
    const nodeVal = Math.max(0, node.metrics.layoutValue);
    const nodeArea = totalValue > 0 ? (nodeVal / totalValue) * initialArea : 0;
    const itemLength = thickness > 0 ? nodeArea / thickness : 0;

    rowRects.push(buildTile({ node, rect: currentRect, isHorizontal, offset, thickness, itemLength }));
    offset += itemLength;
  }

  const remainingRect = computeRemainingRect(currentRect, thickness, isHorizontal);
  return { rects: rowRects, remainingRect };
}

interface ShouldAddParams {
  currentRow: HierarchyNode[];
  candidateRow: HierarchyNode[];
  boundingRect: BoundingBox;
  totalValue: number;
  initialArea: number;
}

function shouldAddToRow(params: ShouldAddParams): boolean {
  const { currentRow, candidateRow, boundingRect, totalValue, initialArea } = params;
  if (currentRow.length === 0) return true;
  const currentMinSide = Math.min(boundingRect.width, boundingRect.height);

  const currentWorst = computeWorstAspect({
    candidateRow: currentRow,
    length: currentMinSide,
    totalValue,
    initialArea,
  });
  const candidateWorst = computeWorstAspect({
    candidateRow,
    length: currentMinSide,
    totalValue,
    initialArea,
  });

  return candidateWorst <= currentWorst;
}

interface SquarifyParams {
  children: HierarchyNode[];
  rect: BoundingBox;
  totalValue: number;
  initialArea: number;
}

/**
 * Recursive squarify step producing tile rectangles with aspect ratios close to 1:1.
 *
 * @param params Squarify parameters
 * @returns Placed treemap tile rectangles
 */
function squarify(params: SquarifyParams): TreemapRect[] {
  const { children, rect, totalValue, initialArea } = params;
  if (children.length === 0 || totalValue <= 0 || initialArea <= 0) return [];
  if (Math.min(rect.width, rect.height) <= 0) return [];

  const results: TreemapRect[] = [];
  const remainingChildren = [...children];
  let currentRow: HierarchyNode[] = [];
  let currentBoundingRect: BoundingBox = { ...rect };

  while (remainingChildren.length > 0) {
    const nextChild = remainingChildren[0];
    if (!nextChild) break;

    const candidateRow = [...currentRow, nextChild];
    const canAdd = shouldAddToRow({
      currentRow,
      candidateRow,
      boundingRect: currentBoundingRect,
      totalValue,
      initialArea,
    });

    if (canAdd) {
      currentRow.push(nextChild);
      remainingChildren.shift();
    } else {
      const { rects, remainingRect } = layoutFinalRow({
        finalRow: currentRow,
        currentRect: currentBoundingRect,
        totalValue,
        initialArea,
      });
      results.push(...rects);
      currentBoundingRect = remainingRect;
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    const { rects } = layoutFinalRow({ finalRow: currentRow, currentRect: currentBoundingRect, totalValue, initialArea });
    results.push(...rects);
  }

  return results;
}

/**
 * Computes squarified treemap layout tile bounds for a given hierarchy node.
 *
 * @param root Hierarchy node whose children will be laid out
 * @param width Viewport width in pixels
 * @param height Viewport height in pixels
 * @returns Array of positioned tile rectangles
 */
export function computeTreemapLayout(
  root: HierarchyNode,
  width: number,
  height: number,
): TreemapRect[] {
  if (width <= 0 || height <= 0) return [];

  const children = root.children ?? [];
  const validChildren = children.filter((c) => c.metrics.layoutValue > 0);

  if (validChildren.length === 0) {
    if (root.metrics.layoutValue > 0) {
      return [{ x: 0, y: 0, width, height, node: root }];
    }
    return [];
  }

  const sortedChildren = [...validChildren].sort(
    (a, b) => b.metrics.layoutValue - a.metrics.layoutValue,
  );

  const totalValue = sortedChildren.reduce((sum, n) => sum + Math.max(0, n.metrics.layoutValue), 0);
  if (totalValue <= 0) return [];

  return squarify({
    children: sortedChildren,
    rect: { x: 0, y: 0, width, height },
    totalValue,
    initialArea: width * height,
  });
}
