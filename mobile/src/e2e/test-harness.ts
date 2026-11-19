import { DatabaseSync } from 'node:sqlite';
import React from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

export type SqlInput = null | number | bigint | string | Uint8Array;

export interface RenderNode {
  type: unknown;
  props: Record<string, unknown>;
}

export function extractParams(args: unknown[]): SqlInput[] {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0] as SqlInput[];
  }
  return args as SqlInput[];
}

export function createInMemoryDatabase(): SQLiteDatabase {
  const nodeDb = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => {
      nodeDb.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const res = stmt.run(...params);
      return {
        lastInsertRowId: Number(res.lastInsertRowid),
        changes: Number(res.changes),
      };
    },
    getAllAsync: async <T>(sql: string, ...args: unknown[]): Promise<T[]> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      return stmt.all(...params) as unknown as T[];
    },
    getFirstAsync: async <T>(sql: string, ...args: unknown[]): Promise<T | null> => {
      const params = extractParams(args);
      const stmt = nodeDb.prepare(sql);
      const res = stmt.get(...params);
      return (res ?? null) as unknown as T | null;
    },
    withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
      nodeDb.exec('BEGIN TRANSACTION;');
      try {
        const result = await task();
        nodeDb.exec('COMMIT;');
        return result;
      } catch (err) {
        nodeDb.exec('ROLLBACK;');
        throw err;
      }
    },
    closeAsync: async () => {
      nodeDb.close();
    },
  } as unknown as SQLiteDatabase;
}

let hookIndex = 0;
let effectIndex = 0;
let memoIndex = 0;
let stateStore: unknown[] = [];
let effectStore: { deps: unknown[] | undefined; cleanup?: (() => void) | undefined }[] = [];
let memoStore: { deps: unknown[] | undefined; value: unknown }[] = [];
let renderFn: (() => React.ReactElement) | null = null;
let currentRoot: unknown = null;

export function resetHookState(): void {
  hookIndex = 0;
  effectIndex = 0;
  memoIndex = 0;
  stateStore = [];
  effectStore = [];
  memoStore = [];
  renderFn = null;
  currentRoot = null;
}

function rerenderCurrent(): void {
  if (!renderFn) return;
  hookIndex = 0;
  effectIndex = 0;
  memoIndex = 0;
  currentRoot = evaluateNode(renderFn());
}

function checkDepsChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

function evaluateNode(node: unknown, parent?: RenderNode): unknown {
  if (!node) return node;
  if (Array.isArray(node)) {
    return node.map((item) => evaluateNode(item, parent));
  }
  if (isRenderNode(node)) {
    if (typeof node.type === 'function') {
      try {
        const rendered = (node.type as (props: Record<string, unknown>) => unknown)(node.props);
        return evaluateNode(rendered, parent);
      } catch {
        return node;
      }
    }
    const current: RenderNode = {
      type: node.type,
      props: { ...node.props },
    };
    if (parent) {
      (current as { parent?: RenderNode }).parent = parent;
    }
    const children = node.props['children'];
    let newChildren = children;
    if (Array.isArray(children)) {
      newChildren = children.map((c) => evaluateNode(c, current));
    } else if (children) {
      newChildren = evaluateNode(children, current);
    }
    current.props['children'] = newChildren;
    return current;
  }
  return node;
}

function handleUseState(init: unknown): [unknown, (val: unknown) => void] {
  const idx = hookIndex++;
  if (stateStore[idx] === undefined) {
    stateStore[idx] = typeof init === 'function' ? (init as () => unknown)() : init;
  }
  const setState = (val: unknown) => {
    stateStore[idx] =
      typeof val === 'function'
        ? (val as (prev: unknown) => unknown)(stateStore[idx])
        : val;
    rerenderCurrent();
  };
  return [stateStore[idx], setState];
}

function handleUseEffect(fn: () => void | (() => void), deps?: unknown[]): void {
  const idx = effectIndex++;
  const prev = effectStore[idx];
  const changed = !prev || checkDepsChanged(prev.deps, deps);
  if (changed) {
    if (prev?.cleanup) {
      prev.cleanup();
    }
    const cleanup = fn();
    effectStore[idx] = {
      deps,
      cleanup: typeof cleanup === 'function' ? cleanup : undefined,
    };
  }
}

function handleUseMemo(fn: () => unknown, deps?: unknown[]): unknown {
  const idx = memoIndex++;
  const prev = memoStore[idx];
  const changed = !prev || checkDepsChanged(prev.deps, deps);
  if (changed) {
    memoStore[idx] = { deps, value: typeof fn === 'function' ? fn() : fn };
  }
  return memoStore[idx]!.value;
}

export function setupReactHookDispatcher(): void {
  // @ts-expect-error React internals for test runner
  React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
    useState: handleUseState,
    useEffect: handleUseEffect,
    useCallback: (fn: unknown, deps?: unknown[]) => handleUseMemo(() => fn, deps),
    useMemo: handleUseMemo,
    useRef: (init: unknown) => ({ current: init }),
    useContext: () => ({}),
  };
}

function isRenderNode(val: unknown): val is RenderNode {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return 'type' in obj && 'props' in obj && typeof obj.props === 'object' && obj.props !== null;
}

export function findNodes(
  node: unknown,
  predicate: (n: RenderNode) => boolean,
): RenderNode[] {
  if (!node) return [];
  const results: RenderNode[] = [];

  if (Array.isArray(node)) {
    for (const item of node) {
      results.push(...findNodes(item, predicate));
    }
    return results;
  }

  if (isRenderNode(node)) {
    if (predicate(node)) {
      results.push(node);
    }
    const children = node.props['children'];
    if (Array.isArray(children)) {
      for (const child of children) {
        results.push(...findNodes(child, predicate));
      }
    } else if (children) {
      results.push(...findNodes(children, predicate));
    }
  }
  return results;
}

function nodeMatchesText(node: RenderNode, text: string): boolean {
  const children = node.props['children'];
  if (typeof children === 'string' && children.includes(text)) {
    return true;
  }
  const label = node.props['accessibilityLabel'];
  if (typeof label === 'string' && label.includes(text)) {
    return true;
  }
  return false;
}

export function render(fn: () => React.ReactElement): {
  getByText: (text: string) => RenderNode;
  getByTestId: (testId: string) => RenderNode;
  rerender: () => void;
} {
  renderFn = fn;
  rerenderCurrent();
  return {
    getByText: (text: string) => screen.getByText(text),
    getByTestId: (testId: string) => screen.getByTestId(testId),
    rerender: rerenderCurrent,
  };
}

export const screen = {
  getByText(text: string): RenderNode {
    const nodes = findNodes(currentRoot, (n) => nodeMatchesText(n, text));
    if (nodes.length === 0) {
      throw new Error(`Unable to find an element with text: "${text}"`);
    }
    return nodes[0]!;
  },
  queryByText(text: string): RenderNode | null {
    const nodes = findNodes(currentRoot, (n) => nodeMatchesText(n, text));
    return nodes[0] ?? null;
  },
  getByTestId(testId: string): RenderNode {
    const nodes = findNodes(currentRoot, (n) => n.props['testID'] === testId);
    if (nodes.length === 0) {
      throw new Error(`Unable to find an element with testID: "${testId}"`);
    }
    return nodes[0]!;
  },
  queryByTestId(testId: string): RenderNode | null {
    const nodes = findNodes(currentRoot, (n) => n.props['testID'] === testId);
    return nodes[0] ?? null;
  },
};

export const fireEvent = {
  press(node: RenderNode): void {
    let curr: RenderNode | null = node;
    while (curr) {
      const onPress = curr.props['onPress'];
      if (typeof onPress === 'function') {
        (onPress as () => void)();
        return;
      }
      curr = (curr as { parent?: RenderNode }).parent ?? null;
    }
  },
  changeText(node: RenderNode, text: string): void {
    let curr: RenderNode | null = node;
    while (curr) {
      const onChangeText = curr.props['onChangeText'];
      if (typeof onChangeText === 'function') {
        (onChangeText as (t: string) => void)(text);
        return;
      }
      curr = (curr as { parent?: RenderNode }).parent ?? null;
    }
  },
};

export async function waitFor(
  assertion: () => void | Promise<void>,
  timeoutMs = 1000,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  await assertion();
}
