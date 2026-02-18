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

export interface Debt {
  id: string;
  name: string;
  color: string;
  principal: number;
  interestRate: number;
  minimumPayment: number;
  minimumPaymentType: 'fixed' | 'percent_of_income';
  extraPayment: number;
  extraPaymentType: 'fixed' | 'percent_of_income';
  paymentFrequency: ContributionFrequency;
  paymentGrowthRate: number;
  paymentGrowthType: 'percent' | 'fixed';
  paymentGrowthInterval: number;
}

export type ContributionFrequency = 'monthly' | 'annually';
export type TimelineMode = 'years' | 'retirement';
export type ChartMode = 'line' | 'bar';
export type ChartViewMode = 'assets' | 'networth';

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
  debts: Debt[];
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
  // Debt fields
  totalDebtPayment: number;
  totalDebtInterest: number;
  debtBalance: number;
  netWorth: number;
  debtBalances: Record<string, number>;
  debtPayments: Record<string, number>;
  debtInterestPaid: Record<string, number>;
  cumulativeDebtPayments: number;
  cumulativeDebtInterest: number;
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
  milestonesNetWorth: Milestone[];
  contributionExceedsIncomeYear: number | null;
  // Debt stats
  totalDebtInterestPaid: number;
  totalDebtPayments: number;
  initialDebtBalance: number;
  remainingDebt: number;
  debtFreeYear: number | null;
  netWorth: number;
  positiveNetWorthYear: number | null;
}

export interface Milestone {
  amount: number;
  year: number;
  label: string;
  icon?: string;
  custom?: boolean;
  customMilestoneId?: string;
  color?: string;
  inverted?: boolean;
  chevronCount?: number;
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

export const DEBT_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a78bfa', '#f472b6', '#38bdf8',
];
export const DEBT_PICKER_COUNT = 6;

export const DEBT_APR_PRESETS: { label: string; rate: number }[] = [
  { label: 'Student Loan', rate: 5 },
  { label: 'Auto Loan', rate: 6 },
  { label: 'Mortgage', rate: 7 },
  { label: 'Credit Card', rate: 22 },
];

export const STRATEGY_COLORS = [
  '#0ea5e9', '#ef4444', '#86c232', '#8b5cf6', '#ec4899',
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

export function createDebt(index: number): Debt {
  return {
    id: crypto.randomUUID(),
    name: `Debt ${index + 1}`,
    color: DEBT_COLORS[index % DEBT_COLORS.length],
    principal: 0,
    interestRate: 7,
    minimumPayment: 0,
    minimumPaymentType: 'fixed',
    extraPayment: 0,
    extraPaymentType: 'fixed',
    paymentFrequency: 'monthly',
    paymentGrowthRate: 0,
    paymentGrowthType: 'fixed',
    paymentGrowthInterval: 1,
  };
}

export function createStrategy(name: string, color: string, funds: Fund[], debts: Debt[] = []): Strategy {
  return {
    id: crypto.randomUUID(),
    name,
    color,
    funds,
    debts,
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
