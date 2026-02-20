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
  ReferenceDot,
  Label,
  ReferenceLine,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { Strategy, ProjectionResult, ChartMode } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';

// Milestone chevron label for overlay chart (strategy-colored)
function OverlayMilestoneLabel(props: { viewBox?: { x: number; y: number; width?: number; height?: number }; chevronCount?: number; icon?: string; color?: string; dx?: number }) {
  const { viewBox, chevronCount = 1, icon, color = '#7dd3fc', dx = 0 } = props;
  if (!viewBox) return null;
  const cx = (viewBox.width != null && viewBox.width > 0 ? viewBox.x + viewBox.width / 2 : viewBox.x) + dx;
  const cy = viewBox.height != null && viewBox.height > 0 ? viewBox.y + viewBox.height / 2 : viewBox.y;
  if (icon) {
    return (
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize="12" dominantBaseline="auto" fill={color}>
        {icon}
      </text>
    );
  }
  const clamped = Math.min(chevronCount, 7);
  const spacing = 6;
  const startY = cy - 14 - (clamped - 1) * spacing;
  return (
    <g>
      {Array.from({ length: clamped }).map((_, i) => (
        <polyline
          key={i}
          points={`${cx - 4},${startY + i * spacing + 3} ${cx},${startY + i * spacing} ${cx + 4},${startY + i * spacing + 3}`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </g>
  );
}

type CompareMetric = 'balance' | 'interest' | 'contributions' | 'debt' | 'netWorth';
const METRIC_LABELS: Record<CompareMetric, string> = {
  balance: 'Total Balance',
  netWorth: 'Net Worth',
  interest: 'Interest',
  contributions: 'Contributions',
  debt: 'Debt',
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
  hideHeader?: boolean;
  showMilestones?: boolean;
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
  hideHeader,
  showMilestones,
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

        // Debt & NW
        const inflationFactorNW = showReal ? Math.pow(1 + inflationRate / 100, r.year) : 1;
        const debt = showReal ? (r.debtBalance || 0) / inflationFactorNW : (r.debtBalance || 0);
        const nw = showReal ? (r.netWorth ?? balance) / inflationFactorNW : (r.netWorth ?? balance);

        row[`${s.id}_balance`] = balance;
        row[`${s.id}_interest`] = interest;
        row[`${s.id}_contributions`] = contributions;
        row[`${s.id}_startingBal`] = startingBal;
        row[`${s.id}_debt`] = debt;
        row[`${s.id}_netWorth`] = nw;
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

  // Compute milestone markers per strategy for the overlay chart
  const milestoneMarkers = useMemo(() => {
    if (!showMilestones) return [];
    // Build global chevron index across all strategies
    const globalAmounts = new Map<string, number>();
    for (const s of strategies) {
      const res = allResults.get(s.id);
      if (!res) continue;
      const sourceMilestones = metric === 'netWorth' ? res.milestonesNetWorth || [] : res.milestones || [];
      for (const m of sourceMilestones) {
        const key = (m.icon || m.inverted) ? m.label : m.amount.toString();
        globalAmounts.set(key, m.amount);
      }
    }
    const sortedKeys = [...globalAmounts.keys()].sort((a, b) => globalAmounts.get(a)! - globalAmounts.get(b)!);
    const chevronByKey = new Map<string, number>();
    sortedKeys.forEach((key, i) => chevronByKey.set(key, i + 1));

    const markers: { strategyId: string; color: string; xLabel: string; value: number; chevronCount: number; icon?: string; milestoneColor?: string; strategyIndex: number; totalStrategies: number }[] = [];
    for (let si = 0; si < strategies.length; si++) {
      const s = strategies[si];
      const res = allResults.get(s.id);
      if (!res) continue;
      const sourceMilestones = metric === 'netWorth' ? res.milestonesNetWorth || [] : res.milestones || [];
      for (const m of sourceMilestones) {
        const row = res.schedule.find((r) => r.year === m.year);
        if (!row) continue;
        const xLabel = timelineMode === 'retirement' && row.age ? `${row.age}` : `${m.year}`;
        let value = 0;
        if (metric === 'netWorth') {
          const nominalNW = row.netWorth ?? row.endBalance;
          const inflationFactor = showReal ? Math.pow(1 + inflationRate / 100, row.year) : 1;
          value = showReal ? nominalNW / inflationFactor : nominalNW;
        } else {
          value = showReal ? row.realEndBalance : row.endBalance;
        }
        const key = (m.icon || m.inverted) ? m.label : m.amount.toString();
        markers.push({
          strategyId: s.id,
          color: s.color, // Color for strategy lines/bars
          xLabel,
          value,
          chevronCount: chevronByKey.get(key) ?? 1,
          icon: m.icon,
          milestoneColor: m.color || '#7dd3fc', // Decoupled color for the milestone marker itself
          strategyIndex: si,
          totalStrategies: strategies.length,
        });
      }
    }
    return markers;
  }, [strategies, allResults, showMilestones, showReal, timelineMode, metric, inflationRate]);

  return (
    <div className={hideHeader ? '' : 'card'}>
      {!hideHeader && <div className="flex items-center justify-between mb-4">
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
            {(['balance', 'netWorth', 'interest', 'contributions', 'debt'] as CompareMetric[]).map((m) => (
              <button
                key={m}
                className={`px-2 py-1 text-[11px] rounded-md transition-all ${metric === m
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
              className={`p-1.5 rounded-md transition-all group relative ${chartMode === 'line' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('line')}
            >
              <LineChartIcon className="w-4 h-4" />
              <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Display as a smooth line chart to compare growth trends across strategies.</div>
            </button>
            <button
              className={`p-1.5 rounded-md transition-all group relative ${chartMode === 'bar' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('bar')}
            >
              <BarChart3 className="w-4 h-4" />
              <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Display as grouped bars to compare values across strategies for each year.</div>
            </button>
          </div>
        </div>
      </div>}

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
              {(metric === 'balance' || metric === 'netWorth') && milestoneMarkers.map((m) => (
                <ReferenceDot
                  key={`${m.strategyId}_${m.chevronCount}`}
                  x={m.xLabel}
                  y={m.value}
                  r={3}
                  fill={m.color}
                  stroke={m.color}
                  strokeWidth={0}
                >
                  <Label content={<OverlayMilestoneLabel chevronCount={m.chevronCount} icon={m.icon} color={m.milestoneColor || m.color} />} />
                </ReferenceDot>
              ))}
              {metric === 'netWorth' && <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />}
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
              {(metric === 'balance' || metric === 'netWorth') && milestoneMarkers.map((m) => {
                // Offset chevrons horizontally per strategy so they don't overlap
                const dx = (m.strategyIndex - (m.totalStrategies - 1) / 2) * 12;
                return (
                  <ReferenceDot
                    key={`${m.strategyId}_${m.chevronCount}`}
                    x={m.xLabel}
                    y={m.value}
                    r={0}
                    fill="none"
                    stroke="none"
                  >
                    <Label content={<OverlayMilestoneLabel chevronCount={m.chevronCount} icon={m.icon} color={m.milestoneColor || m.color} dx={dx} />} />
                  </ReferenceDot>
                );
              })}
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

  const fields = ['balance', 'interest', 'contributions', 'startingBal', 'debt', 'netWorth'] as const;

  // Build strategy rows sorted by balance descending
  const rows = strategies
    .map((s) => ({
      strategy: s,
      balance: (data[`${s.id}_balance`] as number) ?? 0,
      interest: (data[`${s.id}_interest`] as number) ?? 0,
      contributions: (data[`${s.id}_contributions`] as number) ?? 0,
      startingBal: (data[`${s.id}_startingBal`] as number) ?? 0,
      debt: (data[`${s.id}_debt`] as number) ?? 0,
      netWorth: (data[`${s.id}_netWorth`] as number) ?? 0,
    }))
    .sort((a, b) => b.balance - a.balance);

  // Compute which strategy has the highest value per field (only if uniquely highest)
  const highestByField: Record<string, string> = {};
  const EPS = 1e-6;
  for (const f of fields) {
    let maxVal = -Infinity;
    for (const r of rows) {
      if (r[f] > maxVal) {
        maxVal = r[f];
      }
    }
    // Count how many strategies tie for the max (within EPS)
    let count = 0;
    let maxId = '';
    for (const r of rows) {
      if (Math.abs(r[f] - maxVal) <= EPS) {
        count += 1;
        maxId = r.strategy.id;
      }
    }
    highestByField[f] = count === 1 ? maxId : '';
  }

  const isHighest = (strategyId: string, field: string) =>
    strategies.length > 1 && highestByField[field] === strategyId;

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg p-3 shadow-xl min-w-[240px]">
      <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 mb-2">
        {timelineMode === 'retirement' ? `Age ${label}` : `Year ${label}`}
      </p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.strategy.id} className="space-y-1">
            {/* Strategy header */}
            <div className="flex justify-between gap-4">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.strategy.color }} />
                {r.strategy.name}
              </span>
              <span className={`text-xs font-semibold tabular-nums ${isHighest(r.strategy.id, 'balance') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(r.balance)}
              </span>
            </div>
            {/* Breakdown */}
            <div className="ml-3.5 space-y-0.5">
              {([
                { label: 'Net Worth', field: 'netWorth', value: r.netWorth },
                { label: 'Interest', field: 'interest', value: r.interest },
                { label: 'Contributions', field: 'contributions', value: r.contributions },
                { label: 'Starting Bal.', field: 'startingBal', value: r.startingBal },
                { label: 'Debt', field: 'debt', value: r.debt },
              ] as const).map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400">{item.label}</span>
                  <span className={`text-[10px] tabular-nums ${isHighest(r.strategy.id, item.field) ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-neutral-400'}`}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {showReal && <p className="text-[10px] text-slate-400 dark:text-neutral-600 mt-1">In today's dollars</p>}
      </div>
    </div>
  );
}
