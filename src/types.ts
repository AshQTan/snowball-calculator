export interface Fund {
  id: string;
  name: string;
  color: string;
  startingBalance: number;
  contribution: number;
  contributionType: 'fixed' | 'percent_of_income';
  contributionFrequency: ContributionFrequency;
  contributionGrowthRate: number;
  contributionGrowthType: 'percent' | 'fixed';
  contributionGrowthInterval: number;
  returnRate: number;
}

export type ContributionFrequency = 'monthly' | 'annually';
export type TimelineMode = 'years' | 'retirement';
export type ChartMode = 'line' | 'bar';

export interface GlobalSettings {
  timelineMode: TimelineMode;
  years: number;
  currentAge: number;
  retirementAge: number;
  inflationRate: number;
  showReal: boolean;
  income: number;
  incomeGrowthRate: number;
}

export interface Strategy {
  id: string;
  name: string;
  color: string;
  funds: Fund[];
}

export interface AppState {
  global: GlobalSettings;
  strategies: Strategy[];
  activeStrategyId: string;
  chartMode: ChartMode;
  customMilestones: CustomMilestone[];
}

export interface YearBreakdown {
  year: number;
  age: number | null;
  startBalance: number;
  totalContribution: number;
  totalInterest: number;
  endBalance: number;
  cumulativeContributions: number;
  cumulativeInterest: number;
  cumulativeStartingBalance: number;
  fundBalances: Record<string, number>;
  fundContributions: Record<string, number>;
  fundInterest: Record<string, number>;
  realEndBalance: number;
  pctStartingBalance: number;
  pctContributions: number;
  pctInterest: number;
}

export interface ProjectionResult {
  schedule: YearBreakdown[];
  totalContributed: number;
  totalIncome: number;
  totalInterest: number;
  totalStartingBalance: number;
  finalBalance: number;
  finalRealBalance: number;
  effectiveCAGR: number;
  realCAGR: number;
  doublingTimeYears: number;
  realDoublingTimeYears: number;
  milestones: Milestone[];
  contributionExceedsIncomeYear: number | null;
}

export interface Milestone {
  amount: number;
  year: number;
  label: string;
  icon?: string;
  custom?: boolean;
  customMilestoneId?: string;
}

export interface CustomMilestone {
  id: string;
  name: string;
  amount: number;
  icon: string;
}

export const MILESTONE_ICONS = [
  '🎯', '🏆', '🚀', '💎',
  '🌟', '🔥', '🏠', '🚗',
  '✈️', '🎓', '💰', '🏦',
  '🎉', '⭐', '🛡️', '👑',
];

// First 6 are shown in the fund color picker; the rest are reserved for
// auto-assignment when creating new strategies so fund colors stay distinct.
export const FUND_COLORS = [
  '#7dd3fc', '#fca5a5', '#99f6e4', '#fdba74', '#c4b5fd', '#f9a8d4',
  '#86efac', '#fde68a', '#f0abfc', '#a5b4fc', '#bef264', '#67e8f9',
];
export const FUND_PICKER_COUNT = 6;

export const STRATEGY_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
];

export const MAX_STRATEGIES = 5;

export const PRESET_RETURNS: { label: string; rate: number }[] = [
  { label: 'Conservative', rate: 5 },
  { label: 'Moderate', rate: 7 },
  { label: 'Aggressive', rate: 10 },
  { label: 'S&P 500 Hist.', rate: 10.5 },
];

export const MILESTONE_THRESHOLDS = [
  10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
];

export function createFund(index: number): Fund {
  const isInitial = index === 0;
  return {
    id: crypto.randomUUID(),
    name: isInitial ? 'Portfolio' : `Fund ${index + 1}`,
    color: FUND_COLORS[index % FUND_COLORS.length],
    startingBalance: 0,
    contribution: isInitial ? 100 : 0,
    contributionType: 'fixed',
    contributionFrequency: 'monthly',
    contributionGrowthRate: 0,
    contributionGrowthType: 'fixed',
    contributionGrowthInterval: 1,
    returnRate: isInitial ? 7 : 0,
  };
}

export function createStrategy(name: string, color: string, funds: Fund[]): Strategy {
  return {
    id: crypto.randomUUID(),
    name,
    color,
    funds,
  };
}

export function getDefaultState(): AppState {
  const fund = createFund(0);
  fund.startingBalance = 1000;
  const strategy = createStrategy('Strategy 1', STRATEGY_COLORS[0], [fund]);
  return {
    global: {
      timelineMode: 'years',
      years: 10,
      currentAge: 25,
      retirementAge: 65,
      inflationRate: 3,
      showReal: false,
      income: 50000,
      incomeGrowthRate: 3,
    },
    strategies: [strategy],
    activeStrategyId: strategy.id,
    chartMode: 'line',
    customMilestones: [],
  };
}
