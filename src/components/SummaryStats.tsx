import { ProjectionResult, Milestone } from '../types';
import { formatCurrency, formatPercent, formatYears } from '../utils/formatters';

interface SummaryStatsProps {
  result: ProjectionResult;
  showReal: boolean;
}

export default function SummaryStats({ result, showReal }: SummaryStatsProps) {
  const { finalBalance, finalRealBalance, totalContributed, totalInterest, totalStartingBalance, effectiveCAGR, doublingTimeYears, milestones, schedule, contributionExceedsIncomeYear } = result;
  const displayBalance = showReal ? finalRealBalance : finalBalance;
  const totalYears = schedule.length > 0 ? schedule.length - 1 : 0;

  return (
    <div className="space-y-3">
      {/* Main stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card items-center text-center">
          <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Final Balance</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(displayBalance)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500">after {totalYears} {totalYears === 1 ? 'year' : 'years'}</span>
          {showReal && <span className="text-[10px] text-red-500/80 dark:text-red-400/70">in today's dollars</span>}
        </div>
        <div className="stat-card items-center text-center">
          <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Total Invested</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalStartingBalance + totalContributed)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500">${totalStartingBalance.toLocaleString()} start + ${totalContributed.toLocaleString()} contrib.</span>
        </div>
        <div className="stat-card items-center text-center">
          <span className="text-[11px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Interest Earned</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalInterest)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatPercent(finalBalance > 0 ? (totalInterest / finalBalance) * 100 : 0)} of total</span>
        </div>
        <div className="stat-card items-center text-center group relative">
          <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Growth</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatPercent(effectiveCAGR)} CAGR</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500">Doubles in ~{formatYears(doublingTimeYears)}</span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left">
            CAGR (Compound Annual Growth Rate) is the average annual rate of return that would take your total invested amount to the final balance over the given period.
          </div>
        </div>
      </div>

      {/* Warnings */}
      {contributionExceedsIncomeYear !== null && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span className="mt-0.5">⚠️</span>
          <span>Total contributions exceed income starting in year {contributionExceedsIncomeYear}. Consider adjusting contribution amounts or growth rates.</span>
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {milestones.map((m, i) => (
            <MilestoneBadge key={m.amount} milestone={m} chevronCount={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronStack({ count }: { count: number }) {
  const clamped = Math.min(count, 7);
  const h = 6 + clamped * 5;
  return (
    <svg width="14" height={h} viewBox={`0 0 14 ${h}`} fill="none" className="flex-shrink-0">
      {Array.from({ length: clamped }).map((_, i) => (
        <polyline
          key={i}
          points={`2,${h - i * 5 - 2} 7,${h - i * 5 - 7} 12,${h - i * 5 - 2}`}
          stroke="#fbbf24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}

function MilestoneBadge({ milestone, chevronCount }: { milestone: Milestone; chevronCount: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700/50 rounded-lg px-2.5 py-1.5">
      <ChevronStack count={chevronCount} />
      <span className="text-xs font-medium text-slate-700 dark:text-neutral-300">{milestone.label}</span>
      <span className="text-[10px] text-slate-400 dark:text-neutral-500">yr {milestone.year}</span>
    </div>
  );
}
