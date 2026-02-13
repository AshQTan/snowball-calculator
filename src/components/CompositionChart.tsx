import { useState, useMemo } from 'react';
import { YearBreakdown, Fund } from '../types';
import { formatPercent, formatCurrency } from '../utils/formatters';
import { ChevronDown } from 'lucide-react';

interface CompositionChartProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  timelineMode: 'years' | 'retirement';
}

const COLOR_STARTING = '#6366f1';
const COLOR_CONTRIBUTIONS = '#22c55e';
const COLOR_INTEREST = '#f59e0b';

// Color utilities (shared with ProjectionChart)
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

type CompView = 'combined' | 'by-fund';
const COMP_VIEW_LABELS: Record<CompView, string> = {
  combined: 'Combined',
  'by-fund': 'By Fund',
};

export default function CompositionChart({
  schedule,
  funds,
  timelineMode,
}: CompositionChartProps) {
  const [selectedYear, setSelectedYear] = useState(schedule.length);
  const [compView, setCompView] = useState<CompView>('combined');
  const hasManyFunds = funds.length > 1;
  // Detect dark mode from document
  const darkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

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

  const yearLabel = timelineMode === 'retirement' && row?.age ? `Age ${row.age}` : `Year ${clampedYear}`;

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
            <span>{timelineMode === 'retirement' && schedule[0]?.age ? `Age ${schedule[0].age}` : 'Year 1'}</span>
            <span>
              {timelineMode === 'retirement' && schedule[schedule.length - 1]?.age
                ? `Age ${schedule[schedule.length - 1].age}`
                : `Year ${schedule.length}`}
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-xs text-slate-400 dark:text-neutral-500">{label}</span>
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
