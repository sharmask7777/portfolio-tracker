import React from 'react';

// Set up React hook dispatcher for testing functional components in Node
// @ts-expect-error React internals for test runner
React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
  useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, vi.fn()],
  useEffect: (fn: () => void) => fn(),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => ({}),
};

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockLocalAuth, mockStorage } = vi.hoisted(() => ({
  mockLocalAuth: {
    hasHardwareAsync: vi.fn(),
    isEnrolledAsync: vi.fn(),
    authenticateAsync: vi.fn(),
  },
  mockStorage: new Map<string, string>(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-local-authentication', () => mockLocalAuth);

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string): Promise<string | null> => {
    return mockStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string): Promise<void> => {
    mockStorage.delete(key);
  }),
}));

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
  Tabs: Object.assign(
    (props: Record<string, unknown>) => ({ type: 'Tabs', props }),
    { Screen: (props: Record<string, unknown>) => ({ type: 'Tabs.Screen', props }) },
  ),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TextInput: (props: Record<string, unknown>) => ({ type: 'TextInput', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
  RefreshControl: (props: Record<string, unknown>) => ({ type: 'RefreshControl', props }),
  Modal: (props: Record<string, unknown>) => ({ type: 'Modal', props }),
  Switch: (props: Record<string, unknown>) => ({ type: 'Switch', props }),
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

vi.mock('react-native-svg', () => {
  const SvgMock = (props: Record<string, unknown>) => ({ type: 'Svg', props });
  return {
    __esModule: true,
    default: SvgMock,
    Svg: SvgMock,
    Rect: (props: Record<string, unknown>) => ({ type: 'Rect', props }),
    Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
    TSpan: (props: Record<string, unknown>) => ({ type: 'TSpan', props }),
    G: (props: Record<string, unknown>) => ({ type: 'G', props }),
    Path: (props: Record<string, unknown>) => ({ type: 'Path', props }),
  };
});

vi.mock('lucide-react-native', () => ({
  LayoutDashboard: (props: Record<string, unknown>) => ({ type: 'LayoutDashboard', props }),
  Briefcase: (props: Record<string, unknown>) => ({ type: 'Briefcase', props }),
  PieChart: (props: Record<string, unknown>) => ({ type: 'PieChart', props }),
  UploadCloud: (props: Record<string, unknown>) => ({ type: 'UploadCloud', props }),
  Settings: (props: Record<string, unknown>) => ({ type: 'Settings', props }),
  ReceiptIndianRupee: (props: Record<string, unknown>) => ({ type: 'ReceiptIndianRupee', props }),
  Layers: (props: Record<string, unknown>) => ({ type: 'Layers', props }),
  Search: (props: Record<string, unknown>) => ({ type: 'Search', props }),
  ArrowUpDown: (props: Record<string, unknown>) => ({ type: 'ArrowUpDown', props }),
  ChevronRight: (props: Record<string, unknown>) => ({ type: 'ChevronRight', props }),
  ChevronLeft: (props: Record<string, unknown>) => ({ type: 'ChevronLeft', props }),
  X: (props: Record<string, unknown>) => ({ type: 'X', props }),
  Info: (props: Record<string, unknown>) => ({ type: 'Info', props }),
  ShieldCheck: (props: Record<string, unknown>) => ({ type: 'ShieldCheck', props }),
  SlidersHorizontal: (props: Record<string, unknown>) => ({ type: 'SlidersHorizontal', props }),
}));

import {
  computeTreemapLayout,
} from '../src/components/Analytics/treemap-layout';
import {
  SvgTreemap,
  TreemapTile,
  TreemapHeader,
  TreemapBreadcrumbs,
} from '../src/components/Analytics/SvgTreemap';
import {
  StockOverlapTable,
  StockRow,
  StockOverlapHeader,
  SearchBar,
  filterExposures,
  sortExposures,
} from '../src/components/Analytics/StockOverlapTable';
import {
  StockDetailModal,
  ModalHeader,
  StockSummaryCards,
  SchemeContributionItem,
} from '../src/components/Analytics/StockDetailModal';
import AnalyticsScreen, {
  AllocationCard,
  AllocationCardsGrid,
  AnalyticsHeader,
} from '../app/(tabs)/analytics';
import TabsLayout from '../app/(tabs)/_layout';
import {
  buildPortfolioHierarchy,
  type StockExposure,
  type XRayData,
  type HierarchyNode,
} from '../src/services/hierarchy-builder';
import { deriveAnalyticsFromHoldings } from '../src/services/analytics-service';
import type { EnrichedHolding } from '../src/services/portfolio-service';

function getProps(element: React.ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe('Analytics Tab & Stock X-Ray Suite', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  const mockXRayData: XRayData = {
    totalValue: 1000000,
    assetAllocation: {
      equity: { percentage: 70, value: 700000 },
      debt: { percentage: 20, value: 200000 },
      cash: { percentage: 5, value: 50000 },
      gold: { percentage: 5, value: 50000 },
      other: { percentage: 0, value: 0 },
    },
    sectors: [
      { name: 'Financial Services', percentage: 40, value: 280000 },
      { name: 'Technology', percentage: 35, value: 245000 },
      { name: 'Healthcare', percentage: 25, value: 175000 },
    ],
    marketCap: {
      large: { percentage: 60, value: 600000 },
      mid: { percentage: 30, value: 300000 },
      small: { percentage: 10, value: 100000 },
    },
    exArbitrage: {
      assetAllocation: {
        equity: { percentage: 55, value: 550000 },
        debt: { percentage: 20, value: 200000 },
        cash: { percentage: 5, value: 50000 },
        gold: { percentage: 5, value: 50000 },
        arbitrage: { percentage: 15, value: 150000 },
        other: { percentage: 0, value: 0 },
      },
      sectors: [
        { name: 'Financial Services', percentage: 40, value: 220000 },
        { name: 'Technology', percentage: 35, value: 192500 },
        { name: 'Healthcare', percentage: 25, value: 137500 },
      ],
      marketCap: {
        large: { percentage: 60, value: 450000 },
        mid: { percentage: 30, value: 225000 },
        small: { percentage: 10, value: 75000 },
      },
    },
  };

  const mockExposures: StockExposure[] = [
    {
      name: 'HDFC Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 160000,
      percentage: 0.16,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 90000, weight: 9.0 },
        { schemeName: 'HDFC Flexi Cap Fund', value: 70000, weight: 7.0 },
      ],
    },
    {
      name: 'Infosys Ltd.',
      sector: 'Technology',
      absoluteValue: 140000,
      percentage: 0.14,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 140000, weight: 14.0 },
      ],
    },
    {
      name: 'ICICI Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 120000,
      percentage: 0.12,
      contributions: [
        { schemeName: 'ICICI Prudential Bluechip Fund', value: 70000, weight: 7.0 },
        { schemeName: 'HDFC Flexi Cap Fund', value: 50000, weight: 5.0 },
      ],
    },
    {
      name: 'Reliance Industries Ltd.',
      sector: 'Energy',
      absoluteValue: 100000,
      percentage: 0.10,
      contributions: [
        { schemeName: 'SBI Bluechip Fund', value: 100000, weight: 10.0 },
      ],
    },
  ];

  const mockEnrichedHoldings: EnrichedHolding[] = [
    {
      id: 'h1',
      folio_number: '12345/A',
      amfi_code: '120503',
      scheme_name: 'Parag Parikh Flexi Cap Fund - Direct Growth',
      isin: 'INF879O01018',
      units: 1000,
      invested_cost: 400000,
      current_nav: 600,
      current_value: 600000,
      asset_class: 'EQUITY',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 2000,
      dayChangePct: 3.45,
      gainLoss: 200000,
      gainLossPct: 50,
    },
    {
      id: 'h2',
      folio_number: '67890/B',
      amfi_code: '119551',
      scheme_name: 'Kotak Equity Arbitrage Fund - Direct Growth',
      isin: 'INF174K01LS2',
      units: 5000,
      invested_cost: 150000,
      current_nav: 35,
      current_value: 175000,
      asset_class: 'HYBRID',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 100,
      dayChangePct: 0.15,
      gainLoss: 25000,
      gainLossPct: 16.6,
    },
    {
      id: 'h3',
      folio_number: '11223/C',
      amfi_code: '100123',
      scheme_name: 'SBI Liquid Fund - Direct Growth',
      isin: 'INF200K01VA8',
      units: 20,
      invested_cost: 65000,
      current_nav: 3500,
      current_value: 70000,
      asset_class: 'DEBT',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 50,
      dayChangePct: 0.05,
      gainLoss: 5000,
      gainLossPct: 7.6,
    },
    {
      id: 'h4',
      folio_number: '44556/D',
      amfi_code: '100456',
      scheme_name: 'Nippon India ETF Gold BeES',
      isin: 'INF732E01037',
      units: 100,
      invested_cost: 50000,
      current_nav: 60,
      current_value: 60000,
      asset_class: 'GOLD',
      nav_date: '2026-11-17',
      updated_at: '2026-11-17T10:00:00Z',
      dayChange: 200,
      dayChangePct: 0.3,
      gainLoss: 10000,
      gainLossPct: 20,
    },
  ];

  describe('Analytics Domain Service (deriveAnalyticsFromHoldings)', () => {
    it('correctly aggregates multi-asset holdings into XRayData and stock exposures', () => {
      const { xrayData, exposures } = deriveAnalyticsFromHoldings(mockEnrichedHoldings);

      expect(xrayData.totalValue).toBe(905000);
      expect(xrayData.assetAllocation.equity.value).toBeGreaterThan(0);
      expect(xrayData.assetAllocation.cash.value).toBe(70000);
      expect(xrayData.assetAllocation.gold.value).toBe(60000);
      expect(xrayData.exArbitrage?.assetAllocation.arbitrage.value).toBe(175000);
      expect(exposures.length).toBe(5);
      expect(exposures[0]?.name).toBe('HDFC Bank Ltd.');
      expect(exposures[0]?.contributions.length).toBeGreaterThan(0);
    });

    it('handles empty portfolio holdings without NaN or runtime exceptions', () => {
      const { xrayData, exposures } = deriveAnalyticsFromHoldings([]);

      expect(xrayData.totalValue).toBe(0);
      expect(xrayData.assetAllocation.equity.value).toBe(0);
      expect(xrayData.sectors).toHaveLength(0);
      expect(exposures).toHaveLength(0);
    });
  });

  describe('Squarified Treemap Layout Engine & Invariants', () => {
    it('computes squarified layout rectangles for portfolio hierarchy', () => {
      const root = buildPortfolioHierarchy(mockXRayData, mockExposures);
      const rects = computeTreemapLayout(root, 360, 240);

      expect(rects.length).toBeGreaterThan(0);
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
        expect(Number.isFinite(rect.x)).toBe(true);
        expect(Number.isFinite(rect.y)).toBe(true);
        expect(Number.isFinite(rect.width)).toBe(true);
        expect(Number.isFinite(rect.height)).toBe(true);
      }
    });

    it('conserves total visual area according to Value Conservation Law (Delta <= 0.01)', () => {
      const root = buildPortfolioHierarchy(mockXRayData, mockExposures);
      const totalWidth = 400;
      const totalHeight = 300;
      const totalArea = totalWidth * totalHeight;

      const rects = computeTreemapLayout(root, totalWidth, totalHeight);
      const childSum = (root.children ?? []).reduce(
        (acc, c) => acc + c.metrics.layoutValue,
        0
      );

      for (const rect of rects) {
        const itemArea = rect.width * rect.height;
        const expectedAreaRatio = rect.node.metrics.layoutValue / childSum;
        const actualAreaRatio = itemArea / totalArea;
        expect(Math.abs(expectedAreaRatio - actualAreaRatio)).toBeLessThanOrEqual(0.01);
      }
    });

    it('handles empty portfolio gracefully without NaN or division by zero', () => {
      const emptyData: XRayData = {
        totalValue: 0,
        assetAllocation: {
          equity: { percentage: 0, value: 0 },
          debt: { percentage: 0, value: 0 },
          cash: { percentage: 0, value: 0 },
          gold: { percentage: 0, value: 0 },
          other: { percentage: 0, value: 0 },
        },
        sectors: [],
        marketCap: {
          large: { percentage: 0, value: 0 },
          mid: { percentage: 0, value: 0 },
          small: { percentage: 0, value: 0 },
        },
      };
      const root = buildPortfolioHierarchy(emptyData, []);
      const rects = computeTreemapLayout(root, 360, 240);

      expect(rects).toEqual([]);
    });

    it('handles pure debt portfolio gracefully without NaN', () => {
      const pureDebtData: XRayData = {
        totalValue: 500000,
        assetAllocation: {
          equity: { percentage: 0, value: 0 },
          debt: { percentage: 100, value: 500000 },
          cash: { percentage: 0, value: 0 },
          gold: { percentage: 0, value: 0 },
          other: { percentage: 0, value: 0 },
        },
        sectors: [],
        marketCap: {
          large: { percentage: 0, value: 0 },
          mid: { percentage: 0, value: 0 },
          small: { percentage: 0, value: 0 },
        },
      };
      const root = buildPortfolioHierarchy(pureDebtData, []);
      const rects = computeTreemapLayout(root, 360, 240);

      expect(rects.length).toBe(1);
      expect(rects[0]?.node.name).toBe('Debt');
      expect(rects[0]?.width).toBe(360);
      expect(rects[0]?.height).toBe(240);
      expect(Number.isNaN(rects[0]?.x)).toBe(false);
      expect(Number.isNaN(rects[0]?.y)).toBe(false);
    });
  });

  describe('SvgTreemap Component & Subcomponents', () => {
    it('renders SvgTreemap tree with nodes and breadcrumbs', () => {
      const root = buildPortfolioHierarchy(mockXRayData, mockExposures);
      const onSelect = vi.fn();
      const element = SvgTreemap({
        rootNode: root,
        width: 360,
        height: 240,
        onSelectStock: onSelect,
      });

      expect(getProps(element)['testID']).toBe('svg-treemap');
    });

    it('renders empty placeholder when portfolio value is zero', () => {
      const emptyRoot: HierarchyNode = {
        id: 'root',
        name: 'Empty Portfolio',
        depth: 'root',
        metrics: {
          signedValue: 0,
          layoutValue: 0,
          weightOfPortfolio: 0,
          weightOfAssetClass: 0,
          weightOfParent: 0,
        },
        color: '#18181b',
        textColor: '#ffffff',
        children: [],
      };
      const element = SvgTreemap({
        rootNode: emptyRoot,
        width: 360,
        height: 240,
      });

      expect(getProps(element)['testID']).toBe('svg-treemap-empty');
    });

    it('renders TreemapTile, TreemapHeader, and TreemapBreadcrumbs directly', () => {
      const root = buildPortfolioHierarchy(mockXRayData, mockExposures);
      const rects = computeTreemapLayout(root, 360, 240);
      const onTilePress = vi.fn();
      const onBack = vi.fn();
      const onSelectCrumb = vi.fn();

      const tile = TreemapTile({ rect: rects[0]!, onPress: onTilePress });
      expect(tile).toBeDefined();

      const header = TreemapHeader({ title: 'Equity', canGoBack: true, onBack });
      expect(header).toBeDefined();

      const crumbs = TreemapBreadcrumbs({ navPath: [root, root.children![0]!], onSelectCrumb });
      expect(crumbs).toBeDefined();
    });
  });

  describe('Stock Overlap Filtering & Sorting', () => {
    it('filters stock exposures by company name search query', () => {
      const filtered = filterExposures(mockExposures, 'HDFC');
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.name).toBe('HDFC Bank Ltd.');
    });

    it('filters stock exposures by sector name', () => {
      const tech = filterExposures(mockExposures, 'Technology');
      expect(tech.length).toBe(1);
      expect(tech[0]?.name).toBe('Infosys Ltd.');
    });

    it('returns empty array when search query matches nothing', () => {
      const nonExistent = filterExposures(mockExposures, 'NonExistentCorp');
      expect(nonExistent.length).toBe(0);
    });

    it('sorts stock exposures by percentage descending by default', () => {
      const sorted = sortExposures(mockExposures, 'percentage', 'desc');
      expect(sorted[0]?.name).toBe('HDFC Bank Ltd.');
      expect(sorted[1]?.name).toBe('Infosys Ltd.');
      expect(sorted[2]?.name).toBe('ICICI Bank Ltd.');
      expect(sorted[3]?.name).toBe('Reliance Industries Ltd.');
    });

    it('sorts stock exposures by overlap fund count descending and ascending', () => {
      const sortedDesc = sortExposures(mockExposures, 'funds', 'desc');
      expect(sortedDesc[0]?.contributions.length).toBe(2);

      const sortedAsc = sortExposures(mockExposures, 'funds', 'asc');
      expect(sortedAsc[0]?.contributions.length).toBe(1);
    });

    it('sorts stock exposures by absolute value and name', () => {
      const byVal = sortExposures(mockExposures, 'value', 'desc');
      expect(byVal[0]?.absoluteValue).toBe(160000);

      const byName = sortExposures(mockExposures, 'name', 'asc');
      expect(byName[0]?.name).toBe('HDFC Bank Ltd.');
    });
  });

  describe('StockOverlapTable Component & Subcomponents', () => {
    it('renders StockOverlapTable with company ranking and overlap badges', () => {
      const onSelect = vi.fn();
      const onToggle = vi.fn();
      const element = StockOverlapTable({
        exposures: mockExposures,
        totalPortfolioValue: 1000000,
        excludeArbitrage: false,
        onToggleExcludeArbitrage: onToggle,
        onSelectStock: onSelect,
      });

      expect(getProps(element)['testID']).toBe('stock-overlap-table');
    });

    it('renders empty table message when exposures list is empty', () => {
      const element = StockOverlapTable({
        exposures: [],
        totalPortfolioValue: 0,
      });

      expect(getProps(element)['testID']).toBe('stock-overlap-table-empty');
    });

    it('renders StockRow, StockOverlapHeader, and SearchBar directly', () => {
      const onRowPress = vi.fn();
      const onToggle = vi.fn();
      const onQuery = vi.fn();

      const row = StockRow({ item: mockExposures[0]!, index: 0, onPress: onRowPress });
      expect(row).toBeDefined();

      const header = StockOverlapHeader({ count: 4, excludeArbitrage: true, onToggleExcludeArbitrage: onToggle });
      expect(header).toBeDefined();

      const search = SearchBar({ query: 'HDFC', onChangeQuery: onQuery });
      expect(search).toBeDefined();
    });
  });

  describe('StockDetailModal Component & Subcomponents', () => {
    it('renders StockDetailModal with company metrics and contributing schemes breakdown', () => {
      const onClose = vi.fn();
      const element = StockDetailModal({
        visible: true,
        stock: mockExposures[0]!, // HDFC Bank
        totalPortfolioValue: 1000000,
        onClose,
      });

      expect(element).not.toBeNull();
      expect(getProps(element!)['testID']).toBe('stock-detail-modal');
    });

    it('renders single scheme contribution without overlap banner', () => {
      const onClose = vi.fn();
      const element = StockDetailModal({
        visible: true,
        stock: mockExposures[1]!, // Infosys (1 fund)
        totalPortfolioValue: 1000000,
        onClose,
      });

      expect(element).not.toBeNull();
    });

    it('renders null or hidden when visible is false', () => {
      const onClose = vi.fn();
      const element = StockDetailModal({
        visible: false,
        stock: mockExposures[0]!,
        totalPortfolioValue: 1000000,
        onClose,
      });

      expect(element).toBeNull();
    });

    it('renders ModalHeader, StockSummaryCards, and SchemeContributionItem directly', () => {
      const onClose = vi.fn();
      const header = ModalHeader({ name: 'HDFC Bank Ltd.', sector: 'Financial Services', onClose });
      expect(header).toBeDefined();

      const cards = StockSummaryCards({ absoluteValue: 160000, pct: '16.00' });
      expect(cards).toBeDefined();

      const item = SchemeContributionItem({
        item: mockExposures[0]!.contributions[0]!,
        totalPortfolioValue: 1000000,
      });
      expect(item).toBeDefined();
    });
  });

  describe('AnalyticsScreen Tab & Allocation Cards', () => {
    it('renders AnalyticsScreen without errors', () => {
      const screen = AnalyticsScreen();
      expect(screen).toBeDefined();
      expect(getProps(screen)['testID']).toBe('analytics-screen');
    });

    it('renders AllocationCard, AllocationCardsGrid, and AnalyticsHeader directly', () => {
      const card = AllocationCard({ name: 'Equity', value: 700000, pct: 70, color: '#38bdf8' });
      expect(card).toBeDefined();

      const grid = AllocationCardsGrid({ xrayData: mockXRayData });
      expect(grid).toBeDefined();

      const header = AnalyticsHeader();
      expect(header).toBeDefined();
    });
  });

  describe('TabsLayout Navigation', () => {
    it('includes Analytics tab in bottom navigation', () => {
      const layout = TabsLayout();
      expect(layout).toBeDefined();
      const props = getProps(layout);
      const children = props['children'] as Array<React.ReactElement<{ name: string }>>;
      const analyticsTab = children.find(child => child.props.name === 'analytics');
      expect(analyticsTab).toBeDefined();
    });
  });
});
