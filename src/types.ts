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

export interface AppState {
  global: GlobalSettings;
  funds: Fund[];
  chartMode: ChartMode;
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
  totalInterest: number;
  totalStartingBalance: number;
  finalBalance: number;
  finalRealBalance: number;
  effectiveCAGR: number;
  doublingTimeYears: number;
  milestones: Milestone[];
}

export interface Milestone {
  amount: number;
  year: number;
  label: string;
}

export const FUND_COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#f87171',
];

export const PRESET_RETURNS: { label: string; rate: number }[] = [
  { label: 'Conservative', rate: 5 },
  { label: 'Moderate', rate: 7 },
  { label: 'Aggressive', rate: 10 },
  { label: 'S&P 500 Hist.', rate: 10.5 },
];

export const MILESTONE_THRESHOLDS = [
  100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
];

export function createFund(index: number): Fund {
  return {
    id: crypto.randomUUID(),
    name: index === 0 ? 'Portfolio' : `Fund ${index + 1}`,
    color: FUND_COLORS[index % FUND_COLORS.length],
    startingBalance: 0,
    contribution: 100,
    contributionType: 'fixed',
    contributionFrequency: 'monthly',
    contributionGrowthRate: 0,
    contributionGrowthType: 'fixed',
    contributionGrowthInterval: 1,
    returnRate: 7,
  };
}

export function getDefaultState(): AppState {
  const fund = createFund(0);
  fund.startingBalance = 1000;
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
    funds: [fund],
    chartMode: 'line',
  };
}
