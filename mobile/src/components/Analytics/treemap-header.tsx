import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import type { HierarchyNode } from '../../services/hierarchy-builder';

const styles = StyleSheet.create({
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
});

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
