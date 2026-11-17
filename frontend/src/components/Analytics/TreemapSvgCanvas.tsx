/**
 * @file TreemapSvgCanvas.tsx
 * @module components/Analytics/TreemapSvgCanvas
 * @description SVG rendering canvas for squarified multi-level treemap tiles.
 */

import React from 'react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';
import type { TreemapRect } from './MultiLevelTreemap';
import { formatIndianRupee } from '../../utils/hierarchy-builder';

interface TreemapSvgCanvasProps {
  layoutRects: TreemapRect[];
  width: number;
  height: number;
  focusedIndex: number;
  onTileClick: (node: HierarchyNode) => void;
  onTileKeyDown: (event: React.KeyboardEvent, index: number, rect: TreemapRect) => void;
}

const TreemapDefs: React.FC<{ layoutRects: TreemapRect[] }> = ({ layoutRects }) => (
  <defs>
    <pattern
      id="hedged-stripes"
      patternUnits="userSpaceOnUse"
      width="10"
      height="10"
      patternTransform="rotate(45)"
    >
      <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="3" />
    </pattern>

    {layoutRects.map((rect, idx) => (
      <clipPath key={`clip-${rect.node.id}-${idx}`} id={`clip-${rect.node.id}-${idx}`}>
        <rect
          x={rect.x + 2}
          y={rect.y + 2}
          width={Math.max(0, rect.width - 4)}
          height={Math.max(0, rect.height - 4)}
        />
      </clipPath>
    ))}
  </defs>
);

interface SingleTileProps {
  rect: TreemapRect;
  index: number;
  isFocused: boolean;
  onTileClick: (node: HierarchyNode) => void;
  onTileKeyDown: (event: React.KeyboardEvent, index: number, rect: TreemapRect) => void;
}

const SingleTile: React.FC<SingleTileProps> = ({
  rect,
  index,
  isFocused,
  onTileClick,
  onTileKeyDown,
}) => {
  const { node } = rect;
  const isTier1 = rect.width >= 80 && rect.height >= 52;
  const isTier2 = !isTier1 && rect.width >= 50 && rect.height >= 32;
  const isInteractive = (node.children && node.children.length > 0) || node.depth === 'stock';
  const weightPct = (node.metrics.weightOfParent * 100).toFixed(1);
  const rupeeStr = formatIndianRupee(node.metrics.signedValue);

  return (
    <g
      id={`treemap-tile-${index}`}
      role="button"
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${node.name}, ${rupeeStr}, ${weightPct}%`}
      onClick={() => onTileClick(node)}
      onKeyDown={e => onTileKeyDown(e, index, rect)}
      className={`cursor-pointer transition-opacity duration-200 outline-none focus:ring-2 focus:ring-offset-2 ${
        isInteractive ? 'hover:opacity-90' : ''
      }`}
      style={{ outline: 'none' }}
    >
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

      {(isTier1 || isTier2) && (
        <g clipPath={`url(#clip-${node.id}-${index})`} aria-hidden="true">
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
};

export const TreemapSvgCanvas: React.FC<TreemapSvgCanvasProps> = ({
  layoutRects,
  width,
  height,
  focusedIndex,
  onTileClick,
  onTileKeyDown,
}) => {
  return (
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
        <TreemapDefs layoutRects={layoutRects} />
        {layoutRects.map((rect, index) => (
          <SingleTile
            key={`${rect.node.id}-${index}`}
            rect={rect}
            index={index}
            isFocused={index === focusedIndex}
            onTileClick={onTileClick}
            onTileKeyDown={onTileKeyDown}
          />
        ))}
      </svg>
    </div>
  );
};
