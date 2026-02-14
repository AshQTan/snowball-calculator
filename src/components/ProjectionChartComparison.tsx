import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { Strategy, ProjectionResult, ChartMode } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';

type CompareMetric = 'balance' | 'interest' | 'contributions';
const METRIC_LABELS: Record<CompareMetric, string> = {
  balance: 'Total Balance',
  interest: 'Interest',
  contributions: 'Contributions',
};

interface ProjectionChartComparisonProps {
  strategies: Strategy[];
  allResults: Map<string, ProjectionResult>;
  showReal: boolean;
  inflationRate: number;
  timelineMode: 'years' | 'retirement';
  chartMode: ChartMode;
  darkMode: boolean;
  onChartModeChange: (mode: ChartMode) => void;
}

export default function ProjectionChartComparison({
  strategies,
  allResults,
  showReal,
  inflationRate,
  timelineMode,
  chartMode,
  darkMode,
  onChartModeChange,
}: ProjectionChartComparisonProps) {
  const [metric, setMetric] = useState<CompareMetric>('balance');
  const gridColor = darkMode ? '#262626' : '#e2e8f0';
  const tickColor = darkMode ? '#737373' : '#64748b';
  const axisColor = darkMode ? '#262626' : '#e2e8f0';

  const chartData = useMemo(() => {
    // Find the longest schedule across all strategies
    const maxLen = Math.max(...strategies.map((s) => allResults.get(s.id)?.schedule.length ?? 0));
    const rows: Record<string, unknown>[] = [];

    for (let i = 0; i < maxLen; i++) {
      const row: Record<string, unknown> = {};
      // Use first strategy to determine label
      const firstSchedule = allResults.get(strategies[0].id)?.schedule;
      if (firstSchedule && firstSchedule[i]) {
        const r = firstSchedule[i];
        row.label = timelineMode === 'retirement' && r.age ? `${r.age}` : `${r.year}`;
        row.year = r.year;
      }

      for (const s of strategies) {
        const schedule = allResults.get(s.id)?.schedule;
        if (!schedule || !schedule[i]) continue;
        const r = schedule[i];
        const inflationFactor = showReal ? Math.pow(1 + inflationRate / 100, r.year) : 1;

        const balance = showReal ? r.realEndBalance : r.endBalance;
        const contributions = showReal ? r.cumulativeContributions / inflationFactor : r.cumulativeContributions;
        const interest = showReal ? r.realEndBalance - r.cumulativeStartingBalance - contributions : r.cumulativeInterest;
        const startingBal = r.cumulativeStartingBalance;

        row[`${s.id}_balance`] = balance;
        row[`${s.id}_interest`] = interest;
        row[`${s.id}_contributions`] = contributions;
        row[`${s.id}_startingBal`] = startingBal;
      }

      rows.push(row);
    }
    return rows;
  }, [strategies, allResults, showReal, inflationRate, timelineMode]);

  const tickInterval = useMemo(() => {
    const total = chartData.length;
    if (total <= 15) return 0;
    return Math.ceil(total / 12) - 1;
  }, [chartData]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
          Projection
        </h2>
        <div className="flex items-center gap-2">
          {showReal && (
            <span className="text-[10px] text-orange-700 dark:text-orange-400/80 bg-orange-100 dark:bg-orange-900/20 px-2 py-0.5 rounded-md">
              Inflation-adjusted
            </span>
          )}
          {/* Metric toggle */}
          <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5">
            {(['balance', 'interest', 'contributions'] as CompareMetric[]).map((m) => (
              <button
                key={m}
                className={`px-2 py-1 text-[11px] rounded-md transition-all ${
                  metric === m
                    ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm font-medium'
                    : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'
                }`}
                onClick={() => setMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          {/* Line/Bar toggle */}
          <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              className={`p-1.5 rounded-md transition-all ${chartMode === 'line' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('line')}
              title="Line chart"
            >
              <LineChartIcon className="w-4 h-4" />
            </button>
            <button
              className={`p-1.5 rounded-md transition-all ${chartMode === 'bar' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('bar')}
              title="Bar chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-[350px] sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: axisColor }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v)}
                width={70}
              />
              <Tooltip
                content={
                  <ComparisonTooltip
                    strategies={strategies}
                    allResults={allResults}
                    showReal={showReal}
                    timelineMode={timelineMode}
                  />
                }
              />
              {strategies.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={`${s.id}_${metric}`}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: axisColor }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v)}
                width={70}
              />
              <Tooltip
                content={
                  <ComparisonTooltip
                    strategies={strategies}
                    allResults={allResults}
                    showReal={showReal}
                    timelineMode={timelineMode}
                  />
                }
              />
              {strategies.map((s) => (
                <Bar
                  key={s.id}
                  dataKey={`${s.id}_${metric}`}
                  fill={s.color}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
        {strategies.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-slate-400 dark:text-neutral-500">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Comparison Tooltip ---

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  strategies: Strategy[];
  allResults: Map<string, ProjectionResult>;
  showReal: boolean;
  timelineMode: 'years' | 'retirement';
}

function ComparisonTooltip({
  active,
  payload,
  label,
  strategies,
  showReal,
  timelineMode,
}: ComparisonTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as Record<string, number>;

  // Build strategy rows sorted by balance descending
  const rows = strategies
    .map((s) => ({
      strategy: s,
      balance: (data[`${s.id}_balance`] as number) ?? 0,
      interest: (data[`${s.id}_interest`] as number) ?? 0,
      contributions: (data[`${s.id}_contributions`] as number) ?? 0,
      startingBal: (data[`${s.id}_startingBal`] as number) ?? 0,
    }))
    .sort((a, b) => b.balance - a.balance);

  const hasTwoStrategies = rows.length === 2;
  const diff = hasTwoStrategies ? rows[0].balance - rows[1].balance : 0;
  const diffPct = hasTwoStrategies && rows[1].balance > 0
    ? ((rows[0].balance - rows[1].balance) / rows[1].balance) * 100
    : 0;

  const fmtPct = (a: number, b: number) => {
    if (b === 0) return '';
    const pct = ((a - b) / Math.abs(b)) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg p-3 shadow-xl min-w-[240px]">
      <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 mb-2">
        {timelineMode === 'retirement' ? `Age ${label}` : `Year ${label}`}
      </p>
      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div key={r.strategy.id} className="space-y-1">
            {/* Strategy header */}
            <div className="flex justify-between gap-4">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.strategy.color }} />
                {r.strategy.name}
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(r.balance)}
              </span>
            </div>
            {/* Breakdown */}
            <div className="ml-3.5 space-y-0.5">
              {([
                { label: 'Interest', value: r.interest, refValue: idx === 0 && hasTwoStrategies ? null : rows[0].interest },
                { label: 'Contributions', value: r.contributions, refValue: idx === 0 && hasTwoStrategies ? null : rows[0].contributions },
                { label: 'Starting Bal.', value: r.startingBal, refValue: idx === 0 && hasTwoStrategies ? null : rows[0].startingBal },
              ] as const).map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums">
                      {formatCurrency(item.value)}
                    </span>
                    {item.refValue !== null && item.refValue !== undefined && (
                      <span className={`text-[10px] tabular-nums ${
                        item.value < item.refValue
                          ? 'text-red-500 dark:text-red-400'
                          : item.value > item.refValue
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-neutral-500'
                      }`}>
                        {fmtPct(item.value, item.refValue)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Overall difference row for exactly 2 strategies */}
        {hasTwoStrategies && (
          <div className="border-t border-slate-200 dark:border-neutral-700 pt-1.5">
            <div className="flex justify-between gap-4">
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">Difference</span>
              <span className={`text-[11px] font-medium tabular-nums ${
                diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {diff >= 0 ? '+' : ''}{formatCurrency(diff)} ({diffPct >= 0 ? '+' : ''}{diffPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
        {showReal && <p className="text-[10px] text-slate-400 dark:text-neutral-600 mt-1">In today's dollars</p>}
      </div>
    </div>
  );
}
