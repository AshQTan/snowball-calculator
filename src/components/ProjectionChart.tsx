import { Fragment, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Label,
} from 'recharts';
import { BarChart3, LineChart, ChevronDown } from 'lucide-react';
import { YearBreakdown, Fund, Milestone, ChartMode } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, fundVariants } from '../utils/colors';
import LegendItem from './LegendItem';

interface ProjectionChartProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  milestones: Milestone[];
  showReal: boolean;
  inflationRate: number;
  timelineMode: 'years' | 'retirement';
  chartMode: ChartMode;
  darkMode: boolean;
  onChartModeChange: (mode: ChartMode) => void;
}

// Custom ReferenceDot label that renders stacked SVG chevrons or an emoji icon
function MilestoneLabel(props: { viewBox?: { x: number; y: number; width?: number; height?: number }; chevronCount?: number; icon?: string }) {
  const { viewBox, chevronCount = 1, icon } = props;
  if (!viewBox) return null;
  const cx = viewBox.width ? viewBox.x + viewBox.width / 2 : viewBox.x;
  const cy = viewBox.height ? viewBox.y + viewBox.height / 2 : viewBox.y;
  if (icon) {
    return (
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize="14" dominantBaseline="auto">
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
          points={`${cx - 5},${startY + i * spacing + 4} ${cx},${startY + i * spacing} ${cx + 5},${startY + i * spacing + 4}`}
          stroke="#7dd3fc"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </g>
  );
}

// Legend chevron stack
function LegendChevrons({ count }: { count: number }) {
  const clamped = Math.min(count, 7);
  const h = 4 + clamped * 5;
  return (
    <svg width="12" height={h} viewBox={`0 0 12 ${h}`} fill="none" className="flex-shrink-0">
      {Array.from({ length: clamped }).map((_, i) => (
        <polyline
          key={i}
          points={`1,${h - i * 5 - 1} 6,${h - i * 5 - 5} 11,${h - i * 5 - 1}`}
          stroke="#7dd3fc"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}



type BarViewMode = 'split' | 'by-fund' | 'by-type';
const BAR_VIEW_LABELS: Record<BarViewMode, string> = {
  'split': 'Fund × Type',
  'by-fund': 'By Fund',
  'by-type': 'By Type',
};

function fundGradientId(fundId: string, kind: 'starting' | 'contrib' | 'interest') {
  return `grad_${fundId}_${kind}`;
}

export default function ProjectionChart({
  schedule,
  funds,
  milestones,
  showReal,
  inflationRate,
  timelineMode,
  chartMode,
  darkMode,
  onChartModeChange,
}: ProjectionChartProps) {
  const hasManyFunds = funds.length > 1;
  const [stackView, setStackView] = useState<BarViewMode>('split');
  const gridColor = darkMode ? '#262626' : '#e2e8f0';
  const tickColor = darkMode ? '#737373' : '#64748b';
  const axisColor = darkMode ? '#262626' : '#e2e8f0';

  const chartData = useMemo(() => {
    const cumFundContrib: Record<string, number> = {};
    const cumFundInterest: Record<string, number> = {};
    return schedule.map((row) => {
      const balance = showReal ? row.realEndBalance : row.endBalance;
      const label =
        timelineMode === 'retirement' && row.age
          ? `${row.age}`
          : `${row.year}`;

      const inflationFactor = showReal ? Math.pow(1 + inflationRate / 100, row.year) : 1;
      const contributions = showReal ? row.cumulativeContributions / inflationFactor : row.cumulativeContributions;
      const interest = showReal ? row.realEndBalance - row.cumulativeStartingBalance - contributions : row.cumulativeInterest;

      if (hasManyFunds) {
        // Accumulate per-fund contributions and interest
        for (const f of funds) {
          cumFundContrib[f.id] = (cumFundContrib[f.id] || 0) + (row.fundContributions[f.id] || 0);
          cumFundInterest[f.id] = (cumFundInterest[f.id] || 0) + (row.fundInterest[f.id] || 0);
        }
        const fundData: Record<string, number> = {};
        for (const f of funds) {
          fundData[`fund_${f.id}`] = row.fundBalances[f.id] || 0;
          fundData[`fund_${f.id}_starting`] = f.startingBalance;
          fundData[`fund_${f.id}_contrib`] = cumFundContrib[f.id] || 0;
          fundData[`fund_${f.id}_interest`] = cumFundInterest[f.id] || 0;
        }
        return {
          label,
          year: row.year,
          balance,
          startingBal: row.cumulativeStartingBalance,
          contributions,
          interest,
          ...fundData,
        };
      } else {
        // single fund: stacked by starting balance / contributions / interest
        return {
          label,
          year: row.year,
          balance,
          startingBal: row.cumulativeStartingBalance,
          contributions,
          interest,
        };
      }
    });
  }, [schedule, funds, showReal, inflationRate, timelineMode, hasManyFunds]);

  const milestoneData = useMemo(() => {
    // In multi-fund split/by-fund views, stacked values are nominal,
    // so milestone dots must use nominal balance to align with stack top.
    const useNominal = hasManyFunds && stackView !== 'by-type';
    return milestones.map((m, i) => {
      const row = schedule.find((s) => s.year === m.year);
      const balance = (showReal && !useNominal) ? (row?.realEndBalance || 0) : (row?.endBalance || 0);
      // Must match chartData label format exactly
      const xLabel =
        timelineMode === 'retirement' && row?.age
          ? `${row.age}`
          : `${m.year}`;
      return {
        ...m,
        balance,
        xLabel,
        chevronCount: i + 1,
        label: `${m.label}`,
      };
    });
  }, [milestones, schedule, showReal, timelineMode, hasManyFunds, stackView]);

  // Compute a tick interval that shows ~10-15 labels max
  const tickInterval = useMemo(() => {
    const total = chartData.length;
    if (total <= 15) return 0; // show every tick
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
          {hasManyFunds && (
            <div className="relative group">
              <button className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-2 py-1 rounded-md transition-colors">
                {BAR_VIEW_LABELS[stackView]}
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[120px]">
                {(['split', 'by-fund', 'by-type'] as BarViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                      stackView === mode
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700'
                    }`}
                    onClick={() => setStackView(mode)}
                  >
                    {BAR_VIEW_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              className={`p-1.5 rounded-md transition-all ${chartMode === 'line' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('line')}
              title="Line chart"
            >
              <LineChart className="w-4 h-4" />
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
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} stackOffset="none">
              <defs>
                <linearGradient id="startGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_STARTING} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLOR_STARTING} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_CONTRIBUTIONS} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLOR_CONTRIBUTIONS} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_INTEREST} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={COLOR_INTEREST} stopOpacity={0.1} />
                </linearGradient>
                {hasManyFunds && stackView === 'split' && funds.map((fund) => {
                  const v = fundVariants(fund.color, darkMode);
                  return (
                    <Fragment key={fund.id}>
                      <linearGradient id={fundGradientId(fund.id, 'starting')} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={v.starting} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={v.starting} stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id={fundGradientId(fund.id, 'contrib')} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={v.contributions} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={v.contributions} stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id={fundGradientId(fund.id, 'interest')} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={v.interest} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={v.interest} stopOpacity={0.1} />
                      </linearGradient>
                    </Fragment>
                  );
                })}
              </defs>
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
              <Tooltip content={<ChartTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} darkMode={darkMode} barView={hasManyFunds ? stackView : undefined} />} />
              {hasManyFunds && stackView === 'split' ? (
                funds.map((fund) => {
                  const v = fundVariants(fund.color, darkMode);
                  return (
                    <Fragment key={fund.id}>
                      <Area type="monotone" dataKey={`fund_${fund.id}_starting`} stackId="stack" stroke={v.starting} strokeWidth={1.5} fill={`url(#${fundGradientId(fund.id, 'starting')})`} dot={false} />
                      <Area type="monotone" dataKey={`fund_${fund.id}_contrib`} stackId="stack" stroke={v.contributions} strokeWidth={1.5} fill={`url(#${fundGradientId(fund.id, 'contrib')})`} dot={false} />
                      <Area type="monotone" dataKey={`fund_${fund.id}_interest`} stackId="stack" stroke={v.interest} strokeWidth={1.5} fill={`url(#${fundGradientId(fund.id, 'interest')})`} dot={false} />
                    </Fragment>
                  );
                })
              ) : hasManyFunds && stackView === 'by-fund' ? (
                funds.map((fund) => (
                  <Area
                    key={fund.id}
                    type="monotone"
                    dataKey={`fund_${fund.id}`}
                    stackId="stack"
                    stroke={fund.color}
                    strokeWidth={1.5}
                    fill={fund.color}
                    fillOpacity={0.3}
                    dot={false}
                  />
                ))
              ) : (
                <>
                  <Area type="monotone" dataKey="startingBal" stackId="stack" stroke={COLOR_STARTING} strokeWidth={1.5} fill="url(#startGrad)" dot={false} />
                  <Area type="monotone" dataKey="contributions" stackId="stack" stroke={COLOR_CONTRIBUTIONS} strokeWidth={1.5} fill="url(#contribGrad)" dot={false} />
                  <Area type="monotone" dataKey="interest" stackId="stack" stroke={COLOR_INTEREST} strokeWidth={1.5} fill="url(#interestGrad)" dot={false} />
                </>
              )}
              {milestoneData.map((m) => (
                <ReferenceDot
                  key={m.amount}
                  x={m.xLabel}
                  y={m.balance}
                  r={4}
                  fill="#7dd3fc"
                  stroke="#7dd3fc"
                  strokeWidth={0}
                >
                  <Label content={<MilestoneLabel chevronCount={m.chevronCount} icon={m.icon} />} />
                </ReferenceDot>
              ))}
            </AreaChart>
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
              <Tooltip content={<ChartTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} darkMode={darkMode} barView={hasManyFunds ? stackView : undefined} />} />
              {hasManyFunds && stackView === 'split' ? (
                // stacked by fund, each split into starting/contributions/interest
                funds.map((fund, i) => {
                  const v = fundVariants(fund.color, darkMode);
                  const isLast = i === funds.length - 1;
                  return (
                    <Fragment key={fund.id}>
                      <Bar dataKey={`fund_${fund.id}_starting`} stackId="stack" fill={v.starting} />
                      <Bar dataKey={`fund_${fund.id}_contrib`} stackId="stack" fill={v.contributions} />
                      <Bar dataKey={`fund_${fund.id}_interest`} stackId="stack" fill={v.interest} radius={isLast ? [2, 2, 0, 0] : undefined} />
                    </Fragment>
                  );
                })
              ) : hasManyFunds && stackView === 'by-fund' ? (
                // stacked by fund (solid colors)
                funds.map((fund) => (
                  <Bar
                    key={fund.id}
                    dataKey={`fund_${fund.id}`}
                    stackId="stack"
                    fill={fund.color}
                    name={fund.name}
                    radius={fund.id === funds[funds.length - 1].id ? [2, 2, 0, 0] : undefined}
                  />
                ))
              ) : (
                // stacked by type: starting balance / contributions / interest
                <>
                  <Bar dataKey="startingBal" stackId="stack" fill={COLOR_STARTING} name="Starting Balance" />
                  <Bar dataKey="contributions" stackId="stack" fill={COLOR_CONTRIBUTIONS} name="Contributions" />
                  <Bar dataKey="interest" stackId="stack" fill={COLOR_INTEREST} name="Interest" radius={[2, 2, 0, 0]} />
                </>
              )}
              {milestoneData.map((m) => (
                <ReferenceDot
                  key={m.amount}
                  x={m.xLabel}
                  y={m.balance}
                  r={0}
                  fill="none"
                  stroke="none"
                >
                  <Label content={<MilestoneLabel chevronCount={m.chevronCount} icon={m.icon} />} />
                </ReferenceDot>
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
        {chartMode === 'line' ? (
          hasManyFunds && stackView === 'split' ? (
            <>
              {funds.map((f) => {
                const v = fundVariants(f.color, darkMode);
                return (
                  <div key={f.id} className="flex items-center gap-1.5">
                    <div className="flex">
                      <div className="w-3 h-0.5 rounded-l" style={{ backgroundColor: v.starting }} />
                      <div className="w-3 h-0.5" style={{ backgroundColor: v.contributions }} />
                      <div className="w-3 h-0.5 rounded-r" style={{ backgroundColor: v.interest }} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">{f.name}</span>
                  </div>
                );
              })}
              <span className="text-[10px] text-slate-400/70 dark:text-neutral-600">
                dark = starting · mid = contributions · light = interest
              </span>
            </>
          ) : hasManyFunds && stackView === 'by-fund' ? (
            funds.map((f) => <LegendItem key={f.id} color={f.color} label={f.name} type="line" />)
          ) : (
            <>
              <LegendItem color={COLOR_INTEREST} label="Interest" type="line" />
              <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" type="line" />
              <LegendItem color={COLOR_STARTING} label="Starting Balance" type="line" />
            </>
          )
        ) : hasManyFunds && stackView === 'split' ? (
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
        ) : hasManyFunds && stackView === 'by-fund' ? (
          funds.map((f) => <LegendItem key={f.id} color={f.color} label={f.name} type="square" />)
        ) : (
          <>
            <LegendItem color={COLOR_INTEREST} label="Interest" type="square" />
            <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" type="square" />
            <LegendItem color={COLOR_STARTING} label="Starting Balance" type="square" />
          </>
        )}
        {/* Milestones legend entries with distinct symbols */}
        {milestoneData.map((m) => (
          <div key={m.amount} className="flex items-center gap-1.5">
            {m.icon ? (
              <span className="text-sm leading-none">{m.icon}</span>
            ) : (
              <LegendChevrons count={m.chevronCount} />
            )}
            <span className="text-xs text-slate-400 dark:text-neutral-500">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    name: string;
    color: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  funds: Fund[];
  showReal: boolean;
  timelineMode: 'years' | 'retirement';
  darkMode: boolean;
  barView?: BarViewMode;
}

function ChartTooltip({ active, payload, label, funds, showReal, timelineMode, darkMode, barView }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as Record<string, number>;
  const balance = data?.balance ?? 0;
  const pct = (v: number) => balance > 0 ? `${Math.round(v / balance * 100)}%` : '—';

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg p-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 mb-2">
        {timelineMode === 'retirement' ? `Age ${label}` : `Year ${label}`}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-slate-600 dark:text-neutral-300">Total Balance</span>
          <span className="text-xs font-medium text-slate-900 dark:text-white">{formatCurrency(balance)}</span>
        </div>
        {funds.length > 1 ? (
          barView === 'split' ? (
            [...funds].reverse().map((f) => {
              const v = fundVariants(f.color, darkMode);
              const fundTotal = data?.[`fund_${f.id}`] ?? 0;
              return (
                <div key={f.id} className="space-y-0.5">
                  <div className="flex justify-between gap-4">
                    <span className="text-xs flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: f.color }} />
                      {f.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 tabular-nums">
                        {formatCurrency(fundTotal)}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(fundTotal)}</span>
                    </div>
                  </div>
                  <div className="ml-3.5 space-y-0.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: v.interest }} />
                        Interest
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums">
                          {formatCurrency(data?.[`fund_${f.id}_interest`] ?? 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.[`fund_${f.id}_interest`] ?? 0)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: v.contributions }} />
                        Contributions
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums">
                          {formatCurrency(data?.[`fund_${f.id}_contrib`] ?? 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.[`fund_${f.id}_contrib`] ?? 0)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: v.starting }} />
                        Starting
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums">
                          {formatCurrency(data?.[`fund_${f.id}_starting`] ?? 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.[`fund_${f.id}_starting`] ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : barView === 'by-fund' ? (
            [...funds].reverse().map((f) => {
              const val = data?.[`fund_${f.id}`] ?? 0;
              return (
                <div key={f.id} className="flex justify-between gap-4">
                  <span className="text-xs flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: f.color }} />
                    {f.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 tabular-nums">
                      {formatCurrency(val)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(val)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <TooltipByType data={data} pct={pct} />
          )
        ) : (
          <TooltipByType data={data} pct={pct} />
        )}
        {showReal && <p className="text-[10px] text-slate-400 dark:text-neutral-600 mt-1">In today's dollars</p>}
      </div>
    </div>
  );
}

function TooltipByType({ data, pct }: { data: Record<string, number>; pct: (v: number) => string }) {
  return (
    <>
      <div className="flex justify-between gap-4">
        <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_INTEREST }} />Interest</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-300 tabular-nums">{formatCurrency(data?.interest ?? 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.interest ?? 0)}</span>
        </div>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_CONTRIBUTIONS }} />Contributions</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-300 tabular-nums">{formatCurrency(data?.contributions ?? 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.contributions ?? 0)}</span>
        </div>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_STARTING }} />Starting Bal.</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-neutral-300 tabular-nums">{formatCurrency(data?.startingBal ?? 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.startingBal ?? 0)}</span>
        </div>
      </div>
    </>
  );
}
