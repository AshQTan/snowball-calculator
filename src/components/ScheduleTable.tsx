import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { YearBreakdown, Fund, Milestone } from '../types';
import { formatCurrency } from '../utils/formatters';

interface ScheduleTableProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  showReal: boolean;
  timelineMode: 'years' | 'retirement';
  milestones: Milestone[];
}

export default function ScheduleTable({ schedule, funds, showReal, timelineMode, milestones }: ScheduleTableProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const milestoneYears = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of milestones) map.set(m.year, m.label);
    return map;
  }, [milestones]);

  const displayRows = expanded ? schedule : schedule.slice(0, 50);
  const hasFunds = funds.length > 1;

  const toggleRow = (year: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-4">
        Accumulation Schedule
      </h2>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800">
              {hasFunds && <th className="w-8" />}
              <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pr-3">
                {timelineMode === 'retirement' ? 'Age' : 'Year'}
              </th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 px-3">Start</th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 px-3">Contribution</th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 px-3">Interest</th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pl-3">End Balance</th>
              {showReal && (
                <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pl-3">
                  <div className="relative group/tip inline-flex items-center gap-1 cursor-help">
                    <span>Adjusted Balance</span>
                    <div className="absolute bottom-full right-0 mb-2 w-52 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed normal-case tracking-normal font-normal opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-50 shadow-xl text-left">
                      End balance adjusted for inflation, expressed in today's purchasing power.
                    </div>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.flatMap((row) => {
              const isExp = expandedRows.has(row.year);
              const isMilestone = milestoneYears.has(row.year);
              const rows = [
                <tr
                  key={row.year}
                  className={`border-b transition-colors ${hasFunds ? 'cursor-pointer' : ''} ${
                    isMilestone
                      ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      : 'border-slate-100 dark:border-neutral-800/50 hover:bg-slate-50 dark:hover:bg-neutral-800/30'
                  }`}
                  onClick={() => hasFunds && toggleRow(row.year)}
                >
                  {hasFunds && (
                    <td className="py-2">
                      {isExp ? <ChevronUp className="w-3 h-3 text-slate-300 dark:text-neutral-600" /> : <ChevronDown className="w-3 h-3 text-slate-300 dark:text-neutral-600" />}
                    </td>
                  )}
                  <td className="py-2 pr-3 font-medium">
                    <span className={isMilestone ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'}>
                      {timelineMode === 'retirement' && row.age ? row.age : row.year}
                    </span>
                    {isMilestone && (
                      <span className="ml-1.5 text-[10px] text-amber-600/70 dark:text-amber-500/70">{milestoneYears.get(row.year)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums">{formatCurrency(row.startBalance)}</td>
                  <td className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums">{formatCurrency(row.totalContribution)}</td>
                  <td className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums">{formatCurrency(row.totalInterest)}</td>
                  <td className="py-2 pl-3 text-right text-slate-800 dark:text-neutral-200 font-medium tabular-nums">{formatCurrency(row.endBalance)}</td>
                  {showReal && (
                    <td className="py-2 pl-3 text-right text-red-500/80 dark:text-red-400/80 font-medium tabular-nums">{formatCurrency(row.realEndBalance)}</td>
                  )}
                </tr>,
              ];
              if (hasFunds && isExp) {
                for (const fund of funds) {
                  rows.push(
                    <tr key={`${row.year}-${fund.id}`} className="bg-slate-50 dark:bg-neutral-800/20">
                      <td />
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5 pl-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: fund.color }} />
                          <span className="text-xs text-slate-400 dark:text-neutral-500">{fund.name}</span>
                        </div>
                      </td>
                      <td />
                      <td className="py-1.5 px-3 text-right text-xs text-slate-400 dark:text-neutral-500 tabular-nums">{formatCurrency(row.fundContributions[fund.id] || 0)}</td>
                      <td className="py-1.5 px-3 text-right text-xs text-slate-400 dark:text-neutral-500 tabular-nums">{formatCurrency(row.fundInterest[fund.id] || 0)}</td>
                      <td className="py-1.5 pl-3 text-right text-xs text-slate-500 dark:text-neutral-400 tabular-nums">{formatCurrency(row.fundBalances[fund.id] || 0)}</td>
                      {showReal && <td />}
                    </tr>
                  );
                }
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>

      {schedule.length > 50 && (
        <button onClick={() => setExpanded(!expanded)} className="btn-ghost w-full justify-center mt-3 text-xs">
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Show Less</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Show All {schedule.length} Years</>
          )}
        </button>
      )}
    </div>
  );
}
