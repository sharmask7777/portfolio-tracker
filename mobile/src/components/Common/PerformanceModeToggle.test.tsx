/**
 * @file PerformanceModeToggle.test.tsx
 * @description Unit tests for PerformanceModeToggle segmented control.
 */

import { describe, it, expect, vi } from 'vitest';
import { PerformanceModeToggle } from './PerformanceModeToggle';

interface ElementProps {
  props: {
    testID?: string;
    accessibilityRole?: string;
    onPress?: () => void;
    style?: unknown;
    children?: ElementProps | ElementProps[];
    [key: string]: unknown;
  };
}

function findByTestId(tree: unknown, testId: string): ElementProps | null {
  if (!tree || typeof tree !== 'object') return null;
  const node = tree as ElementProps;
  if (node.props?.testID === testId) return node;

  const children = node.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findByTestId(child, testId);
      if (found) return found;
    }
  } else if (children) {
    return findByTestId(children, testId);
  }

  return null;
}

describe('PerformanceModeToggle', () => {
  it('renders root toggle container and both mode buttons', () => {
    const onToggle = vi.fn();
    const element = PerformanceModeToggle({ mode: 'XIRR', onToggle });

    const root = findByTestId(element, 'performance-mode-toggle');
    expect(root).toBeDefined();

    const xirrBtn = findByTestId(element, 'toggle-mode-xirr');
    expect(xirrBtn).toBeDefined();

    const absBtn = findByTestId(element, 'toggle-mode-abs');
    expect(absBtn).toBeDefined();
  });

  it('sets accessibilityRole="button" on both toggle segments', () => {
    const onToggle = vi.fn();
    const element = PerformanceModeToggle({ mode: 'XIRR', onToggle });

    const xirrBtn = findByTestId(element, 'toggle-mode-xirr');
    const absBtn = findByTestId(element, 'toggle-mode-abs');

    expect(xirrBtn?.props.accessibilityRole).toBe('button');
    expect(absBtn?.props.accessibilityRole).toBe('button');
  });

  it('triggers onToggle callback when pressing non-active option', () => {
    const onToggle = vi.fn();
    const element = PerformanceModeToggle({ mode: 'XIRR', onToggle });

    const absBtn = findByTestId(element, 'toggle-mode-abs');
    expect(absBtn?.props.onPress).toBeDefined();

    absBtn?.props.onPress?.();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('ABS');
  });

  it('triggers onToggle callback when pressing XIRR from ABS mode', () => {
    const onToggle = vi.fn();
    const element = PerformanceModeToggle({ mode: 'ABS', onToggle });

    const xirrBtn = findByTestId(element, 'toggle-mode-xirr');
    xirrBtn?.props.onPress?.();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('XIRR');

    const absBtn = findByTestId(element, 'toggle-mode-abs');
    absBtn?.props.onPress?.();
    expect(onToggle).toHaveBeenCalledTimes(1); // not called again for active
  });

  it('does not trigger onToggle when pressing already active option', () => {
    const onToggle = vi.fn();
    const element = PerformanceModeToggle({ mode: 'XIRR', onToggle });

    const xirrBtn = findByTestId(element, 'toggle-mode-xirr');
    xirrBtn?.props.onPress?.();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('applies custom style when provided', () => {
    const onToggle = vi.fn();
    const customStyle = { margin: 10 };
    const element = PerformanceModeToggle({ mode: 'XIRR', onToggle, style: customStyle });

    const root = findByTestId(element, 'performance-mode-toggle');
    expect(root?.props.style).toBeDefined();
  });
});
