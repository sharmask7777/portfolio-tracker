import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  Platform: { OS: 'android' },
}));

vi.mock('lucide-react-native', () => ({
  TrendingUp: (props: Record<string, unknown>) => ({ type: 'TrendingUp', props }),
  TrendingDown: (props: Record<string, unknown>) => ({ type: 'TrendingDown', props }),
}));

vi.mock('react-native-svg', () => {
  const SvgMock = (props: Record<string, unknown>) => ({ type: 'Svg', props });
  return {
    __esModule: true,
    default: SvgMock,
    Svg: SvgMock,
    Path: (props: Record<string, unknown>) => ({ type: 'Path', props }),
    Circle: (props: Record<string, unknown>) => ({ type: 'Circle', props }),
    Defs: (props: Record<string, unknown>) => ({ type: 'Defs', props }),
    LinearGradient: (props: Record<string, unknown>) => ({ type: 'LinearGradient', props }),
    Stop: (props: Record<string, unknown>) => ({ type: 'Stop', props }),
    Line: (props: Record<string, unknown>) => ({ type: 'Line', props }),
  };
});

import {
  ChartHeader,
  CheckpointTooltip,
  ChartSvgCanvas,
} from '../src/components/Dashboard/chart-components';
import { computeChartGeometry } from '../src/components/Dashboard/chart-geometry';
import type { HistoricalCheckpoint } from '../src/services/reality-check-service';

describe('interactive chart-components', () => {
  const cp: HistoricalCheckpoint = {
    date: '2026-01-15',
    value: 1250000,
    investedAmount: 1000000,
    unrealizedGain: 250000,
    gainPct: 25.0,
    isAth: true,
    athValue: 1250000,
    drawdownPct: 0,
  };

  it('renders Reset Zoom button when chart is zoomed', () => {
    const onResetZoom = vi.fn();
    const rendered = ChartHeader({ isAth: true, drawdown: 0, isZoomed: true, onResetZoom });
    expect(JSON.stringify(rendered)).toContain('Reset Zoom');
    expect(JSON.stringify(rendered)).toContain('reset-zoom-button');
  });

  it('does not render Reset Zoom button when chart is not zoomed', () => {
    const onResetZoom = vi.fn();
    const rendered = ChartHeader({ isAth: true, drawdown: 0, isZoomed: false, onResetZoom });
    expect(JSON.stringify(rendered)).not.toContain('Reset Zoom');
    expect(JSON.stringify(rendered)).not.toContain('reset-zoom-button');
  });

  it('renders Reset to Latest button in tooltip when probe is pinned', () => {
    const onResetProbe = vi.fn();
    const rendered = CheckpointTooltip({ cp, isPinned: true, onResetProbe });
    expect(JSON.stringify(rendered)).toContain('Reset to Latest');
    expect(JSON.stringify(rendered)).toContain('reset-probe-button');
  });

  it('does not render Reset to Latest button in tooltip when probe is not pinned', () => {
    const onResetProbe = vi.fn();
    const rendered = CheckpointTooltip({ cp, isPinned: false, onResetProbe });
    expect(JSON.stringify(rendered)).not.toContain('Reset to Latest');
    expect(JSON.stringify(rendered)).not.toContain('reset-probe-button');
  });

  it('renders scrub hairline when scrubX is provided', () => {
    const geom = computeChartGeometry([cp], 330, 200);
    const rendered = ChartSvgCanvas({
      width: 330,
      height: 200,
      geometry: geom,
      selectedIdx: 0,
      scrubX: 165,
      onSelectIdx: vi.fn(),
      panResponderHandlers: {},
    });
    expect(JSON.stringify(rendered)).toContain('scrub-hairline');
  });

  it('does not render scrub hairline when scrubX is null or undefined', () => {
    const geom = computeChartGeometry([cp], 330, 200);
    const rendered = ChartSvgCanvas({
      width: 330,
      height: 200,
      geometry: geom,
      selectedIdx: 0,
      scrubX: null,
      onSelectIdx: vi.fn(),
    });
    expect(JSON.stringify(rendered)).not.toContain('scrub-hairline');
  });

  it('spreads panResponderHandlers onto canvas container', () => {
    const geom = computeChartGeometry([cp], 330, 200);
    const customHandler = vi.fn();
    const rendered = ChartSvgCanvas({
      width: 330,
      height: 200,
      geometry: geom,
      selectedIdx: 0,
      onSelectIdx: vi.fn(),
      panResponderHandlers: { onResponderGrant: customHandler },
    });
    const serialized = JSON.stringify(rendered);
    expect(serialized).toContain('chart-svg-canvas');
    const props = rendered.props as Record<string, unknown>;
    expect(props.onResponderGrant).toBe(customHandler);
  });
});
