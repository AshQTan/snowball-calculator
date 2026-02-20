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
  ReferenceLine,
  Label,
} from 'recharts';
import { BarChart3, LineChart, ChevronDown } from 'lucide-react';
import { YearBreakdown, Fund, Debt, Milestone, ChartMode, ChartViewMode } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, COLOR_DEBT, COLOR_NETWORTH, fundVariants } from '../utils/colors';
import LegendItem from './LegendItem';

interface ProjectionChartProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  debts: Debt[];
  milestones: Milestone[];
  showReal: boolean;
  inflationRate: number;
  timelineMode: 'years' | 'retirement';
  chartMode: ChartMode;
  viewMode: ChartViewMode;
  darkMode: boolean;
  onChartModeChange: (mode: ChartMode) => void;
  onViewModeChange: (mode: ChartViewMode) => void;
}

// Custom ReferenceDot label that renders stacked SVG chevrons or an emoji icon
function MilestoneLabel(props: { viewBox?: { x: number; y: number; width?: number; height?: number }; milestones?: any[] }) {
  const { viewBox, milestones } = props;
  if (!viewBox || !milestones || milestones.length === 0) return null;
  const cx = viewBox.width != null && viewBox.width > 0 ? viewBox.x + viewBox.width / 2 : viewBox.x;
  const cy = viewBox.height != null && viewBox.height > 0 ? viewBox.y + viewBox.height / 2 : viewBox.y;

  let currentBottomY = cy - 14;
  const gap = 8;

  return (
    <g>
      {milestones.map((m, mIdx) => {
        const color = m.color || '#7dd3fc';
        if (m.icon) {
          const y = currentBottomY;
          currentBottomY -= (14 + gap);
          return (
            <text key={mIdx} x={cx} y={y} textAnchor="middle" fontSize="14" dominantBaseline="auto" fill={color}>
              {m.icon}
            </text>
          );
        }

        const maxChevrons = 5;
        const clamped = Math.min(m.chevronCount || 1, maxChevrons);
        const spacing = 6;
        // Height from bottom chevron to top chevron
        const stackHeight = (clamped - 1) * spacing + 4;

        const element = (
          <g key={mIdx}>
            {Array.from({ length: clamped }).map((_, i) => {
              const offset = (clamped - 1 - i) * spacing;
              const yPos = currentBottomY - offset;
              return (
                <polyline
                  key={i}
                  points={m.inverted
                    ? `${cx - 5},${yPos} ${cx},${yPos + 4} ${cx + 5},${yPos}`
                    : `${cx - 5},${yPos + 4} ${cx},${yPos} ${cx + 5},${yPos + 4}`
                  }
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              );
            })}
          </g>
        );
        currentBottomY -= (stackHeight + gap);
        return element;
      })}
    </g>
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
  debts,
  milestones,
  showReal,
  inflationRate,
  timelineMode,
  chartMode,
  viewMode,
  darkMode,
  onChartModeChange,
  onViewModeChange,
}: ProjectionChartProps) {
  const hasManyFunds = funds.length > 1;
  const hasDebts = debts.some((d) => d.principal > 0);
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

      const startingBal = row.cumulativeStartingBalance / inflationFactor;
      const contributions = showReal ? row.realCumulativeContributions : row.cumulativeContributions;
      const interest = showReal ? (balance - startingBal - contributions) : row.cumulativeInterest;

      // Calculate real vs nominal Debt & Net Worth
      const nominalDebt = row.debtBalance || 0;
      const nominalNw = row.netWorth ?? balance;
      const adjustedDebt = nominalDebt / inflationFactor;
      const adjustedNw = nominalNw / inflationFactor;

      // Shared function for proportional NW breakdown
      const getProportionalNW = () => {
        const nw = adjustedNw;
        const totalAssets = balance;
        if (nw >= 0 && totalAssets > 0) {
          const ratio = nw / totalAssets;
          return { nw_starting: startingBal * ratio, nw_contributions: contributions * ratio, nw_interest: interest * ratio, nw_debt: 0 };
        }
        return { nw_starting: 0, nw_contributions: 0, nw_interest: 0, nw_debt: nw < 0 ? nw : 0 };
      };

      if (hasManyFunds) {
        // Accumulate per-fund contributions and interest
        for (const f of funds) {
          cumFundContrib[f.id] = (cumFundContrib[f.id] || 0) + (row.fundContributions[f.id] || 0);
          cumFundInterest[f.id] = (cumFundInterest[f.id] || 0) + (row.fundInterest[f.id] || 0);
        }
        const fundData: Record<string, number> = {};
        for (const f of funds) {
          const fundStarting = f.startingBalance / inflationFactor;
          const fundContrib = showReal ? (row.realFundContributions[f.id] || 0) : (cumFundContrib[f.id] || 0);
          const fundBal = (row.fundBalances[f.id] || 0) / inflationFactor;
          const fundInterest = showReal ? (fundBal - fundStarting - fundContrib) : (cumFundInterest[f.id] || 0);

          fundData[`fund_${f.id}`] = fundBal;
          fundData[`fund_${f.id}_starting`] = fundStarting;
          fundData[`fund_${f.id}_contrib`] = fundContrib;
          fundData[`fund_${f.id}_interest`] = fundInterest;
        }
        return {
          label,
          year: row.year,
          balance,
          startingBal,
          contributions,
          interest,
          ...fundData,
          debtBalance: -adjustedDebt,
          netWorth: adjustedNw,
          ...getProportionalNW(),
        };
      } else {
        // single fund: stacked by starting balance / contributions / interest
        return {
          label,
          year: row.year,
          balance,
          startingBal,
          contributions,
          interest,
          debtBalance: -adjustedDebt,
          netWorth: adjustedNw,
          ...getProportionalNW(),
        };
      }
    });
  }, [schedule, funds, showReal, inflationRate, timelineMode, hasManyFunds]);

  const milestoneData = useMemo(() => {
    // First, process all milestones to calculate their properties
    const calculated = milestones.map((m) => {
      const row = schedule.find((s) => s.year === m.year);

      // Determine Y value based on view mode and what the milestone represents
      let balance = 0;
      if (viewMode === 'networth') {
        const nominalNW = row?.netWorth ?? 0;
        balance = showReal ? (nominalNW / (row ? Math.pow(1 + inflationRate / 100, row.year) : 1)) : nominalNW;
      } else {
        balance = showReal ? (row?.realEndBalance || 0) : (row?.endBalance || 0);
      }
      // Must match chartData label format exactly
      const xLabel =
        timelineMode === 'retirement' && row?.age
          ? `${row.age}`
          : `${m.year}`;
      return {
        ...m,
        balance,
        xLabel,
        chevronCount: m.chevronCount || (milestones.filter(x => !x.chevronCount && !x.icon && x.amount < m.amount).length + 1),
        label: `${m.label}`,
        color: m.color,
        inverted: m.inverted,
      };
    });

    // Group by xLabel (Year/Age)
    const grouped = new Map<string, typeof calculated>();
    for (const m of calculated) {
      if (!grouped.has(m.xLabel)) {
        grouped.set(m.xLabel, []);
      }
      grouped.get(m.xLabel)!.push(m);
    }

    // Convert map to array of groups for rendering
    return Array.from(grouped.entries()).map(([xLabel, group]) => ({
      xLabel,
      balance: group[0].balance, // All milestones in same year share same chart Y position
      milestones: group
    }));
  }, [milestones, schedule, showReal, timelineMode, viewMode, inflationRate]);

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
                    className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${stackView === mode
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
          {hasDebts && (
            <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 text-[11px]">
              <button
                className={`px-2 py-1 rounded-md font-medium transition-all ${viewMode === 'assets' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                onClick={() => onViewModeChange('assets')}
              >Assets</button>
              <button
                className={`px-2 py-1 rounded-md font-medium transition-all ${viewMode === 'networth' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                onClick={() => onViewModeChange('networth')}
              >Net Worth</button>
            </div>
          )}
          <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              className={`p-1.5 rounded-md transition-all group relative ${chartMode === 'line' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('line')}
            >
              <LineChart className="w-4 h-4" />
              <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Display as a smooth line/area chart showing growth trends over time.</div>
            </button>
            <button
              className={`p-1.5 rounded-md transition-all group relative ${chartMode === 'bar' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('bar')}
            >
              <BarChart3 className="w-4 h-4" />
              <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Display as stacked bars showing the composition of each year's balance.</div>
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

                {hasDebts && (
                  <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR_DEBT} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={COLOR_DEBT} stopOpacity={0.1} />
                  </linearGradient>
                )}
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
              <Tooltip content={<ChartTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} darkMode={darkMode} barView={hasManyFunds ? stackView : undefined} viewMode={viewMode} />} />
              {viewMode === 'networth' ? (
                <>
                  <Area type="monotone" dataKey="nw_starting" stackId="nw" stroke={COLOR_STARTING} strokeWidth={1.5} fill="url(#startGrad)" dot={false} />
                  <Area type="monotone" dataKey="nw_contributions" stackId="nw" stroke={COLOR_CONTRIBUTIONS} strokeWidth={1.5} fill="url(#contribGrad)" dot={false} />
                  <Area type="monotone" dataKey="nw_interest" stackId="nw" stroke={COLOR_INTEREST} strokeWidth={1.5} fill="url(#interestGrad)" dot={false} />
                  <Area type="monotone" dataKey="nw_debt" stackId="debt" stroke={COLOR_DEBT} strokeWidth={1.5} fill="url(#debtGrad)" dot={false} />
                  <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                </>
              ) : (
                <>
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
                  {hasDebts && (
                    <Area type="monotone" dataKey="debtBalance" stackId="debt" stroke={COLOR_DEBT} strokeWidth={1.5} fill="url(#debtGrad)" dot={false} />
                  )}
                  <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                </>
              )}
              {milestoneData.map((group) => (
                <ReferenceDot
                  key={group.xLabel}
                  x={group.xLabel}
                  y={group.balance}
                  r={4}
                  fill={group.milestones[0].color || '#7dd3fc'} // Use color of first milestone for the dot
                  stroke="none"
                >
                  <Label content={<MilestoneLabel milestones={group.milestones} />} />
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
              <Tooltip content={<ChartTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} darkMode={darkMode} barView={hasManyFunds ? stackView : undefined} viewMode={viewMode} />} />
              {viewMode === 'networth' ? (
                <>
                  <Bar dataKey="nw_starting" stackId="nw" fill={COLOR_STARTING} name="Starting Balance" />
                  <Bar dataKey="nw_contributions" stackId="nw" fill={COLOR_CONTRIBUTIONS} name="Contributions" />
                  <Bar dataKey="nw_interest" stackId="nw" fill={COLOR_INTEREST} name="Interest" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="nw_debt" stackId="debt" fill={COLOR_DEBT} name="Debt" />
                  <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                </>
              ) : (
                <>
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
                  {hasDebts && (
                    <Bar dataKey="debtBalance" stackId="debt" fill={COLOR_DEBT} name="Debt" />
                  )}
                  <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                </>
              )}
              {milestoneData.map((group) => (
                <ReferenceDot
                  key={group.xLabel}
                  x={group.xLabel}
                  y={group.balance}
                  r={0}
                  fill="none"
                  stroke="none"
                >
                  <Label content={<MilestoneLabel milestones={group.milestones} />} />
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

        {hasDebts && (
          <LegendItem color={COLOR_DEBT} label="Debt" type={chartMode === 'line' ? 'line' : 'square'} />
        )}
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
  viewMode?: ChartViewMode;
}

function ChartTooltip({ active, payload, label, funds, showReal, timelineMode, darkMode, barView, viewMode }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as Record<string, number>;
  const balance = data?.balance ?? 0;
  const pct = (v: number) => balance > 0 ? `${Math.round(v / balance * 100)}%` : '—';
  const showNetWorthData = viewMode === 'networth' || (data?.debtBalance ?? 0) !== 0;

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
        {showNetWorthData && (
          <>
            <div className="border-t border-slate-100 dark:border-neutral-800 my-1 pt-1" />
            <div className="flex justify-between gap-4">
              <span className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_DEBT }} />
                Debt Balance
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 tabular-nums">
                {formatCurrency(Math.abs(data?.debtBalance ?? 0))}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs flex items-center gap-1">
                <span className="w-2 h-0.5 border-t-2 border-dashed inline-block" style={{ borderColor: COLOR_NETWORTH }} />
                Net Worth
              </span>
              <span className="text-xs font-medium tabular-nums" style={{ color: (data?.netWorth ?? 0) >= 0 ? COLOR_NETWORTH : COLOR_DEBT }}>
                {formatCurrency(data?.netWorth ?? 0)}
              </span>
            </div>
          </>
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
