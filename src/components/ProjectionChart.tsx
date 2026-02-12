import { useMemo } from 'react';
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
import { BarChart3, LineChart } from 'lucide-react';
import { YearBreakdown, Fund, Milestone, ChartMode } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';

interface ProjectionChartProps {
  schedule: YearBreakdown[];
  funds: Fund[];
  milestones: Milestone[];
  showReal: boolean;
  timelineMode: 'years' | 'retirement';
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
}

// Custom ReferenceDot label that renders stacked SVG chevrons
function ChevronLabel(props: { viewBox?: { x: number; y: number; width?: number; height?: number }; chevronCount?: number }) {
  const { viewBox, chevronCount = 1 } = props;
  if (!viewBox) return null;
  // viewBox may be a bounding box {x, y, width, height} — compute center
  const cx = viewBox.width ? viewBox.x + viewBox.width / 2 : viewBox.x;
  const cy = viewBox.height ? viewBox.y + viewBox.height / 2 : viewBox.y;
  const clamped = Math.min(chevronCount, 7);
  const spacing = 6;
  // Position chevrons directly above the dot marker
  const startY = cy - 14 - (clamped - 1) * spacing;
  return (
    <g>
      {Array.from({ length: clamped }).map((_, i) => (
        <polyline
          key={i}
          points={`${cx - 5},${startY + i * spacing + 4} ${cx},${startY + i * spacing} ${cx + 5},${startY + i * spacing + 4}`}
          stroke="#fbbf24"
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
          stroke="#fbbf24"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}

// Distinct colors for single-fund breakdown
const COLOR_STARTING = '#6366f1'; // indigo
const COLOR_CONTRIBUTIONS = '#22c55e'; // green
const COLOR_INTEREST = '#f59e0b'; // amber

export default function ProjectionChart({
  schedule,
  funds,
  milestones,
  showReal,
  timelineMode,
  chartMode,
  onChartModeChange,
}: ProjectionChartProps) {
  const hasManyFunds = funds.length > 1;

  const chartData = useMemo(() => {
    return schedule.map((row) => {
      const balance = showReal ? row.realEndBalance : row.endBalance;
      const label =
        timelineMode === 'retirement' && row.age
          ? `${row.age}`
          : `${row.year}`;

      if (hasManyFunds) {
        // stacked by fund: each fund's balance for bar chart
        const fundData: Record<string, number> = {};
        for (const f of funds) {
          fundData[`fund_${f.id}`] = row.fundBalances[f.id] || 0;
        }
        return {
          label,
          year: row.year,
          balance,
          contributions: showReal ? row.cumulativeContributions / Math.pow(1.03, row.year) : row.cumulativeContributions,
          startingBal: row.cumulativeStartingBalance,
          ...fundData,
        };
      } else {
        // single fund: stacked by starting balance / contributions / interest
        return {
          label,
          year: row.year,
          balance,
          startingBal: row.cumulativeStartingBalance,
          contributions: showReal ? row.cumulativeContributions / Math.pow(1.03, row.year) : row.cumulativeContributions,
          interest: showReal ? row.realEndBalance - row.cumulativeStartingBalance - row.cumulativeContributions / Math.pow(1.03, row.year) : row.cumulativeInterest,
        };
      }
    });
  }, [schedule, funds, showReal, timelineMode, hasManyFunds]);

  const milestoneData = useMemo(() => {
    return milestones.map((m, i) => {
      const row = schedule.find((s) => s.year === m.year);
      const balance = showReal ? (row?.realEndBalance || 0) : (row?.endBalance || 0);
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
  }, [milestones, schedule, showReal, timelineMode]);

  // Compute a tick interval that shows ~10-15 labels max
  const tickInterval = useMemo(() => {
    const total = chartData.length;
    if (total <= 15) return 0; // show every tick
    return Math.ceil(total / 12) - 1;
  }, [chartData]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
          Projection
        </h2>
        <div className="flex items-center gap-2">
          {showReal && (
            <span className="text-[10px] text-orange-400/80 bg-orange-900/20 px-2 py-0.5 rounded-md">
              Inflation-adjusted
            </span>
          )}
          <div className="flex bg-neutral-800 rounded-lg p-0.5">
            <button
              className={`p-1.5 rounded-md transition-all ${chartMode === 'line' ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500 hover:text-neutral-400'}`}
              onClick={() => onChartModeChange('line')}
              title="Line chart"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              className={`p-1.5 rounded-md transition-all ${chartMode === 'bar' ? 'bg-neutral-700 text-neutral-200' : 'text-neutral-500 hover:text-neutral-400'}`}
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
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#737373', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#737373', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v)}
                width={70}
              />
              <Tooltip content={<ChartTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} />} />
              {hasManyFunds ? (
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
                  fill="#fbbf24"
                  stroke="#fbbf24"
                  strokeWidth={0}
                >
                  <Label content={<ChevronLabel chevronCount={m.chevronCount} />} />
                </ReferenceDot>
              ))}
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#737373', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#262626' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#737373', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v)}
                width={70}
              />
              <Tooltip content={<ChartTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} />} />
              {hasManyFunds ? (
                // stacked by fund
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
                  <Label content={<ChevronLabel chevronCount={m.chevronCount} />} />
                </ReferenceDot>
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
        {chartMode === 'line' ? (
          hasManyFunds ? (
            funds.map((f) => <LegendItem key={f.id} color={f.color} label={f.name} />)
          ) : (
            <>
              <LegendItem color={COLOR_STARTING} label="Starting Balance" />
              <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" />
              <LegendItem color={COLOR_INTEREST} label="Interest" />
            </>
          )
        ) : hasManyFunds ? (
          funds.map((f) => <LegendItem key={f.id} color={f.color} label={f.name} type="square" />)
        ) : (
          <>
            <LegendItem color={COLOR_STARTING} label="Starting Balance" type="square" />
            <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" type="square" />
            <LegendItem color={COLOR_INTEREST} label="Interest" type="square" />
          </>
        )}
        {/* Milestones legend entries with distinct symbols */}
        {milestoneData.map((m) => (
          <div key={m.amount} className="flex items-center gap-1.5">
            <LegendChevrons count={m.chevronCount} />
            <span className="text-xs text-neutral-500">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendItem({ color, label, type = 'line' }: { color: string; label: string; type?: 'line' | 'square' }) {
  return (
    <div className="flex items-center gap-1.5">
      {type === 'line' ? (
        <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      ) : (
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      )}
      <span className="text-xs text-neutral-500">{label}</span>
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
}

function ChartTooltip({ active, payload, label, funds, showReal, timelineMode }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as Record<string, number>;
  const balance = data?.balance ?? 0;

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-medium text-neutral-400 mb-2">
        {timelineMode === 'retirement' ? `Age ${label}` : `Year ${label}`}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-neutral-300">Total Balance</span>
          <span className="text-xs font-medium text-white">{formatCurrency(balance)}</span>
        </div>
        {funds.length > 1 ? (
          funds.map((f) => (
            <div key={f.id} className="flex justify-between gap-4">
              <span className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: f.color }} />
                {f.name}
              </span>
              <span className="text-xs font-medium text-neutral-300">
                {formatCurrency(data?.[`fund_${f.id}`] ?? 0)}
              </span>
            </div>
          ))
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_STARTING }} />Starting Bal.</span>
              <span className="text-xs text-neutral-300">{formatCurrency(data?.startingBal ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_CONTRIBUTIONS }} />Contributions</span>
              <span className="text-xs text-neutral-300">{formatCurrency(data?.contributions ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_INTEREST }} />Interest</span>
              <span className="text-xs text-neutral-300">{formatCurrency(data?.interest ?? 0)}</span>
            </div>
          </>
        )}
        {showReal && <p className="text-[10px] text-neutral-600 mt-1">In today's dollars</p>}
      </div>
    </div>
  );
}
