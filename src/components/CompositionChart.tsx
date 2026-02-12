import { useState, useMemo } from 'react';
import { YearBreakdown, Fund } from '../types';
import { formatPercent, formatCurrency } from '../utils/formatters';

interface CompositionChartProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  timelineMode: 'years' | 'retirement';
}

const COLOR_STARTING = '#6366f1';
const COLOR_CONTRIBUTIONS = '#22c55e';
const COLOR_INTEREST = '#f59e0b';

export default function CompositionChart({
  schedule,
  funds,
  timelineMode,
}: CompositionChartProps) {
  const [selectedYear, setSelectedYear] = useState(schedule.length);

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

  const yearLabel = timelineMode === 'retirement' && row?.age ? `Age ${row.age}` : `Year ${clampedYear}`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
          Wealth Composition
        </h2>
        <span className="text-sm text-slate-500 dark:text-neutral-400 font-medium">{yearLabel}</span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="space-y-3">
        <div className="w-full h-10 rounded-lg overflow-hidden flex">
          {data.pctStart > 0 && (
            <div
              className="h-full flex items-center justify-center text-xs font-medium text-white transition-all duration-300"
              style={{ width: `${data.pctStart}%`, backgroundColor: COLOR_STARTING, minWidth: data.pctStart > 3 ? undefined : 0 }}
              title={`Starting Balance: ${formatPercent(data.pctStart)}`}
            >
              {data.pctStart >= 8 && formatPercent(data.pctStart, 0)}
            </div>
          )}
          {data.pctContrib > 0 && (
            <div
              className="h-full flex items-center justify-center text-xs font-medium text-white transition-all duration-300"
              style={{ width: `${data.pctContrib}%`, backgroundColor: COLOR_CONTRIBUTIONS, minWidth: data.pctContrib > 3 ? undefined : 0 }}
              title={`Contributions: ${formatPercent(data.pctContrib)}`}
            >
              {data.pctContrib >= 8 && formatPercent(data.pctContrib, 0)}
            </div>
          )}
          {data.pctInterest > 0 && (
            <div
              className="h-full flex items-center justify-center text-xs font-medium text-white/90 transition-all duration-300"
              style={{ width: `${data.pctInterest}%`, backgroundColor: COLOR_INTEREST, minWidth: data.pctInterest > 3 ? undefined : 0 }}
              title={`Interest: ${formatPercent(data.pctInterest)}`}
            >
              {data.pctInterest >= 8 && formatPercent(data.pctInterest, 0)}
            </div>
          )}
        </div>

        {/* Detail breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <DetailCard color={COLOR_STARTING} label="Starting Balance" pct={data.pctStart} value={data.startVal} />
          <DetailCard color={COLOR_CONTRIBUTIONS} label="Contributions" pct={data.pctContrib} value={data.contribVal} />
          <DetailCard color={COLOR_INTEREST} label="Interest" pct={data.pctInterest} value={data.interestVal} />
        </div>

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
        <LegendItem color={COLOR_STARTING} label="Starting Balance" />
        <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" />
        <LegendItem color={COLOR_INTEREST} label="Interest" />
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
