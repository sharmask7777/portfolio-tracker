import * as SecureStore from 'expo-secure-store';
import { getStoredCredentials } from './auth-service';
import type { EnrichedHolding } from './portfolio-service';

export interface BackendInsightDto {
  type: string;
  severity: string;
  message: string;
  recommendation: string;
}

export type InsightType =
  | 'CONCENTRATION_RISK'
  | 'ASSET_TILT'
  | 'EMERGENCY_FUND'
  | 'TAX_HARVESTING'
  | 'GOAL_BEHIND'
  | 'PORTFOLIO_DIVERSIFICATION';

export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface SmartInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendation: string;
  metric?: string | undefined;
}

export interface MinimalGoal {
  name: string;
  category: string;
  targetAmount: number;
  targetDate: string;
  allocatedPercentage?: number | undefined;
  metrics?: { status: string; requiredMonthlySip?: number } | undefined;
}

export interface SmartInsightsOptions {
  totalNetWorth?: number | undefined;
  harvestSummary?: { harvestableGain?: number } | undefined;
}

function checkConcentrationRisk(
  holdings: EnrichedHolding[],
  netWorth: number,
): SmartInsight | null {
  if (holdings.length === 0 || netWorth <= 0) return null;

  const sorted = [...holdings].sort((a, b) => b.current_value - a.current_value);
  const top3 = sorted.slice(0, 3);
  const top3Sum = top3.reduce((sum, h) => sum + h.current_value, 0);
  const share = top3Sum / netWorth;

  if (share > 0.50) {
    const pct = Math.round(share * 1000) / 10;
    return {
      id: 'insight-concentration-risk',
      type: 'CONCENTRATION_RISK',
      severity: 'HIGH',
      title: 'High Concentration Risk',
      message: `Top 3 holdings account for ${pct.toFixed(1)}% of total portfolio value.`,
      recommendation:
        'Consider rebalancing into diversified multi-cap or index funds to reduce single-scheme downside exposure.',
      metric: `${pct.toFixed(1)}% in Top 3`,
    };
  }
  return null;
}

function checkAssetTilt(
  holdings: EnrichedHolding[],
  netWorth: number,
): SmartInsight | null {
  if (holdings.length === 0 || netWorth <= 0) return null;

  const equityHoldings = holdings.filter((h) => h.asset_class.toUpperCase() === 'EQUITY');
  const equitySum = equityHoldings.reduce((sum, h) => sum + h.current_value, 0);
  const equityShare = equitySum / netWorth;

  if (equityShare > 0.80) {
    const pct = Math.round(equityShare * 1000) / 10;
    return {
      id: 'insight-equity-tilt',
      type: 'ASSET_TILT',
      severity: 'MEDIUM',
      title: 'Aggressive Equity Tilt',
      message: `Equity constitutes ${pct.toFixed(1)}% of your portfolio.`,
      recommendation:
        'Maintain an adequate liquid or fixed-income buffer to withstand short-term market volatility.',
      metric: `${pct.toFixed(1)}% Equity`,
    };
  }

  const debtLiquidHoldings = holdings.filter((h) => {
    const cls = h.asset_class.toUpperCase();
    return cls === 'DEBT' || cls === 'LIQUID';
  });
  const debtSum = debtLiquidHoldings.reduce((sum, h) => sum + h.current_value, 0);
  if (debtSum / netWorth < 0.05) {
    return {
      id: 'insight-low-debt',
      type: 'ASSET_TILT',
      severity: 'MEDIUM',
      title: 'Zero Debt / Liquid Allocation',
      message: 'Less than 5% allocated to debt or liquid funds.',
      recommendation: 'Add liquid or short-duration funds for capital preservation.',
      metric: 'Low Buffer',
    };
  }

  return null;
}

function checkEmergencyFund(
  holdings: EnrichedHolding[],
  goals: MinimalGoal[],
): SmartInsight | null {
  const liquid = holdings.filter((h) => {
    const cls = h.asset_class.toUpperCase();
    return cls === 'DEBT' || cls === 'LIQUID';
  });
  const totalLiquid = liquid.reduce((sum, h) => sum + h.current_value, 0);
  const emergencyGoal = goals.find((g) => g.category === 'Emergency Fund');

  if (!emergencyGoal || totalLiquid < 300000) {
    return {
      id: 'insight-emergency-buffer',
      type: 'EMERGENCY_FUND',
      severity: 'HIGH',
      title: 'Emergency Reserve Check',
      message: 'Your liquid emergency reserve is below recommended 6-month buffer.',
      recommendation:
        'Ensure at least 3-6 months of living expenses are maintained in liquid or overnight instruments.',
      metric: `Liquid: ₹${Math.round(totalLiquid).toLocaleString('en-IN')}`,
    };
  }
  return null;
}

function checkTaxHarvesting(
  harvestSummary?: { harvestableGain?: number },
): SmartInsight | null {
  const gain = harvestSummary?.harvestableGain ?? 0;
  if (gain > 0) {
    return {
      id: 'insight-tax-harvesting',
      type: 'TAX_HARVESTING',
      severity: 'LOW',
      title: 'Tax Harvesting Opportunity',
      message:
        'Section 112A permits up to ₹1.25 Lakh of tax-free LTCG each financial year before March 31.',
      recommendation:
        'Harvest unrealized long-term capital gains up to ₹1,25,000 at zero tax liability and reinvest immediately.',
      metric: '₹1.25L Exemption',
    };
  }
  return null;
}

function checkGoalsBehind(
  goals: MinimalGoal[],
  holdings: EnrichedHolding[],
  netWorth: number,
): SmartInsight | null {
  for (const g of goals) {
    const isBehind = g.metrics?.status === 'Behind' || (
      g.allocatedPercentage !== undefined &&
      g.targetAmount > 0 &&
      (netWorth * (g.allocatedPercentage / 100)) / g.targetAmount < 0.20 &&
      (() => {
        const target = new Date(g.targetDate);
        const monthsRemaining = (target.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
        return !Number.isNaN(monthsRemaining) && monthsRemaining <= 12;
      })()
    );

    if (isBehind) {
      return {
        id: `insight-goal-behind-${g.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'GOAL_BEHIND',
        severity: 'HIGH',
        title: 'Goal Behind Schedule',
        message: `"${g.name}" is falling behind its planned accumulation target.`,
        recommendation:
          'Consider stepping up monthly SIP contributions or extending target horizon.',
        metric: 'Behind Target',
      };
    }
  }
  return null;
}

/**
 * Generates automated risk assessments and smart portfolio insights.
 *
 * @param holdings - List of enriched user holdings
 * @param goals - User financial goals
 * @param netWorthOrOptions - Net worth number or options container
 * @returns Array of synthesized smart insights
 */
export function generateSmartInsights(
  holdings: EnrichedHolding[],
  goals: MinimalGoal[],
  netWorthOrOptions?: number | SmartInsightsOptions,
): SmartInsight[] {
  const netWorth = typeof netWorthOrOptions === 'number'
    ? netWorthOrOptions
    : (netWorthOrOptions?.totalNetWorth ?? holdings.reduce((s, h) => s + h.current_value, 0));
  const options = typeof netWorthOrOptions === 'object' ? netWorthOrOptions : undefined;

  const results: (SmartInsight | null)[] = [
    checkConcentrationRisk(holdings, netWorth),
    checkAssetTilt(holdings, netWorth),
    checkEmergencyFund(holdings, goals),
    checkTaxHarvesting(options?.harvestSummary),
    checkGoalsBehind(goals, holdings, netWorth),
  ];

  const activeInsights = results.filter((i): i is SmartInsight => i !== null);
  if (activeInsights.length === 0) {
    activeInsights.push({
      id: 'insight-diversification',
      type: 'PORTFOLIO_DIVERSIFICATION',
      severity: 'INFO',
      title: 'Balanced Allocation',
      message: 'Your asset allocation and portfolio concentration meet prudent balance standards.',
      recommendation: 'Continue regular systematic investment plan contributions without disruption.',
      metric: 'Healthy Health Score',
    });
  }

  return activeInsights;
}

function getInsightsCacheKey(portfolioId: string): string {
  return `PORTFOLIO_INSIGHTS_${portfolioId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function mapInsightType(rawType: string): InsightType {
  const upper = rawType.toUpperCase();
  if (upper === 'CONCENTRATION' || upper === 'OVERLAP') return 'CONCENTRATION_RISK';
  if (upper === 'ASSET_TILT') return 'ASSET_TILT';
  if (upper === 'EMERGENCY_FUND') return 'EMERGENCY_FUND';
  if (upper === 'TAX_HARVESTING') return 'TAX_HARVESTING';
  if (upper === 'GOAL_BEHIND') return 'GOAL_BEHIND';
  return 'PORTFOLIO_DIVERSIFICATION';
}

function mapInsightTitle(rawType: string): string {
  const upper = rawType.toUpperCase();
  if (upper === 'CONCENTRATION') return 'Sector Concentration Risk';
  if (upper === 'OVERLAP') return 'Stock Overlap Risk';
  if (upper === 'INFO') return 'Balanced Allocation';
  return 'Portfolio Insight';
}

function mapInsightSeverity(raw: string): InsightSeverity {
  const upper = raw.toUpperCase();
  if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW' || upper === 'INFO') {
    return upper;
  }
  return 'INFO';
}

/**
 * Maps backend `InsightDto[]` from `/api/health/:portfolioId/insights` into {@link SmartInsight} cards.
 */
export function mapBackendInsightsToSmartInsights(dtos: BackendInsightDto[]): SmartInsight[] {
  return dtos.map((dto, idx) => ({
    id: `server-insight-${idx}-${dto.type.toLowerCase()}`,
    type: mapInsightType(dto.type),
    severity: mapInsightSeverity(dto.severity),
    title: mapInsightTitle(dto.type),
    message: dto.message,
    recommendation: dto.recommendation,
  }));
}

/**
 * Reads cached server insights from hardware secure storage for offline fallback.
 */
export async function getCachedInsightsForScope(
  portfolioId: string = 'consolidated',
): Promise<SmartInsight[] | null> {
  try {
    const raw = await SecureStore.getItemAsync(getInsightsCacheKey(portfolioId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as SmartInsight[]) : null;
  } catch {
    return null;
  }
}

/**
 * Fetches smart insights from `/api/health/:portfolioId/insights`, caches them locally,
 * and falls back to cached insights when offline (returns `null` if no cache exists).
 */
export async function fetchInsightsForScope(
  portfolioId: string = 'consolidated',
): Promise<SmartInsight[] | null> {
  try {
    const creds = await getStoredCredentials();
    if (!creds.serverUrl || !creds.token) {
      return getCachedInsightsForScope(portfolioId);
    }
    const base = creds.serverUrl.trim().replace(/\/+$/, '');
    const res = await fetch(`${base}/api/health/${encodeURIComponent(portfolioId)}/insights`, {
      headers: { Authorization: `Bearer ${creds.token}`, Accept: 'application/json' },
    });
    if (!res.ok) return getCachedInsightsForScope(portfolioId);
    const data = (await res.json()) as BackendInsightDto[];
    if (!Array.isArray(data)) return getCachedInsightsForScope(portfolioId);
    const mapped = mapBackendInsightsToSmartInsights(data);
    await SecureStore.setItemAsync(getInsightsCacheKey(portfolioId), JSON.stringify(mapped));
    return mapped;
  } catch {
    return getCachedInsightsForScope(portfolioId);
  }
}
