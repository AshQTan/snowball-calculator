import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { YearBreakdown, Fund, Milestone } from '../types';
import { formatCurrency } from '../utils/formatters';

const COLOR_STARTING = '#6366f1';
const COLOR_CONTRIBUTIONS = '#22c55e';
const COLOR_INTEREST = '#f59e0b';
const TINT = '14'; // ~8% opacity

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

function mixColor(hex: string, target: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(target);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

function fundVariants(color: string, darkMode: boolean) {
  return {
    starting: mixColor(color, darkMode ? '#0a0a0a' : '#1e293b', 0.55),
    contributions: color,
    interest: mixColor(color, darkMode ? '#e5e5e5' : '#ffffff', 0.45),
  };
}

type TableViewMode = 'combined' | 'by-fund' | 'split';
const TABLE_VIEW_LABELS: Record<TableViewMode, string> = {
  combined: 'Combined',
  'by-fund': 'By Fund',
  split: 'Fund × Type',
};

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
  const [viewMode, setViewMode] = useState<TableViewMode>('combined');

  const milestoneYears = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of milestones) map.set(m.year, m.label);
    return map;
  }, [milestones]);

  const displayRows = expanded ? schedule : schedule.slice(0, 50);
  const hasFunds = funds.length > 1;
  const darkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
          Accumulation Schedule
        </h2>
        {hasFunds && (
          <div className="relative group">
            <button className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-2 py-1 rounded-md transition-colors">
              {TABLE_VIEW_LABELS[viewMode]}
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[120px]">
              {(['combined', 'by-fund', 'split'] as TableViewMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                    viewMode === mode
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700'
                  }`}
                  onClick={() => setViewMode(mode)}
                >
                  {TABLE_VIEW_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        {(!hasFunds || viewMode === 'combined') ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800">
              {hasFunds && <th className="w-8" />}
              <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pr-3">
                {timelineMode === 'retirement' ? 'Age' : 'Year'}
              </th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 px-3" style={{ backgroundColor: `${COLOR_STARTING}${TINT}` }}>Start</th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 px-3" style={{ backgroundColor: `${COLOR_CONTRIBUTIONS}${TINT}` }}>Contribution</th>
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 px-3" style={{ backgroundColor: `${COLOR_INTEREST}${TINT}` }}>Interest</th>
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
                  <td className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums" style={{ backgroundColor: `${COLOR_STARTING}${TINT}` }}>{formatCurrency(row.startBalance)}</td>
                  <td className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums" style={{ backgroundColor: `${COLOR_CONTRIBUTIONS}${TINT}` }}>{formatCurrency(row.totalContribution)}</td>
                  <td className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums" style={{ backgroundColor: `${COLOR_INTEREST}${TINT}` }}>{formatCurrency(row.totalInterest)}</td>
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
        ) : viewMode === 'by-fund' ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800">
              <th className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pr-3">
                {timelineMode === 'retirement' ? 'Age' : 'Year'}
              </th>
              {funds.map((fund) => (
                <th key={fund.id} className="text-right text-xs font-medium uppercase py-2 px-3" style={{ color: fund.color, backgroundColor: `${fund.color}${TINT}` }}>
                  {fund.name}
                </th>
              ))}
              <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pl-3">Total</th>
              {showReal && (
                <th className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pl-3">Adjusted</th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const isMilestone = milestoneYears.has(row.year);
              return (
                <tr
                  key={row.year}
                  className={`border-b transition-colors ${
                    isMilestone
                      ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      : 'border-slate-100 dark:border-neutral-800/50 hover:bg-slate-50 dark:hover:bg-neutral-800/30'
                  }`}
                >
                  <td className="py-2 pr-3 font-medium">
                    <span className={isMilestone ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'}>
                      {timelineMode === 'retirement' && row.age ? row.age : row.year}
                    </span>
                    {isMilestone && (
                      <span className="ml-1.5 text-[10px] text-amber-600/70 dark:text-amber-500/70">{milestoneYears.get(row.year)}</span>
                    )}
                  </td>
                  {funds.map((fund) => (
                    <td key={fund.id} className="py-2 px-3 text-right text-slate-500 dark:text-neutral-400 tabular-nums" style={{ backgroundColor: `${fund.color}${TINT}` }}>
                      {formatCurrency(row.fundBalances[fund.id] || 0)}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right text-slate-800 dark:text-neutral-200 font-medium tabular-nums">{formatCurrency(row.endBalance)}</td>
                  {showReal && (
                    <td className="py-2 pl-3 text-right text-red-500/80 dark:text-red-400/80 font-medium tabular-nums">{formatCurrency(row.realEndBalance)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-neutral-800">
              <th rowSpan={2} className="text-left text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pr-3 align-bottom">
                {timelineMode === 'retirement' ? 'Age' : 'Year'}
              </th>
              {funds.map((fund) => (
                <th key={fund.id} colSpan={3} className="text-center text-xs font-medium uppercase py-1 px-1 border-b border-slate-100 dark:border-neutral-800/50" style={{ color: fund.color, backgroundColor: `${fund.color}${TINT}` }}>
                  {fund.name}
                </th>
              ))}
              <th rowSpan={2} className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pl-3 align-bottom">Total</th>
              {showReal && (
                <th rowSpan={2} className="text-right text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase py-2 pl-3 align-bottom">Adjusted</th>
              )}
            </tr>
            <tr className="border-b border-slate-200 dark:border-neutral-800">
              {funds.map((fund) => {
                const v = fundVariants(fund.color, darkMode);
                return (
                <React.Fragment key={fund.id}>
                  <th className="text-right text-[10px] font-medium text-slate-400 dark:text-neutral-500 uppercase py-1 px-2" style={{ backgroundColor: `${v.starting}${TINT}` }}>Contrib</th>
                  <th className="text-right text-[10px] font-medium text-slate-400 dark:text-neutral-500 uppercase py-1 px-2" style={{ backgroundColor: `${v.contributions}${TINT}` }}>Interest</th>
                  <th className="text-right text-[10px] font-medium text-slate-400 dark:text-neutral-500 uppercase py-1 px-2" style={{ backgroundColor: `${v.interest}${TINT}` }}>Balance</th>
                </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const isMilestone = milestoneYears.has(row.year);
              return (
                <tr
                  key={row.year}
                  className={`border-b transition-colors ${
                    isMilestone
                      ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      : 'border-slate-100 dark:border-neutral-800/50 hover:bg-slate-50 dark:hover:bg-neutral-800/30'
                  }`}
                >
                  <td className="py-2 pr-3 font-medium">
                    <span className={isMilestone ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'}>
                      {timelineMode === 'retirement' && row.age ? row.age : row.year}
                    </span>
                    {isMilestone && (
                      <span className="ml-1.5 text-[10px] text-amber-600/70 dark:text-amber-500/70">{milestoneYears.get(row.year)}</span>
                    )}
                  </td>
                  {funds.map((fund) => {
                    const v = fundVariants(fund.color, darkMode);
                    return (
                    <React.Fragment key={fund.id}>
                      <td className="py-2 px-2 text-right text-xs text-slate-400 dark:text-neutral-500 tabular-nums" style={{ backgroundColor: `${v.starting}${TINT}` }}>{formatCurrency(row.fundContributions[fund.id] || 0)}</td>
                      <td className="py-2 px-2 text-right text-xs text-slate-400 dark:text-neutral-500 tabular-nums" style={{ backgroundColor: `${v.contributions}${TINT}` }}>{formatCurrency(row.fundInterest[fund.id] || 0)}</td>
                      <td className="py-2 px-2 text-right text-xs text-slate-500 dark:text-neutral-400 tabular-nums" style={{ backgroundColor: `${v.interest}${TINT}` }}>{formatCurrency(row.fundBalances[fund.id] || 0)}</td>
                    </React.Fragment>
                    );
                  })}
                  <td className="py-2 pl-3 text-right text-slate-800 dark:text-neutral-200 font-medium tabular-nums">{formatCurrency(row.endBalance)}</td>
                  {showReal && (
                    <td className="py-2 pl-3 text-right text-red-500/80 dark:text-red-400/80 font-medium tabular-nums">{formatCurrency(row.realEndBalance)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
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
