import {
  AppState,
  YearBreakdown,
  ProjectionResult,
  Milestone,
  MILESTONE_THRESHOLDS,
} from '../types';
import { formatCompact } from './formatters';

export function computeProjection(state: AppState): ProjectionResult {
  const { global: g, funds, customMilestones = [] } = state;

  const totalYears =
    g.timelineMode === 'retirement'
      ? Math.max(1, g.retirementAge - g.currentAge)
      : Math.max(1, g.years);

  const schedule: YearBreakdown[] = [];
  const milestones: Milestone[] = [];
  const milestoneSet = new Set<number>();

  // Combine built-in and custom thresholds
  const allThresholds = [
    ...MILESTONE_THRESHOLDS.map((t) => ({ amount: t, label: formatCompact(t), icon: undefined as string | undefined, custom: false, customMilestoneId: undefined as string | undefined })),
    ...customMilestones.map((cm) => ({ amount: cm.amount, label: cm.name, icon: cm.icon, custom: true, customMilestoneId: cm.id })),
  ].sort((a, b) => a.amount - b.amount);

  const totalStartingBalance = funds.reduce((s, f) => s + f.startingBalance, 0);

  // pre-mark milestones already achieved by starting balance
  for (const t of allThresholds) {
    if (totalStartingBalance >= t.amount) {
      milestoneSet.add(t.amount);
    }
  }

  // per-fund running balances
  const bal: Record<string, number> = {};
  for (const f of funds) bal[f.id] = f.startingBalance;

  let cumulativeContributions = 0;
  let cumulativeInterest = 0;
  let contributionExceedsIncomeYear: number | null = null;

  // Year 0: starting state before any contributions or growth
  const year0FundBalances: Record<string, number> = {};
  const year0FundContributions: Record<string, number> = {};
  const year0FundInterest: Record<string, number> = {};
  for (const f of funds) {
    year0FundBalances[f.id] = f.startingBalance;
    year0FundContributions[f.id] = 0;
    year0FundInterest[f.id] = 0;
  }
  schedule.push({
    year: 0,
    age: g.timelineMode === 'retirement' ? g.currentAge : null,
    startBalance: totalStartingBalance,
    totalContribution: 0,
    totalInterest: 0,
    endBalance: totalStartingBalance,
    cumulativeContributions: 0,
    cumulativeInterest: 0,
    cumulativeStartingBalance: totalStartingBalance,
    fundBalances: year0FundBalances,
    fundContributions: year0FundContributions,
    fundInterest: year0FundInterest,
    realEndBalance: totalStartingBalance,
    pctStartingBalance: 100,
    pctContributions: 0,
    pctInterest: 0,
  });

  for (let y = 1; y <= totalYears; y++) {
    const startBalance = funds.reduce((s, f) => s + (bal[f.id] || 0), 0);
    let yearContribution = 0;
    let yearInterest = 0;
    const fundContributions: Record<string, number> = {};
    const fundInterest: Record<string, number> = {};

    // income for this year (for %-of-income contributions)
    const incomeThisYear = g.income * Math.pow(1 + g.incomeGrowthRate / 100, y - 1);

    for (const fund of funds) {
      // compute this fund's annual contribution
      let annualContrib: number;
      if (fund.contributionType === 'percent_of_income') {
        // contribution field is a % of income
        annualContrib = (fund.contribution / 100) * incomeThisYear;
      } else {
        const baseAnnual =
          fund.contributionFrequency === 'monthly'
            ? fund.contribution * 12
            : fund.contribution;
        const interval = Math.max(1, fund.contributionGrowthInterval || 1);
        const increments = Math.floor((y - 1) / interval);
        if (fund.contributionGrowthType === 'fixed') {
          // fixed dollar increase every N years
          const annualIncrease =
            fund.contributionFrequency === 'monthly'
              ? fund.contributionGrowthRate * 12
              : fund.contributionGrowthRate;
          annualContrib = baseAnnual + annualIncrease * increments;
        } else {
          // percentage increase every N years
          const growthMult = Math.pow(1 + fund.contributionGrowthRate / 100, increments);
          annualContrib = baseAnnual * growthMult;
        }
      }

      const monthlyRate = fund.returnRate / 100 / 12;
      let balance = bal[fund.id] || 0;
      let fundInt = 0;

      if (fund.contributionFrequency === 'monthly' || fund.contributionType === 'percent_of_income') {
        const monthlyContrib = annualContrib / 12;
        for (let m = 0; m < 12; m++) {
          const interest = balance * monthlyRate;
          fundInt += interest;
          balance += interest + monthlyContrib;
        }
      } else {
        balance += annualContrib;
        for (let m = 0; m < 12; m++) {
          const interest = balance * monthlyRate;
          fundInt += interest;
          balance += interest;
        }
      }

      bal[fund.id] = balance;
      fundContributions[fund.id] = annualContrib;
      fundInterest[fund.id] = fundInt;
      yearContribution += annualContrib;
      yearInterest += fundInt;
    }

    cumulativeContributions += yearContribution;
    cumulativeInterest += yearInterest;

    // Check if total contributions exceed income this year
    if (contributionExceedsIncomeYear === null && g.income > 0 && yearContribution > incomeThisYear) {
      contributionExceedsIncomeYear = y;
    }

    const endBalance = funds.reduce((s, f) => s + (bal[f.id] || 0), 0);
    const inflationFactor = Math.pow(1 + g.inflationRate / 100, y);

    const pctTotal = endBalance > 0 ? 100 / endBalance : 0;

    const row: YearBreakdown = {
      year: y,
      age: g.timelineMode === 'retirement' ? g.currentAge + y : null,
      startBalance,
      totalContribution: yearContribution,
      totalInterest: yearInterest,
      endBalance,
      cumulativeContributions,
      cumulativeInterest,
      cumulativeStartingBalance: totalStartingBalance,
      fundBalances: { ...bal },
      fundContributions,
      fundInterest,
      realEndBalance: endBalance / inflationFactor,
      pctStartingBalance: totalStartingBalance * pctTotal,
      pctContributions: cumulativeContributions * pctTotal,
      pctInterest: cumulativeInterest * pctTotal,
    };

    schedule.push(row);

    for (const t of allThresholds) {
      if (!milestoneSet.has(t.amount) && endBalance >= t.amount) {
        milestoneSet.add(t.amount);
        milestones.push({
          amount: t.amount,
          year: y,
          label: t.label,
          icon: t.icon,
          custom: t.custom,
          customMilestoneId: t.customMilestoneId,
        });
      }
    }
  }

  const finalBalance = schedule.length > 0 ? schedule[schedule.length - 1].endBalance : totalStartingBalance;
  const finalRealBalance = schedule.length > 0 ? schedule[schedule.length - 1].realEndBalance : totalStartingBalance;
  const totalInvested = totalStartingBalance + cumulativeContributions;
  const effectiveCAGR =
    totalInvested > 0 && totalYears > 0
      ? (Math.pow(finalBalance / Math.max(totalInvested, 1), 1 / totalYears) - 1) * 100
      : 0;

  const weightedReturn = funds.reduce((s, f) => s + f.returnRate, 0) / (funds.length || 1);
  const doublingTimeYears = weightedReturn > 0 ? 72 / weightedReturn : Infinity;

  return {
    schedule,
    totalContributed: cumulativeContributions,
    totalInterest: cumulativeInterest,
    totalStartingBalance,
    finalBalance,
    finalRealBalance,
    effectiveCAGR,
    doublingTimeYears,
    milestones,
    contributionExceedsIncomeYear,
  };
}


