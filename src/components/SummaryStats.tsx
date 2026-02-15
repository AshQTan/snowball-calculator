import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProjectionResult, Milestone, Strategy } from '../types';
import { formatCurrency, formatCompact, formatPercent, formatYears } from '../utils/formatters';

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, below: false });
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const below = spaceAbove < 120;
      setPos({
        x: rect.left + rect.width / 2,
        y: below ? rect.bottom + 8 : rect.top - 8,
        below,
      });
      setShow(true);
    }
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      className="stat-card items-center text-center cursor-help"
    >
      {children}
      {show && createPortal(
        <div
          className="fixed z-[9999] w-56 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed shadow-xl text-left font-normal normal-case tracking-normal pointer-events-none"
          style={{
            top: pos.y,
            left: pos.x,
            transform: pos.below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}

interface SummaryStatsProps {
  result: ProjectionResult;
  showReal: boolean;
  strategies?: Strategy[];
  activeStrategyId?: string;
  allResults?: Map<string, ProjectionResult>;
  onSwitchStrategy?: (id: string) => void;
}

export default function SummaryStats({ result, showReal, strategies, activeStrategyId, allResults, onSwitchStrategy }: SummaryStatsProps) {
  const { finalBalance, finalRealBalance, totalContributed, totalIncome, totalInterest, totalStartingBalance, effectiveCAGR, realCAGR, doublingTimeYears, realDoublingTimeYears, schedule, contributionExceedsIncomeYear } = result;
  const displayBalance = showReal ? finalRealBalance : finalBalance;
  const totalYears = schedule.length > 0 ? schedule.length - 1 : 0;

  return (
    <div className="space-y-3">
      {/* Main stats */}
      {strategies && strategies.length > 1 && allResults ? (
        (() => {
          // Build ordered list of strategies by final balance (display currency based on showReal)
          const items = strategies.map((s) => {
            const r = allResults.get(s.id);
            const final = r ? (showReal ? r.finalRealBalance : r.finalBalance) : 0;
            const invested = r ? (r.totalStartingBalance + r.totalContributed) : 0;
            const interest = r ? r.totalInterest : 0;
            const cagr = r ? (showReal ? r.realCAGR : r.effectiveCAGR) : 0;
            const years = r ? (r.schedule.length > 0 ? r.schedule.length - 1 : 0) : 0;
            const doubling = r ? (showReal ? r.realDoublingTimeYears : r.doublingTimeYears) : Infinity;
            return { strategy: s, final, invested, interest, cagr, years, doubling };
          }).sort((a, b) => b.final - a.final);

          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="stat-card">
                <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Final Balance</span>
                <div className="mt-1 space-y-1">
                  {items.map((it) => (
                      <div key={it.strategy.id} className="flex items-center justify-center">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: it.strategy.color }}>{formatCurrency(it.final)}</span>
                      </div>
                    ))}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-2 block">after {totalYears} {totalYears === 1 ? 'year' : 'years'}</span>
              </div>

              <div className="stat-card">
                <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Total Invested</span>
                <div className="mt-1 space-y-1">
                  {items.map((it) => (
                    <div key={it.strategy.id} className="flex items-center justify-center">
                      <span className="text-sm font-semibold tabular-nums" style={{ color: it.strategy.color }}>{formatCurrency(it.invested)}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-2 block">start + contrib</span>
              </div>

              <div className="stat-card">
                <span className="text-[11px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Interest Earned</span>
                <div className="mt-1 space-y-1">
                  {items.map((it) => (
                    <div key={it.strategy.id} className="flex items-center justify-center">
                      <span className="text-sm font-semibold tabular-nums" style={{ color: it.strategy.color }}>{formatCurrency(it.interest)}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-2 block">per strategy</span>
              </div>

              <div className="stat-card">
                <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Growth (CAGR)</span>
                <div className="mt-1 space-y-1">
                  {items.map((it) => (
                    <div key={it.strategy.id} className="flex items-center justify-center gap-2">
                      <span className="text-sm font-semibold tabular-nums" style={{ color: it.strategy.color }}>{formatPercent(it.cagr)}</span>
                      <span className="text-[11px] text-slate-400 dark:text-neutral-500">Doubles in ~{formatYears(it.doubling)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card items-center text-center">
            <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Final Balance</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(displayBalance)}</span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500">after {totalYears} {totalYears === 1 ? 'year' : 'years'}</span>
            {showReal && <span className="text-[10px] text-orange-700/80 dark:text-orange-400/80">in today's dollars</span>}
          </div>
          <div className="stat-card items-center text-center">
            <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Total Invested</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalStartingBalance + totalContributed)}</span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500">${totalStartingBalance.toLocaleString()} start + ${totalContributed.toLocaleString()} contrib.</span>
            {totalIncome > 0 && <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatPercent(totalContributed / totalIncome * 100)} of income saved</span>}
          </div>
          <div className="stat-card items-center text-center">
            <span className="text-[11px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Interest Earned</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatCurrency(totalInterest)}</span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatPercent(finalBalance > 0 ? (totalInterest / finalBalance) * 100 : 0)} of total</span>
            {totalStartingBalance > 0 && <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatPercent(totalInterest / totalStartingBalance * 100, 0)} of starting bal.</span>}
          </div>
          <Tooltip text={showReal ? 'Real CAGR — the inflation-adjusted average annual growth rate of your total invested amount over the given period.' : 'CAGR (Compound Annual Growth Rate) is the average annual rate of return that would take your total invested amount to the final balance over the given period.'}>
            <span className="text-xs text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Growth</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{formatPercent(showReal ? realCAGR : effectiveCAGR)} CAGR</span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500">Doubles in ~{formatYears(showReal ? realDoublingTimeYears : doublingTimeYears)}</span>
            {showReal && <span className="text-[10px] text-orange-700/80 dark:text-orange-400/80">real return</span>}
          </Tooltip>
        </div>
      )}

      {/* Warnings */}
      {contributionExceedsIncomeYear !== null && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span className="mt-0.5">⚠️</span>
          <span>Total contributions exceed income starting in year {contributionExceedsIncomeYear}. Consider adjusting contribution amounts or growth rates.</span>
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
          stroke="#7dd3fc"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}

export function MilestoneBadge({ milestone, chevronCount, onClick, strategyHits }: { milestone: Milestone; chevronCount: number; onClick?: () => void; strategyHits?: { name: string; color: string; year: number }[] }) {
  const isClickable = milestone.custom && onClick;
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      className={`flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700/50 rounded-lg px-2.5 py-1.5 ${
        isClickable ? 'cursor-pointer hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors' : ''
      }`}
    >
      {milestone.icon ? (
        <span className="text-sm leading-none">{milestone.icon}</span>
      ) : (
        <ChevronStack count={chevronCount} />
      )}
      <span className="text-xs font-medium text-slate-700 dark:text-neutral-300">{milestone.label}</span>
      {milestone.custom && (
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatCompact(milestone.amount)}</span>
      )}
      {strategyHits ? (
        <span className="flex items-center gap-1.5">
          {strategyHits.map((h) => (
            <span key={h.name} className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: h.color }} />
              <span className="text-[10px] text-slate-400 dark:text-neutral-500">yr {h.year}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">yr {milestone.year}</span>
      )}
    </div>
  );
}
