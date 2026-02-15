import { useState, useMemo } from 'react';
import { YearBreakdown, Fund, Strategy, ProjectionResult } from '../types';
import { formatPercent, formatCurrency } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, fundVariants } from '../utils/colors';
import LegendItem from './LegendItem';
import { ChevronDown } from 'lucide-react';

interface CompositionChartProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  darkMode: boolean;
  timelineMode: 'years' | 'retirement';
  strategies?: Strategy[];
  activeStrategyId?: string;
  allResults?: Map<string, ProjectionResult>;
  onSwitchStrategy?: (id: string) => void;
}

type CompView = 'combined' | 'by-fund';
const COMP_VIEW_LABELS: Record<CompView, string> = {
  combined: 'Combined',
  'by-fund': 'By Fund',
};

export default function CompositionChart({
  schedule,
  funds,
  darkMode,
  timelineMode,
  strategies,
  activeStrategyId,
  allResults,
  onSwitchStrategy,
}: CompositionChartProps) {
  const [selectedYear, setSelectedYear] = useState(schedule.length);
  const [compView, setCompView] = useState<CompView>('combined');
  const hasManyFunds = funds.length > 1;

  const clampedYear = Math.min(Math.max(selectedYear, 1), schedule.length);
  const row = schedule[clampedYear - 1];

  const data = useMemo(() => {
    if (!row) return { pctStart: 0, pctContrib: 0, pctInterest: 0, total: 0, startVal: 0, contribVal: 0, interestVal: 0 };
    return {
      pctStart: row.pctStartingBalance,
      pctContrib: row.pctContributions,
      pctInterest: row.pctInterest,
      total: row.endBalance,
      startVal: row.cumulativeStartingBalance,
      contribVal: row.cumulativeContributions,
      interestVal: row.cumulativeInterest,
    };
  }, [row]);

  // Per-fund cumulative data up to the selected year
  const fundData = useMemo(() => {
    if (!hasManyFunds) return [];
    return funds.map((f) => {
      let cumContrib = 0;
      let cumInterest = 0;
      for (let i = 0; i < clampedYear && i < schedule.length; i++) {
        cumContrib += schedule[i].fundContributions[f.id] || 0;
        cumInterest += schedule[i].fundInterest[f.id] || 0;
      }
      const startVal = f.startingBalance;
      const total = startVal + cumContrib + cumInterest;
      const overall = row?.endBalance || 0;
      return {
        fund: f,
        startVal,
        contribVal: cumContrib,
        interestVal: cumInterest,
        total,
        pctOfTotal: overall > 0 ? (total / overall) * 100 : 0,
        pctStart: total > 0 ? (startVal / overall) * 100 : 0,
        pctContrib: total > 0 ? (cumContrib / overall) * 100 : 0,
        pctInterest: total > 0 ? (cumInterest / overall) * 100 : 0,
      };
    });
  }, [funds, schedule, clampedYear, hasManyFunds, row]);

  const yearLabel = timelineMode === 'retirement' && row?.age
    ? `Age ${row.age}`
    : `Year ${row?.year ?? (clampedYear - 1)}`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
          Wealth Composition
        </h2>
        <div className="flex items-center gap-2">
          {hasManyFunds && (
            <div className="relative group">
              <button className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-2 py-1 rounded-md transition-colors">
                {COMP_VIEW_LABELS[compView]}
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[100px]">
                {(['combined', 'by-fund'] as CompView[]).map((mode) => (
                  <button
                    key={mode}
                    className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                      compView === mode
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700'
                    }`}
                    onClick={() => setCompView(mode)}
                  >
                    {COMP_VIEW_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span className="text-sm text-slate-500 dark:text-neutral-400 font-medium">{yearLabel}</span>
        </div>
      </div>

      {/* Stacked horizontal bar */}
      <div className="space-y-3">
        {compView === 'by-fund' && hasManyFunds ? (
          <div className="space-y-1.5">
            {fundData.map(({ fund, pctStart, pctContrib, pctInterest, pctOfTotal, startVal, contribVal, interestVal }) => {
              const v = fundVariants(fund.color, darkMode);
              return (
                <div key={fund.id} className="space-y-0.5">
                  <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">{fund.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-7 flex">
                      <BarSegment pct={pctStart} color={v.starting} label="Starting" value={startVal} size="sm" roundedClass="rounded-l-md" />
                      <BarSegment pct={pctContrib} color={v.contributions} label="Contributions" value={contribVal} size="sm" />
                      <BarSegment pct={pctInterest} color={v.interest} label="Interest" value={interestVal} size="sm" textClass="text-white/90" roundedClass="rounded-r-md" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 tabular-nums w-[36px] text-right">{Math.round(pctOfTotal)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full h-10 flex">
            <BarSegment pct={data.pctStart} color={COLOR_STARTING} label="Starting Balance" value={data.startVal} size="lg" roundedClass="rounded-l-lg" />
            <BarSegment pct={data.pctContrib} color={COLOR_CONTRIBUTIONS} label="Contributions" value={data.contribVal} size="lg" />
            <BarSegment pct={data.pctInterest} color={COLOR_INTEREST} label="Interest" value={data.interestVal} size="lg" textClass="text-white/90" roundedClass="rounded-r-lg" />
          </div>
        )}

        {/* Detail breakdown */}
        {compView === 'by-fund' && hasManyFunds ? (
          <div className="space-y-2">
            {fundData.map(({ fund, startVal, contribVal, interestVal, total, pctOfTotal }) => {
              const v = fundVariants(fund.color, darkMode);
              return (
                <div key={fund.id} className="bg-slate-50 dark:bg-neutral-800/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: fund.color }} />
                      <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">{fund.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200 tabular-nums">{formatCurrency(total)}</span>
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{Math.round(pctOfTotal)}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniDetail color={v.starting} label="Starting" value={startVal} />
                    <MiniDetail color={v.contributions} label="Contributions" value={contribVal} />
                    <MiniDetail color={v.interest} label="Interest" value={interestVal} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <DetailCard color={COLOR_STARTING} label="Starting Balance" pct={data.pctStart} value={data.startVal} />
            <DetailCard color={COLOR_CONTRIBUTIONS} label="Contributions" pct={data.pctContrib} value={data.contribVal} />
            <DetailCard color={COLOR_INTEREST} label="Interest" pct={data.pctInterest} value={data.interestVal} />
          </div>
        )}

        {/* Year slider */}
        <div className="pt-1">
          <input
            type="range"
            className="w-full accent-sky-500 dark:accent-neutral-400"
            min={1}
            max={schedule.length}
            value={clampedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-slate-400 dark:text-neutral-600 mt-0.5">
            <span>{timelineMode === 'retirement' && schedule[0]?.age ? `Age ${schedule[0].age}` : `Year ${schedule[0]?.year ?? 0}`}</span>
            <span>
              {timelineMode === 'retirement' && schedule[schedule.length - 1]?.age
                ? `Age ${schedule[schedule.length - 1].age}`
                : `Year ${schedule[schedule.length - 1]?.year ?? schedule.length - 1}`}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
        {compView === 'by-fund' && hasManyFunds ? (
          <>
            {funds.map((f) => {
              const v = fundVariants(f.color, darkMode);
              return (
                <div key={f.id} className="flex items-center gap-1.5">
                  <div className="flex">
                    <div className="w-2.5 h-2.5 rounded-l-sm" style={{ backgroundColor: v.starting }} />
                    <div className="w-2.5 h-2.5" style={{ backgroundColor: v.contributions }} />
                    <div className="w-2.5 h-2.5 rounded-r-sm" style={{ backgroundColor: v.interest }} />
                  </div>
                  <span className="text-xs text-slate-400 dark:text-neutral-500">{f.name}</span>
                </div>
              );
            })}
            <span className="text-[10px] text-slate-400/70 dark:text-neutral-600">
              dark = starting · mid = contributions · light = interest
            </span>
          </>
        ) : (
          <>
            <LegendItem color={COLOR_STARTING} label="Starting Balance" />
            <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" />
            <LegendItem color={COLOR_INTEREST} label="Interest" />
          </>
        )}
      </div>

      {/* Strategy comparison bars */}
      {strategies && strategies.length > 1 && allResults && (
        <StrategyComparison
          strategies={strategies}
          activeStrategyId={activeStrategyId!}
          allResults={allResults}
          clampedYear={clampedYear}
          darkMode={darkMode}
          onSwitchStrategy={onSwitchStrategy}
        />
      )}
    </div>
  );
}

function StrategyComparison({
  strategies,
  activeStrategyId,
  allResults,
  clampedYear,
  onSwitchStrategy,
}: {
  strategies: Strategy[];
  activeStrategyId: string;
  allResults: Map<string, ProjectionResult>;
  clampedYear: number;
  darkMode: boolean;
  onSwitchStrategy?: (id: string) => void;
}) {
  const strategyData = useMemo(() => {
    return strategies.map((s) => {
      const result = allResults.get(s.id);
      if (!result || clampedYear < 1 || clampedYear > result.schedule.length) {
        return { strategy: s, total: 0, pctStart: 0, pctContrib: 0, pctInterest: 0, startVal: 0, contribVal: 0, interestVal: 0 };
      }
      const row = result.schedule[clampedYear - 1];
      return {
        strategy: s,
        total: row.endBalance,
        pctStart: row.pctStartingBalance,
        pctContrib: row.pctContributions,
        pctInterest: row.pctInterest,
        startVal: row.cumulativeStartingBalance,
        contribVal: row.cumulativeContributions,
        interestVal: row.cumulativeInterest,
      };
    });
  }, [strategies, allResults, clampedYear]);

  const maxTotal = Math.max(...strategyData.map((d) => d.total), 1);

  return (
    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-neutral-700">
      <div className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-2 font-medium">
        Strategy Comparison
      </div>
      <div className="space-y-1.5">
        {strategyData.map(({ strategy, total, pctStart, pctContrib, pctInterest, startVal, contribVal, interestVal }) => {
          const isActive = strategy.id === activeStrategyId;
          const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <button
              key={strategy.id}
              className={`w-full text-left transition-all rounded-md px-2 py-1.5 ${
                isActive
                  ? 'bg-slate-100 dark:bg-neutral-800/60 ring-1 ring-slate-300 dark:ring-neutral-600'
                  : 'hover:bg-slate-50 dark:hover:bg-neutral-800/30'
              }`}
              onClick={() => onSwitchStrategy?.(strategy.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: strategy.color }} />
                  <span className={`text-[11px] font-medium ${isActive ? 'text-slate-700 dark:text-neutral-200' : 'text-slate-500 dark:text-neutral-400'}`}>
                    {strategy.name}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300 tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="h-5 flex" style={{ width: `${barWidth}%` }}>
                {pctStart > 0 && (
                  <div
                    className="h-full rounded-l-sm"
                    style={{ width: `${pctStart}%`, backgroundColor: COLOR_STARTING }}
                    title={`Starting: ${formatCurrency(startVal)}`}
                  />
                )}
                {pctContrib > 0 && (
                  <div
                    className="h-full"
                    style={{ width: `${pctContrib}%`, backgroundColor: COLOR_CONTRIBUTIONS }}
                    title={`Contributions: ${formatCurrency(contribVal)}`}
                  />
                )}
                {pctInterest > 0 && (
                  <div
                    className="h-full rounded-r-sm"
                    style={{ width: `${pctInterest}%`, backgroundColor: COLOR_INTEREST }}
                    title={`Interest: ${formatCurrency(interestVal)}`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailCard({ color, label, pct, value }: { color: string; label: string; pct: number; value: number }) {
  return (
    <div className="bg-slate-50 dark:bg-neutral-800/40 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-semibold text-slate-800 dark:text-neutral-200 tabular-nums">{formatPercent(pct)}</div>
      <div className="text-xs text-slate-400 dark:text-neutral-500 tabular-nums">{formatCurrency(value)}</div>
    </div>
  );
}


function MiniDetail({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="min-w-0">
        <div className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider truncate">{label}</div>
        <div className="text-[11px] text-slate-600 dark:text-neutral-400 tabular-nums">{formatCurrency(value)}</div>
      </div>
    </div>
  );
}

function BarSegment({
  pct,
  color,
  label,
  value,
  size,
  textClass = 'text-white',
  roundedClass = '',
}: {
  pct: number;
  color: string;
  label: string;
  value: number;
  size: 'sm' | 'lg';
  textClass?: string;
  roundedClass?: string;
}) {
  if (pct <= 0) return null;
  const showInline = size === 'lg' ? pct >= 8 : pct >= 10;
  const fontSize = size === 'lg' ? 'text-xs' : 'text-[10px]';
  return (
    <div
      className={`group/seg relative h-full flex items-center justify-center ${fontSize} font-medium ${textClass} ${roundedClass} transition-all duration-300`}
      style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 3 ? undefined : 0 }}
    >
      {showInline && formatPercent(pct, 0)}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-800 dark:bg-neutral-900 text-white text-[10px] rounded-md px-2 py-1 opacity-0 invisible group-hover/seg:opacity-100 group-hover/seg:visible transition-all z-30 whitespace-nowrap pointer-events-none shadow-lg">
        <div className="font-medium">{label}</div>
        <div className="tabular-nums">{formatCurrency(value)} · {formatPercent(pct, 1)}</div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-neutral-900" />
      </div>
    </div>
  );
}
