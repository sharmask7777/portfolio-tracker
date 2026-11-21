import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import Svg, { G, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { ChevronLeft } from 'lucide-react-native';
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#27272a',
    borderRadius: 6,
    gap: 4,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 4,
  },
  crumbText: {
    fontSize: 12,
    color: '#71717a',
  },
  crumbActive: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
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
  const displayName = node.name.length > 14 && width < 90
    ? `${node.name.slice(0, 12)}…`
    : node.name;

  return (
    <G
      key={node.id}
      onPress={() => onPress(node)}
      accessibilityRole="button"
      accessibilityLabel={`${node.name}, ${pct}%`}
    >
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={node.color || '#3b82f6'}
        stroke="#18181b"
        strokeWidth={1.5}
        rx={3}
      />
      {isLargeEnough && (
        <SvgText
          x={x + 6}
          y={y + 16}
          fill={node.textColor || '#ffffff'}
          fontSize="11"
          fontWeight="bold"
        >
          {displayName}
          {height >= 42 && (
            <TSpan
              x={x + 6}
              y={y + 30}
              fill={node.textColor || '#ffffff'}
              fontSize="10"
              fillOpacity={0.85}
            >
              {`${pct}%`}
            </TSpan>
          )}
        </SvgText>
      )}
    </G>
  );
}

/**
 * Properties for Treemap navigation header.
 */
export interface TreemapHeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
}

/**
 * Header displaying active node title and back navigation.
 *
 * @param props Header properties
 * @returns Header element
 */
export function TreemapHeader({ title, canGoBack, onBack }: TreemapHeaderProps): React.ReactElement {
  return (
    <View style={styles.headerRow}>
      <View style={styles.titleGroup}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {canGoBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Navigate up one level in treemap"
        >
          <ChevronLeft size={14} color="#38bdf8" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Properties for breadcrumb path bar.
 */
export interface BreadcrumbProps {
  navPath: HierarchyNode[];
  onSelectCrumb: (index: number) => void;
}

/**
 * Breadcrumbs indicating the current drilldown depth in the portfolio hierarchy.
 *
 * @param props Breadcrumb properties
 * @returns Breadcrumbs bar element
 */
export function TreemapBreadcrumbs({ navPath, onSelectCrumb }: BreadcrumbProps): React.ReactElement {
  return (
    <View style={styles.breadcrumbBar}>
      {navPath.map((crumb, idx) => {
        const isLast = idx === navPath.length - 1;
        return (
          <React.Fragment key={crumb.id}>
            {idx > 0 && <Text style={styles.crumbText}>/</Text>}
            <Text
              style={isLast ? styles.crumbActive : styles.crumbText}
              onPress={() => onSelectCrumb(idx)}
            >
              {crumb.name}
            </Text>
          </React.Fragment>
        );
      })}
    </View>
  );
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
  const [navPath, setNavPath] = useState<HierarchyNode[]>([rootNode]);
  const effectiveNavPath = useMemo(() => {
    if (navPath.length === 1 && navPath[0]?.id === rootNode.id && navPath[0] !== rootNode) {
      return [rootNode];
    }
    return navPath;
  }, [navPath, rootNode]);
  const activeNode = effectiveNavPath[effectiveNavPath.length - 1] ?? rootNode;

  const rects = useMemo(() => {
    return computeTreemapLayout(activeNode, width, height);
  }, [activeNode, width, height]);

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
        {rects.map((rect) => (
          <TreemapTile key={rect.node.id} rect={rect} onPress={handleTilePress} />
        ))}
      </Svg>
    </View>
  );
}
