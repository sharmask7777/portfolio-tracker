import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import Svg, { G, Rect, Text as SvgText, TSpan, Defs, Pattern, Line } from 'react-native-svg';
import { TreemapHeader, TreemapBreadcrumbs } from './treemap-header';

export { TreemapHeader, TreemapBreadcrumbs };
import type { HierarchyNode } from '../../services/hierarchy-builder';
import { computeTreemapLayout, type TreemapRect } from './treemap-layout';

/**
 * Properties for configuring the SvgTreemap component.
 */
export interface SvgTreemapProps {
  rootNode: HierarchyNode;
  width?: number | undefined;
  height?: number | undefined;
  onSelectStock?: ((node: HierarchyNode) => void) | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  emptyContainer: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 120,
  },
  emptyText: {
    fontSize: 13,
    color: '#a1a1aa',
    fontWeight: '500',
  },
});

/**
 * Properties for a single rendered Treemap tile.
 */
export interface TileProps {
  rect: TreemapRect;
  onPress: (node: HierarchyNode) => void;
}

interface TileContentProps {
  x: number;
  y: number;
  height: number;
  displayName: string;
  pct: string;
  denomination: string;
  textColor: string;
}

function TileContent({
  x,
  y,
  height,
  displayName,
  pct,
  denomination,
  textColor,
}: TileContentProps): React.ReactElement {
  return (
    <SvgText x={x + 6} y={y + 16} fill={textColor} fontSize="11" fontWeight="bold">
      {displayName}
      {height >= 42 && (
        <TSpan x={x + 6} y={y + 30} fill={textColor} fontSize="10" fillOpacity={0.85}>
          {`${pct}${denomination}`}
        </TSpan>
      )}
    </SvgText>
  );
}

interface TileBackgroundProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isHedged?: boolean | undefined;
}

function TileBackground({ x, y, width, height, color, isHedged }: TileBackgroundProps): React.ReactElement {
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="#18181b"
        strokeWidth={1.5}
        rx={3}
      />
      {isHedged && (
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="url(#mobile-hedged-stripes)"
          stroke="#18181b"
          strokeWidth={1.5}
          rx={3}
        />
      )}
    </>
  );
}

/**
 * Single SVG rectangle tile inside the Treemap.
 *
 * @param props Tile properties
 * @returns Rendered tile group element
 */
export function TreemapTile({ rect, onPress }: TileProps): React.ReactElement {
  const { x, y, width, height, node } = rect;
  const isLargeEnough = width >= 44 && height >= 28;
  const pct = (node.metrics.weightOfParent * 100).toFixed(1);
  const denomination = node.depth === 'stock' ? '% of Sector' : '% of Portfolio';
  const displayName = node.name.length > 14 && width < 90
    ? `${node.name.slice(0, 12)}…`
    : node.name;

  return (
    <G
      key={node.id}
      onPress={() => onPress(node)}
      accessibilityRole="button"
      accessibilityLabel={`${node.name}, ${pct}${denomination}`}
    >
      <TileBackground
        x={x}
        y={y}
        width={width}
        height={height}
        color={node.color || '#3b82f6'}
        isHedged={node.isHedged}
      />
      {isLargeEnough && (
        <TileContent
          x={x}
          y={y}
          height={height}
          displayName={displayName}
          pct={pct}
          denomination={denomination}
          textColor={node.textColor || '#ffffff'}
        />
      )}
    </G>
  );
}

function useTreemapNavigation(rootNode: HierarchyNode, onSelectStock?: (node: HierarchyNode) => void) {
  const [navPath, setNavPath] = useState<HierarchyNode[]>([rootNode]);
  const effectiveNavPath = useMemo(() => {
    if (navPath.length === 1 && navPath[0]?.id === rootNode.id && navPath[0] !== rootNode) {
      return [rootNode];
    }
    return navPath;
  }, [navPath, rootNode]);
  const activeNode = effectiveNavPath[effectiveNavPath.length - 1] ?? rootNode;

  const handleTilePress = useCallback((node: HierarchyNode) => {
    if (node.children && node.children.length > 0) {
      setNavPath((prev) => [...prev, node]);
    } else {
      onSelectStock?.(node);
    }
  }, [onSelectStock]);

  const handleBack = useCallback(() => {
    setNavPath((prev) => (prev.length > 1 ? prev.slice(0, prev.length - 1) : prev));
  }, []);

  const handleSelectCrumb = useCallback((idx: number) => {
    setNavPath((prev) => prev.slice(0, idx + 1));
  }, []);

  return { navPath, activeNode, handleTilePress, handleBack, handleSelectCrumb };
}

/**
 * Visual squarified Treemap rendering asset class and sector blocks with react-native-svg.
 *
 * @param props SvgTreemap properties
 * @returns Rendered treemap element
 */
export function SvgTreemap({
  rootNode,
  width = 340,
  height = 220,
  onSelectStock,
  testID = 'svg-treemap',
}: SvgTreemapProps): React.ReactElement {
  const { navPath, activeNode, handleTilePress, handleBack, handleSelectCrumb } =
    useTreemapNavigation(rootNode, onSelectStock);

  const rects = useMemo(() => {
    return computeTreemapLayout(activeNode, width, height);
  }, [activeNode, width, height]);

  if (rootNode.metrics.layoutValue <= 0 || rects.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No allocation data to display</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <TreemapHeader title={activeNode.name} canGoBack={navPath.length > 1} onBack={handleBack} />
      <TreemapBreadcrumbs navPath={navPath} onSelectCrumb={handleSelectCrumb} />
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="mobile-hedged-stripes"
            patternUnits="userSpaceOnUse"
            width={10}
            height={10}
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={10} stroke="rgba(255, 255, 255, 0.4)" strokeWidth={3} />
          </Pattern>
        </Defs>
        {rects.map((rect) => (
          <TreemapTile key={rect.node.id} rect={rect} onPress={handleTilePress} />
        ))}
      </Svg>
    </View>
  );
}
