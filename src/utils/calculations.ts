import {
  GlobalSettings,
  Fund,
  Debt,
  CustomMilestone,
  YearBreakdown,
  ProjectionResult,
  Milestone,
  MILESTONE_THRESHOLDS,
} from '../types';
import { formatCompact } from './formatters';

export function computeProjection(
  global: GlobalSettings,
  funds: Fund[],
  customMilestones: CustomMilestone[] = [],
  debts: Debt[] = [],
): ProjectionResult {
  const g = global;

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

  // per-debt running balances
  const debtBal: Record<string, number> = {};
  for (const d of debts) debtBal[d.id] = d.principal;
  const initialDebtBalance = debts.reduce((s, d) => s + d.principal, 0);

  let cumulativeContributions = 0;
  let cumulativeInterest = 0;
  let cumulativeDebtPayments = 0;
  let cumulativeDebtInterest = 0;
  let totalIncome = 0;
  let contributionExceedsIncomeYear: number | null = null;
  let debtFreeYear: number | null = null;

  // Year 0: starting state before any contributions or growth
  const year0FundBalances: Record<string, number> = {};
  const year0FundContributions: Record<string, number> = {};
  const year0FundInterest: Record<string, number> = {};
  for (const f of funds) {
    year0FundBalances[f.id] = f.startingBalance;
    year0FundContributions[f.id] = 0;
    year0FundInterest[f.id] = 0;
  }
  const year0DebtBalances: Record<string, number> = {};
  const year0DebtPayments: Record<string, number> = {};
  const year0DebtInterest: Record<string, number> = {};
  for (const d of debts) {
    year0DebtBalances[d.id] = d.principal;
    year0DebtPayments[d.id] = 0;
    year0DebtInterest[d.id] = 0;
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
    totalDebtPayment: 0,
    totalDebtInterest: 0,
    debtBalance: initialDebtBalance,
    netWorth: totalStartingBalance - initialDebtBalance,
    debtBalances: year0DebtBalances,
    debtPayments: year0DebtPayments,
    debtInterestPaid: year0DebtInterest,
    cumulativeDebtPayments: 0,
    cumulativeDebtInterest: 0,
  });

  for (let y = 1; y <= totalYears; y++) {
    const startBalance = funds.reduce((s, f) => s + (bal[f.id] || 0), 0);
    let yearContribution = 0;
    let yearInterest = 0;
    const fundContributions: Record<string, number> = {};
    const fundInterest: Record<string, number> = {};

    // income for this year (for %-of-income contributions)
    const incomeThisYear = g.income * Math.pow(1 + g.incomeGrowthRate / 100, y - 1);
    if (g.income > 0) totalIncome += incomeThisYear;

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

    // --- Debt amortization ---
    let yearDebtPayment = 0;
    let yearDebtInterest = 0;
    const debtPayments: Record<string, number> = {};
    const debtInterestPaid: Record<string, number> = {};

    for (const debt of debts) {
      let balance = debtBal[debt.id] || 0;
      if (balance <= 0) {
        debtPayments[debt.id] = 0;
        debtInterestPaid[debt.id] = 0;
        continue;
      }

      // Compute this debt's annual payment with growth
      // Resolve minimum payment
      let annualMin: number;
      if (debt.minimumPaymentType === 'percent_of_income') {
        annualMin = (debt.minimumPayment / 100) * incomeThisYear;
      } else {
        annualMin = debt.paymentFrequency === 'monthly'
          ? debt.minimumPayment * 12
          : debt.minimumPayment;
      }

      // Resolve extra payment
      let annualExtra: number;
      if (debt.extraPaymentType === 'percent_of_income') {
        annualExtra = (debt.extraPayment / 100) * incomeThisYear;
      } else {
        annualExtra = debt.paymentFrequency === 'monthly'
          ? debt.extraPayment * 12
          : debt.extraPayment;
      }

      const baseMonthlyPayment = (annualMin + annualExtra) / 12;
      const interval = Math.max(1, debt.paymentGrowthInterval || 1);
      const increments = Math.floor((y - 1) / interval);
      let monthlyPayment: number;
      if (debt.paymentGrowthType === 'fixed') {
        monthlyPayment = baseMonthlyPayment + debt.paymentGrowthRate * increments;
      } else {
        monthlyPayment = baseMonthlyPayment * Math.pow(1 + debt.paymentGrowthRate / 100, increments);
      }

      const monthlyRate = debt.interestRate / 100 / 12;
      let debtInt = 0;
      let debtPay = 0;

      for (let m = 0; m < 12; m++) {
        if (balance <= 0) break;
        const interest = balance * monthlyRate;
        debtInt += interest;
        balance += interest;
        const payment = Math.min(monthlyPayment, balance);
        debtPay += payment;
        balance -= payment;
        if (balance < 0.01) balance = 0; // clean up floating point
      }

      debtBal[debt.id] = balance;
      debtPayments[debt.id] = debtPay;
      debtInterestPaid[debt.id] = debtInt;
      yearDebtPayment += debtPay;
      yearDebtInterest += debtInt;
    }

    cumulativeDebtPayments += yearDebtPayment;
    cumulativeDebtInterest += yearDebtInterest;

    const totalDebtRemaining = debts.reduce((s, d) => s + (debtBal[d.id] || 0), 0);

    // Detect debt-free year
    if (debtFreeYear === null && debts.length > 0 && initialDebtBalance > 0 && totalDebtRemaining <= 0) {
      debtFreeYear = y;
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
      totalDebtPayment: yearDebtPayment,
      totalDebtInterest: yearDebtInterest,
      debtBalance: totalDebtRemaining,
      netWorth: endBalance - totalDebtRemaining,
      debtBalances: { ...debtBal },
      debtPayments,
      debtInterestPaid,
      cumulativeDebtPayments,
      cumulativeDebtInterest,
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
  const finalDebtBalance = schedule.length > 0 ? schedule[schedule.length - 1].debtBalance : initialDebtBalance;

  const totalInvested = totalStartingBalance + cumulativeContributions;
  const effectiveCAGR =
    totalInvested > 0 && totalYears > 0
      ? (Math.pow(finalBalance / Math.max(totalInvested, 1), 1 / totalYears) - 1) * 100
      : 0;
  const realCAGR =
    totalInvested > 0 && totalYears > 0
      ? (Math.pow(finalRealBalance / Math.max(totalInvested, 1), 1 / totalYears) - 1) * 100
      : 0;

  const averageReturn = funds.reduce((s, f) => s + f.returnRate, 0) / (funds.length || 1);
  const doublingTimeYears = averageReturn > 0 ? 72 / averageReturn : Infinity;
  const realDoublingTimeYears = (averageReturn - g.inflationRate) > 0 ? 72 / (averageReturn - g.inflationRate) : Infinity;

  return {
    schedule,
    totalContributed: cumulativeContributions,
    totalIncome,
    totalInterest: cumulativeInterest,
    totalStartingBalance,
    finalBalance,
    finalRealBalance,
    effectiveCAGR,
    realCAGR,
    doublingTimeYears,
    realDoublingTimeYears,
    milestones,
    contributionExceedsIncomeYear,
    totalDebtInterestPaid: cumulativeDebtInterest,
    totalDebtPayments: cumulativeDebtPayments,
    initialDebtBalance,
    remainingDebt: finalDebtBalance,
    debtFreeYear,
    netWorth: finalBalance - finalDebtBalance,
  };
}
