import * as SecureStore from 'expo-secure-store';
import type { EnrichedHolding } from './portfolio-service';
export {
  generateSmartInsights,
  type SmartInsight,
  type InsightType,
  type InsightSeverity,
  type SmartInsightsOptions,
} from './insights-generator';

export const SECURE_STORE_GOALS_KEY = 'PORTFOLIO_FINANCIAL_GOALS';

export type GoalCategory =
  | 'Retirement'
  | 'Emergency Fund'
  | 'House Down Payment'
  | 'Education'
  | 'Vacation'
  | 'Custom';

export type GoalPriority = 'High' | 'Medium' | 'Low';

export type GoalDeadlineStatus = 'On Track' | 'Behind' | 'Ahead' | 'Completed';

export interface FinancialGoal {
  id: string;
  name: string;
  category: GoalCategory;
  priority: GoalPriority;
  targetAmount: number;
  targetDate: string;
  allocatedFolioNumbers?: string[] | undefined;
  allocatedPercentage?: number | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgressMetrics {
  currentValue: number;
  targetAmount: number;
  progressPercentage: number;
  status: GoalDeadlineStatus;
  remainingAmount: number;
  remainingMonths: number;
  requiredMonthlySip: number;
}

export interface CreateGoalInput {
  name: string;
  category: GoalCategory;
  priority: GoalPriority;
  targetAmount: number;
  targetDate: string;
  allocatedFolioNumbers?: string[] | undefined;
  allocatedPercentage?: number | undefined;
}

export interface UpdateGoalInput {
  name?: string | undefined;
  category?: GoalCategory | undefined;
  priority?: GoalPriority | undefined;
  targetAmount?: number | undefined;
  targetDate?: string | undefined;
  allocatedFolioNumbers?: string[] | undefined;
  allocatedPercentage?: number | undefined;
}

export interface GoalStatusOptions {
  remainingMonths: number;
  progressPercentage?: number | undefined;
  createdAt?: string | undefined;
  asOfDate?: Date | undefined;
}

export interface GoalCalculationOptions {
  totalNetWorth: number;
  asOfDate?: Date | undefined;
}

export interface SipCalculationOptions {
  remainingMonths: number;
  annualReturnRate?: number | undefined;
}

export const DEFAULT_GOALS: FinancialGoal[] = [
  {
    id: 'goal-retirement-2045',
    name: 'Retirement Corpus 2045',
    category: 'Retirement',
    priority: 'High',
    targetAmount: 20000000,
    targetDate: '2045-12-31',
    allocatedPercentage: 60,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'goal-emergency-fund',
    name: '6-Month Emergency Fund',
    category: 'Emergency Fund',
    priority: 'High',
    targetAmount: 500000,
    targetDate: '2027-12-31',
    allocatedPercentage: 15,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'goal-house-downpayment',
    name: 'Home Down Payment',
    category: 'House Down Payment',
    priority: 'Medium',
    targetAmount: 3500000,
    targetDate: '2029-06-30',
    allocatedPercentage: 25,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

/**
 * Calculates remaining whole months until a target goal date.
 *
 * @param targetDate - ISO date string or year (e.g. "2030-12-31")
 * @param asOfDate - Baseline comparison date
 * @returns Non-negative remaining months count
 */
export function calculateRemainingMonths(
  targetDate: string,
  asOfDate: Date = new Date(),
): number {
  const normalized = targetDate.length === 4 ? `${targetDate}-12-31` : targetDate;
  const target = new Date(normalized);
  if (isNaN(target.getTime())) return 0;

  const diffYears = target.getUTCFullYear() - asOfDate.getUTCFullYear();
  const diffMonths = target.getUTCMonth() - asOfDate.getUTCMonth();
  const totalMonths = diffYears * 12 + diffMonths;

  return Math.max(0, totalMonths);
}

/**
 * Calculates the required monthly SIP investment needed to bridge goal shortfall.
 *
 * @param targetAmount - Total monetary target of the goal
 * @param currentValue - Current accumulated amount allocated to this goal
 * @param monthsOrOptions - Remaining months count or options with expected return
 * @returns Rounded required monthly SIP in rupees
 */
export function calculateRequiredMonthlySip(
  targetAmount: number,
  currentValue: number,
  monthsOrOptions: number | SipCalculationOptions,
): number {
  if (currentValue >= targetAmount) return 0;

  const months = typeof monthsOrOptions === 'number'
    ? monthsOrOptions
    : monthsOrOptions.remainingMonths;
  const returnRate = typeof monthsOrOptions === 'object' && monthsOrOptions.annualReturnRate !== undefined
    ? monthsOrOptions.annualReturnRate
    : 0.10;

  if (months <= 0) return 0;

  if (returnRate <= 0) {
    const linearShortfall = targetAmount - currentValue;
    return Math.round(linearShortfall / months);
  }

  const monthlyRate = returnRate / 12;
  const compFactor = Math.pow(1 + monthlyRate, months);
  const projectedCurrent = currentValue * compFactor;

  if (projectedCurrent >= targetAmount) return 0;

  const shortfallToFund = targetAmount - projectedCurrent;
  const annuityFactor = (compFactor - 1) / monthlyRate;

  return Math.max(0, Math.round(shortfallToFund / annuityFactor));
}

function evaluateTrajectory(
  progressPct: number,
  createdAt: string,
  options: GoalStatusOptions,
): GoalDeadlineStatus {
  const created = new Date(createdAt);
  const asOf = options.asOfDate ?? new Date();
  if (isNaN(created.getTime())) return 'On Track';

  const elapsedYears = asOf.getUTCFullYear() - created.getUTCFullYear();
  const elapsedMonths = elapsedYears * 12 + (asOf.getUTCMonth() - created.getUTCMonth());
  const totalMonths = elapsedMonths + options.remainingMonths;

  if (totalMonths <= 0 || elapsedMonths <= 0) {
    return 'On Track';
  }

  const expectedProgress = (elapsedMonths / totalMonths) * 100;
  if (progressPct >= expectedProgress * 1.05) return 'Ahead';
  if (progressPct >= expectedProgress * 0.90) return 'On Track';
  return 'Behind';
}

/**
 * Determines goal deadline progression status.
 *
 * @param currentValue - Current accumulated amount
 * @param targetAmount - Total target amount
 * @param options - Contextual progress and date options
 * @returns Calculated GoalDeadlineStatus
 */
export function calculateGoalStatus(
  currentValue: number,
  targetAmount: number,
  options: GoalStatusOptions,
): GoalDeadlineStatus {
  if (currentValue >= targetAmount || (options.progressPercentage ?? 0) >= 100) {
    return 'Completed';
  }

  if (options.remainingMonths <= 0) {
    return 'Behind';
  }

  const progressPct = options.progressPercentage ?? (targetAmount > 0 ? (currentValue / targetAmount) * 100 : 0);

  if (options.createdAt) {
    return evaluateTrajectory(progressPct, options.createdAt, options);
  }

  if (options.remainingMonths <= 12 && progressPct < 60) {
    return 'Behind';
  }

  return 'On Track';
}

function calculateAllocatedValue(
  goal: FinancialGoal,
  holdings: EnrichedHolding[],
  netWorth: number,
): number {
  if (goal.allocatedFolioNumbers && goal.allocatedFolioNumbers.length > 0) {
    const folios = new Set(goal.allocatedFolioNumbers);
    return holdings
      .filter((h) => folios.has(h.folio_number))
      .reduce((sum, h) => sum + h.current_value, 0);
  }

  if (goal.allocatedPercentage !== undefined && goal.allocatedPercentage > 0) {
    return (netWorth * goal.allocatedPercentage) / 100;
  }

  return netWorth;
}

/**
 * Computes complete progress metrics for a financial goal.
 *
 * @param goal - Target financial goal definition
 * @param holdings - User holdings list
 * @param netWorthOrOptions - Net worth number or context options
 * @returns Fully computed progress metrics
 */
export function calculateGoalProgress(
  goal: FinancialGoal,
  holdings: EnrichedHolding[],
  netWorthOrOptions: number | GoalCalculationOptions,
): GoalProgressMetrics {
  const netWorth = typeof netWorthOrOptions === 'number'
    ? netWorthOrOptions
    : netWorthOrOptions.totalNetWorth;
  const asOf = typeof netWorthOrOptions === 'object' && netWorthOrOptions.asOfDate
    ? netWorthOrOptions.asOfDate
    : new Date();

  const currentValue = calculateAllocatedValue(goal, holdings, netWorth);
  const rawProgress = goal.targetAmount > 0 ? (currentValue / goal.targetAmount) * 100 : 100;
  const progressPercentage = Math.round(rawProgress * 10) / 10;
  const remainingMonths = calculateRemainingMonths(goal.targetDate, asOf);
  const remainingAmount = Math.max(0, goal.targetAmount - currentValue);
  const requiredMonthlySip = calculateRequiredMonthlySip(goal.targetAmount, currentValue, remainingMonths);
  const status = calculateGoalStatus(currentValue, goal.targetAmount, {
    remainingMonths,
    progressPercentage,
    createdAt: goal.createdAt,
    asOfDate: asOf,
  });

  return {
    currentValue,
    targetAmount: goal.targetAmount,
    progressPercentage,
    status,
    remainingAmount,
    remainingMonths,
    requiredMonthlySip,
  };
}

/**
 * Retrieves all stored financial goals from hardware secure storage.
 *
 * @returns Array of saved goals or default starter goals
 */
export async function getStoredGoals(): Promise<FinancialGoal[]> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_STORE_GOALS_KEY);
    if (!raw) return DEFAULT_GOALS;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as FinancialGoal[];
    }
    return DEFAULT_GOALS;
  } catch {
    return DEFAULT_GOALS;
  }
}

/**
 * Persists an array of financial goals to secure storage.
 *
 * @param goals - Goals array to persist
 */
export async function saveGoals(goals: FinancialGoal[]): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_GOALS_KEY, JSON.stringify(goals));
}

/**
 * Creates and persists a new financial goal.
 *
 * @param input - Properties of the new goal
 * @returns Newly created financial goal
 */
export async function addGoal(input: CreateGoalInput): Promise<FinancialGoal> {
  const existing = await getStoredGoals();
  const now = new Date().toISOString();
  const newGoal: FinancialGoal = {
    id: `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: input.name.trim(),
    category: input.category,
    priority: input.priority,
    targetAmount: Math.max(0, input.targetAmount),
    targetDate: input.targetDate.trim(),
    allocatedFolioNumbers: input.allocatedFolioNumbers,
    allocatedPercentage: input.allocatedPercentage,
    createdAt: now,
    updatedAt: now,
  };

  await saveGoals([...existing, newGoal]);
  return newGoal;
}

/**
 * Updates an existing goal by ID.
 *
 * @param id - Goal identifier
 * @param updates - Partial properties to modify
 * @returns Updated financial goal
 */
export async function updateGoal(
  id: string,
  updates: UpdateGoalInput,
): Promise<FinancialGoal> {
  const existing = await getStoredGoals();
  const index = existing.findIndex((g) => g.id === id);
  if (index === -1) {
    throw new Error(`Goal with ID ${id} not found`);
  }

  const current = existing[index]!;
  const updated: FinancialGoal = {
    id: current.id,
    name: updates.name ?? current.name,
    category: updates.category ?? current.category,
    priority: updates.priority ?? current.priority,
    targetAmount: updates.targetAmount ?? current.targetAmount,
    targetDate: updates.targetDate ?? current.targetDate,
    allocatedFolioNumbers: updates.allocatedFolioNumbers ?? current.allocatedFolioNumbers,
    allocatedPercentage: updates.allocatedPercentage ?? current.allocatedPercentage,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const next = [...existing];
  next[index] = updated;
  await saveGoals(next);
  return updated;
}

/**
 * Deletes a financial goal by ID.
 *
 * @param id - Goal identifier to remove
 */
export async function deleteGoal(id: string): Promise<void> {
  const existing = await getStoredGoals();
  const filtered = existing.filter((g) => g.id !== id);
  await saveGoals(filtered);
}
