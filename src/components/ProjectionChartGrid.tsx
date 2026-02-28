import { Fragment, useMemo, useState, useCallback, useRef } from 'react';
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
  ReferenceLine,
  ReferenceDot,
  Label,
} from 'recharts';
import { BarChart3, LineChart, Layers, LayoutGrid, ChevronDown } from 'lucide-react';
import { Strategy, ProjectionResult, Fund, ChartMode, ChartViewMode, YearBreakdown } from '../types';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, COLOR_DEBT, fundVariants } from '../utils/colors';
import LegendItem from './LegendItem';
import ProjectionChartComparison from './ProjectionChartComparison';

type CompareView = 'side-by-side' | 'overlay';
type BarViewMode = 'split' | 'by-fund' | 'by-type';

const BAR_VIEW_LABELS: Record<BarViewMode, string> = {
  split: 'Fund × Type',
  'by-fund': 'By Fund',
  'by-type': 'By Type',
};

function fundGradientId(strategyId: string, fundId: string, kind: 'starting' | 'contrib' | 'interest') {
  return `grad_${strategyId}_${fundId}_${kind}`;
}

interface ProjectionChartGridProps {
  strategies: Strategy[];
  allResults: Map<string, ProjectionResult>;
  showReal: boolean;
  inflationRate: number;
  timelineMode: 'years' | 'retirement';
  chartMode: ChartMode;
  viewMode: ChartViewMode;
  darkMode: boolean;
  onChartModeChange: (mode: ChartMode) => void;
  onViewModeChange: (mode: ChartViewMode) => void;
  showMilestones: boolean;
}

// Legend chevrons for the milestone legend row
function LegendChevrons({ count, color = '#7dd3fc' }: { count: number; color?: string }) {
  const clamped = Math.min(count, 7);
  const h = 4 + clamped * 5;
  return (
    <svg width="12" height={h} viewBox={`0 0 12 ${h}`} fill="none" className="flex-shrink-0">
      {Array.from({ length: clamped }).map((_, i) => (
        <polyline
          key={i}
          points={`1,${h - i * 5 - 1} 6,${h - i * 5 - 5} 11,${h - i * 5 - 1}`}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}

// Milestone label that renders stacked SVG chevrons or an emoji icon (using ProjectionChart implementation)
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

// Build chart data for one strategy (same logic as ProjectionChart)
function buildChartData(
  schedule: YearBreakdown[],
  funds: Fund[],
  showReal: boolean,
  inflationRate: number,
  timelineMode: 'years' | 'retirement',
) {
  const hasManyFunds = funds.length > 1;
  const cumFundContrib: Record<string, number> = {};
  const cumFundInterest: Record<string, number> = {};

  return schedule.map((row) => {
    const balance = showReal ? row.realEndBalance : row.endBalance;
    const label =
      timelineMode === 'retirement' && row.age ? `${row.age}` : `${row.year}`;
    const inflationFactor = showReal ? Math.pow(1 + inflationRate / 100, row.year) : 1;
    const contributions = showReal ? row.cumulativeContributions / inflationFactor : row.cumulativeContributions;
    const interest = showReal
      ? row.realEndBalance - row.cumulativeStartingBalance - contributions
      : row.cumulativeInterest;

    if (hasManyFunds) {
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
      const nwBreakdown = (() => {
        const nw = row.netWorth ?? balance;
        const totalAssets = balance;
        if (nw >= 0 && totalAssets > 0) {
          const s = row.cumulativeStartingBalance;
          const c = contributions;
          const i = interest;
          const ratio = nw / totalAssets;
          return { nw_starting: s * ratio, nw_contributions: c * ratio, nw_interest: i * ratio, nw_debt: 0 };
        }
        return { nw_starting: 0, nw_contributions: 0, nw_interest: 0, nw_debt: nw < 0 ? nw : 0 };
      })();

      return { label, year: row.year, balance, startingBal: row.cumulativeStartingBalance, contributions, interest, ...fundData, debtBalance: -(row.debtBalance || 0), netWorth: row.netWorth ?? balance, ...nwBreakdown };
    }
    return {
      label, year: row.year, balance, startingBal: row.cumulativeStartingBalance, contributions, interest, debtBalance: -(row.debtBalance || 0), netWorth: row.netWorth ?? balance, ...(() => {
        const nw = row.netWorth ?? balance;
        const totalAssets = balance;
        if (nw >= 0 && totalAssets > 0) {
          const s = row.cumulativeStartingBalance;
          const c = contributions;
          const i = interest;
          const ratio = nw / totalAssets;
          return { nw_starting: s * ratio, nw_contributions: c * ratio, nw_interest: i * ratio, nw_debt: 0 };
        }
        return { nw_starting: 0, nw_contributions: 0, nw_interest: 0, nw_debt: nw < 0 ? nw : 0 };
      })()
    };
  });
}

export default function ProjectionChartGrid({
  strategies,
  allResults,
  showReal,
  inflationRate,
  timelineMode,
  chartMode,
  viewMode,
  darkMode,
  onChartModeChange,
  onViewModeChange,
  showMilestones,
}: ProjectionChartGridProps) {
  const [compareView, setCompareView] = useState<CompareView>('side-by-side');
  const [stackView, setStackView] = useState<BarViewMode>('by-type');
  // Synced crosshair state: track which strategy is hovered and at which data index
  const [syncedIndex, setSyncedIndex] = useState<number | null>(null);
  const [hoveredStrategyId, setHoveredStrategyId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gridColor = darkMode ? '#404040' : '#cbd5e1';
  const tickColor = darkMode ? '#737373' : '#64748b';
  const axisColor = darkMode ? '#262626' : '#e2e8f0';

  // Pre-compute chart data for all strategies
  const allChartData = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const s of strategies) {
      const res = allResults.get(s.id);
      if (res) {
        map.set(s.id, buildChartData(res.schedule, s.funds, showReal, inflationRate, timelineMode));
      }
    }
    return map;
  }, [strategies, allResults, showReal, inflationRate, timelineMode]);

  // Compute global Y-axis max across all strategies
  const globalYMax = useMemo(() => {
    let max = 0;
    for (const data of allChartData.values()) {
      for (const row of data) {
        const bal = (row as Record<string, number>).balance ?? 0;
        if (bal > max) max = bal;
      }
    }
    // Add 10% headroom and round up to a nice number
    const headroom = max * 1.1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(headroom || 1)));
    return Math.ceil(headroom / magnitude) * magnitude;
  }, [allChartData]);

  // Tick interval
  const tickInterval = useMemo(() => {
    const maxLen = Math.max(...Array.from(allChartData.values()).map((d) => d.length));
    if (maxLen <= 15) return 0;
    return Math.ceil(maxLen / 12) - 1;
  }, [allChartData]);

  // Any strategy has many funds?
  const anyHasManyFunds = strategies.some((s) => s.funds.length > 1);
  const hasDebts = strategies.some((s) => (s.debts || []).some((d) => d.principal > 0));

  // Milestone data per strategy — chevronCounts are globally consistent and properly grouped by year
  const allMilestoneData = useMemo(() => {
    if (!showMilestones) return new Map<string, { xLabel: string; balance: number; milestones: any[] }[]>();

    // 1. Collect the global union of all milestones reached across any strategy
    const globalMilestones = new Map<number, { icon?: string; label: string; chevronCount?: number }>();
    for (const s of strategies) {
      const res = allResults.get(s.id);
      if (!res) continue;
      for (const m of res.milestones) {
        if (!globalMilestones.has(m.amount)) {
          globalMilestones.set(m.amount, { icon: m.icon, label: m.label, chevronCount: m.chevronCount });
        }
      }
    }

    // 2. Sort by amount and assign a global chevron index
    const sortedAmounts = [...globalMilestones.keys()].sort((a, b) => a - b);
    const chevronByAmount = new Map<number, number>();
    let standardCounter = 0;
    sortedAmounts.forEach((amount) => {
      const m = globalMilestones.get(amount);
      if (m?.chevronCount) {
        chevronByAmount.set(amount, m.chevronCount);
      } else if (!m?.icon) {
        standardCounter++;
        chevronByAmount.set(amount, standardCounter);
      }
    });

    // 3. Build per-strategy milestone data using global chevron counts
    const map = new Map<string, { xLabel: string; balance: number; milestones: any[] }[]>();
    for (const s of strategies) {
      const res = allResults.get(s.id);
      if (!res) continue;
      const hasManyFunds = s.funds.length > 1;
      const useNominal = hasManyFunds && stackView !== 'by-type';
      const calculated = res.milestones
        .map((m) => {
          const row = res.schedule.find((r) => r.year === m.year);
          let balance = 0;
          if (viewMode === 'networth') {
            const nominalNW = row?.netWorth ?? 0;
            const inflationFactor = showReal ? Math.pow(1 + inflationRate / 100, row?.year || 0) : 1;
            balance = showReal ? nominalNW / inflationFactor : nominalNW;
          } else {
            balance = showReal && !useNominal ? (row?.realEndBalance || 0) : (row?.endBalance || 0);
          }
          const xLabel = timelineMode === 'retirement' && row?.age ? `${row.age}` : `${m.year}`;
          return { ...m, amount: m.amount, xLabel, balance, chevronCount: chevronByAmount.get(m.amount) ?? 1, icon: m.icon, label: m.label, color: m.color || '#7dd3fc' };
        })
        .sort((a, b) => a.amount - b.amount);

      const grouped = new Map<string, typeof calculated>();
      for (const m of calculated) {
        if (!grouped.has(m.xLabel)) {
          grouped.set(m.xLabel, []);
        }
        grouped.get(m.xLabel)!.push(m);
      }

      const entries = Array.from(grouped.entries()).map(([xLabel, group]) => ({
        xLabel,
        balance: group[0].balance,
        milestones: group
      }));
      map.set(s.id, entries);
    }
    return map;
  }, [strategies, allResults, showMilestones, showReal, timelineMode, stackView, viewMode, inflationRate]);

  const handleMouseMove = useCallback((strategyId: string, e: { activeTooltipIndex?: number }) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (e?.activeTooltipIndex !== undefined && e.activeTooltipIndex >= 0) {
      setSyncedIndex(e.activeTooltipIndex);
      setHoveredStrategyId(strategyId);
    }
  }, []);
  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setSyncedIndex(null);
      setHoveredStrategyId(null);
    }, 50);
  }, []);

  // Which strategy has the highest value for each field at the currently synced index?
  const highestByField = useMemo(() => {
    const fields = ['balance', 'interest', 'contributions', 'startingBal'] as const;
    const result = new Map<string, Record<string, boolean>>();
    if (syncedIndex === null) return result;
    // Find the max value per field across strategies and ensure uniqueness (no ties)
    const EPS = 1e-6;
    const maxPerField: Record<string, number> = {};
    for (const f of fields) {
      maxPerField[f] = -Infinity;
    }
    for (const s of strategies) {
      const data = allChartData.get(s.id);
      if (!data || !data[syncedIndex]) continue;
      const row = data[syncedIndex] as Record<string, number>;
      for (const f of fields) {
        const val = row[f] ?? 0;
        if (val > maxPerField[f]) {
          maxPerField[f] = val;
        }
      }
    }
    // Count ties and assign only if unique max
    const countPerField: Record<string, number> = {};
    const idOfMax: Record<string, string> = {};
    for (const f of fields) {
      countPerField[f] = 0;
      idOfMax[f] = '';
    }
    for (const s of strategies) {
      const data = allChartData.get(s.id);
      if (!data || !data[syncedIndex]) continue;
      const row = data[syncedIndex] as Record<string, number>;
      for (const f of fields) {
        const val = row[f] ?? 0;
        if (Math.abs(val - maxPerField[f]) <= EPS) {
          countPerField[f] += 1;
          idOfMax[f] = s.id; // last matching id (only used if count==1)
        }
      }
    }
    // Build per-strategy boolean maps
    for (const s of strategies) {
      const flags: Record<string, boolean> = {};
      for (const f of fields) {
        flags[f] = countPerField[f] === 1 && idOfMax[f] === s.id;
      }
      result.set(s.id, flags);
    }
    return result;
  }, [syncedIndex, strategies, allChartData]);

  // Grid columns
  const gridCols =
    strategies.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : strategies.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';

  if (compareView === 'overlay') {
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
                className="p-1.5 rounded-md transition-all text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400 group relative"
                onClick={() => setCompareView('side-by-side')}
              >
                <LayoutGrid className="w-4 h-4" />
                <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Show each strategy in its own chart, side by side, with synced axes for easy comparison.</div>
              </button>
              <button
                className="p-1.5 rounded-md transition-all bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm group relative"
              >
                <Layers className="w-4 h-4" />
                <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Overlay all strategies on a single chart to directly compare their growth curves.</div>
              </button>
            </div>
            {/* Line / Bar toggle */}
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
        <ProjectionChartComparison
          strategies={strategies}
          allResults={allResults}
          showReal={showReal}
          inflationRate={inflationRate}
          timelineMode={timelineMode}
          chartMode={chartMode}
          darkMode={darkMode}
          viewMode={viewMode}
          onChartModeChange={onChartModeChange}
          hideHeader
          showMilestones={showMilestones}
        />
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
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
          {anyHasManyFunds && (
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
          {/* Side-by-side / Overlay toggle */}
          <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              className="p-1.5 rounded-md transition-all bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm group relative"
            >
              <LayoutGrid className="w-4 h-4" />
              <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Show each strategy in its own chart, side by side, with synced axes for easy comparison.</div>
            </button>
            <button
              className="p-1.5 rounded-md transition-all text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400 group relative"
              onClick={() => setCompareView('overlay')}
            >
              <Layers className="w-4 h-4" />
              <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">Overlay all strategies on a single chart to directly compare their growth curves.</div>
            </button>
          </div>
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
          {/* Line / Bar toggle */}
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

      {/* Side-by-side grid */}
      <div className={`grid ${gridCols} gap-4`}>
        {strategies.map((strategy) => {
          const chartData = allChartData.get(strategy.id) || [];
          const funds = strategy.funds;
          const hasManyFunds = funds.length > 1;
          const effectiveStackView = hasManyFunds ? stackView : 'by-type';
          const isHovered = hoveredStrategyId === strategy.id;
          const showOverlay = syncedIndex !== null && !isHovered && chartData[syncedIndex];

          return (
            <div
              key={strategy.id}
              className="rounded-lg p-3"
              style={{ backgroundColor: `${strategy.color}21`, border: `1px solid ${strategy.color}33` }}
            >
              {/* Strategy header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strategy.color }} />
                <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">{strategy.name}</span>
              </div>

              {/* Chart */}
              <div className="h-[260px] sm:h-[300px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'line' ? (
                    <AreaChart
                      data={chartData}
                      margin={{ top: 35, right: 10, left: 0, bottom: 0 }}
                      stackOffset="none"
                      onMouseMove={(e) => handleMouseMove(strategy.id, e)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <defs>
                        <linearGradient id={`startGrad_${strategy.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLOR_STARTING} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={COLOR_STARTING} stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id={`contribGrad_${strategy.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLOR_CONTRIBUTIONS} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={COLOR_CONTRIBUTIONS} stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id={`interestGrad_${strategy.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLOR_INTEREST} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={COLOR_INTEREST} stopOpacity={0.1} />
                        </linearGradient>
                        {hasManyFunds && effectiveStackView === 'split' && funds.map((fund) => {
                          const v = fundVariants(fund.color, darkMode);
                          return (
                            <Fragment key={fund.id}>
                              <linearGradient id={fundGradientId(strategy.id, fund.id, 'starting')} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={v.starting} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={v.starting} stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id={fundGradientId(strategy.id, fund.id, 'contrib')} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={v.contributions} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={v.contributions} stopOpacity={0.1} />
                              </linearGradient>
                              <linearGradient id={fundGradientId(strategy.id, fund.id, 'interest')} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={v.interest} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={v.interest} stopOpacity={0.1} />
                              </linearGradient>
                            </Fragment>
                          );
                        })}
                        {hasDebts && (
                          <linearGradient id={`debtGrad_${strategy.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={COLOR_DEBT} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={COLOR_DEBT} stopOpacity={0.1} />
                          </linearGradient>
                        )}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: tickColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: axisColor }}
                        interval={tickInterval}
                      />
                      <YAxis
                        tick={{ fill: tickColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCurrencyCompact(v)}
                        width={55}
                        domain={[0, globalYMax]}
                      />
                      <Tooltip
                        content={isHovered ? <GridTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} darkMode={darkMode} barView={hasManyFunds ? effectiveStackView : undefined} highestFields={highestByField.get(strategy.id)} /> : <></>}
                        cursor={isHovered ? { stroke: darkMode ? '#525252' : '#94a3b8', strokeDasharray: '3 3' } : { stroke: 'transparent' }}
                      />
                      {/* Synced crosshair from sibling chart – always mounted to avoid re-layout */}
                      <ReferenceLine
                        x={showOverlay && chartData[syncedIndex!] ? (chartData[syncedIndex!] as Record<string, unknown>).label as string : chartData[0] ? (chartData[0] as Record<string, unknown>).label as string : ''}
                        stroke={showOverlay ? (darkMode ? '#525252' : '#94a3b8') : 'transparent'}
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      {viewMode === 'networth' ? (
                        <>
                          <Area type="monotone" dataKey="nw_starting" stackId="nw" stroke={COLOR_STARTING} strokeWidth={1.5} fill={`url(#startGrad_${strategy.id})`} dot={false} />
                          <Area type="monotone" dataKey="nw_contributions" stackId="nw" stroke={COLOR_CONTRIBUTIONS} strokeWidth={1.5} fill={`url(#contribGrad_${strategy.id})`} dot={false} />
                          <Area type="monotone" dataKey="nw_interest" stackId="nw" stroke={COLOR_INTEREST} strokeWidth={1.5} fill={`url(#interestGrad_${strategy.id})`} dot={false} />
                          <Area type="monotone" dataKey="nw_debt" stackId="nw" stroke={COLOR_DEBT} strokeWidth={1.5} fill={`url(#debtGrad_${strategy.id})`} dot={false} />
                          <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                        </>
                      ) : (
                        <>
                          {hasManyFunds && effectiveStackView === 'split' ? (
                            funds.map((fund) => {
                              const v = fundVariants(fund.color, darkMode);
                              return (
                                <Fragment key={fund.id}>
                                  <Area type="monotone" dataKey={`fund_${fund.id}_starting`} stackId="stack" stroke={v.starting} strokeWidth={1.5} fill={`url(#${fundGradientId(strategy.id, fund.id, 'starting')})`} dot={false} />
                                  <Area type="monotone" dataKey={`fund_${fund.id}_contrib`} stackId="stack" stroke={v.contributions} strokeWidth={1.5} fill={`url(#${fundGradientId(strategy.id, fund.id, 'contrib')})`} dot={false} />
                                  <Area type="monotone" dataKey={`fund_${fund.id}_interest`} stackId="stack" stroke={v.interest} strokeWidth={1.5} fill={`url(#${fundGradientId(strategy.id, fund.id, 'interest')})`} dot={false} />
                                </Fragment>
                              );
                            })
                          ) : hasManyFunds && effectiveStackView === 'by-fund' ? (
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
                              <Area type="monotone" dataKey="startingBal" stackId="stack" stroke={COLOR_STARTING} strokeWidth={1.5} fill={`url(#startGrad_${strategy.id})`} dot={false} />
                              <Area type="monotone" dataKey="contributions" stackId="stack" stroke={COLOR_CONTRIBUTIONS} strokeWidth={1.5} fill={`url(#contribGrad_${strategy.id})`} dot={false} />
                              <Area type="monotone" dataKey="interest" stackId="stack" stroke={COLOR_INTEREST} strokeWidth={1.5} fill={`url(#interestGrad_${strategy.id})`} dot={false} />
                            </>
                          )}
                          {hasDebts && (
                            <Area type="monotone" dataKey="debtBalance" stackId="debt" stroke={COLOR_DEBT} strokeWidth={1.5} fill={`url(#debtGrad_${strategy.id})`} dot={false} />
                          )}
                          <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                        </>
                      )}
                      {(allMilestoneData.get(strategy.id) || []).map((group) => (
                        <ReferenceDot
                          key={group.xLabel}
                          x={group.xLabel}
                          y={group.balance}
                          r={4}
                          fill={group.milestones[0].color || '#7dd3fc'}
                          stroke="none"
                        >
                          <Label content={<MilestoneLabel milestones={group.milestones} />} />
                        </ReferenceDot>
                      ))}
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={chartData}
                      margin={{ top: 35, right: 10, left: 0, bottom: 0 }}
                      onMouseMove={(e) => handleMouseMove(strategy.id, e)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: tickColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: axisColor }}
                        interval={tickInterval}
                      />
                      <YAxis
                        tick={{ fill: tickColor, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatCurrencyCompact(v)}
                        width={55}
                        domain={[0, globalYMax]}
                      />
                      <Tooltip
                        content={isHovered ? <GridTooltip funds={funds} showReal={showReal} timelineMode={timelineMode} darkMode={darkMode} barView={hasManyFunds ? effectiveStackView : undefined} highestFields={highestByField.get(strategy.id)} /> : <></>}
                        cursor={isHovered ? undefined : { fill: 'transparent' }}
                      />
                      {/* Synced crosshair from sibling chart – always mounted to avoid re-layout */}
                      <ReferenceLine
                        x={showOverlay && chartData[syncedIndex!] ? (chartData[syncedIndex!] as Record<string, unknown>).label as string : chartData[0] ? (chartData[0] as Record<string, unknown>).label as string : ''}
                        stroke={showOverlay ? (darkMode ? '#525252' : '#94a3b8') : 'transparent'}
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      {viewMode === 'networth' ? (
                        <>
                          <Bar dataKey="nw_starting" stackId="nw" fill={COLOR_STARTING} name="Starting Balance" />
                          <Bar dataKey="nw_contributions" stackId="nw" fill={COLOR_CONTRIBUTIONS} name="Contributions" />
                          <Bar dataKey="nw_interest" stackId="nw" fill={COLOR_INTEREST} name="Interest" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="nw_debt" stackId="nw" fill={COLOR_DEBT} name="Debt" />
                          <ReferenceLine y={0} stroke={darkMode ? '#525252' : '#94a3b8'} strokeDasharray="4 3" />
                        </>
                      ) : (
                        <>
                          {hasManyFunds && effectiveStackView === 'split' ? (
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
                          ) : hasManyFunds && effectiveStackView === 'by-fund' ? (
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
                      {(allMilestoneData.get(strategy.id) || []).map((group) => (
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
                {/* Synced overlay tooltip for non-hovered charts */}
                {showOverlay && (
                  <SyncedOverlayTooltip
                    data={chartData[syncedIndex] as Record<string, number>}
                    dataLength={chartData.length}
                    index={syncedIndex}
                    funds={funds}
                    showReal={showReal}
                    timelineMode={timelineMode}
                    darkMode={darkMode}
                    barView={hasManyFunds ? effectiveStackView : undefined}
                    highestFields={highestByField.get(strategy.id)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
        {chartMode === 'line' ? (
          <>
            <LegendItem color={COLOR_INTEREST} label="Interest" type="line" />
            <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" type="line" />
            <LegendItem color={COLOR_STARTING} label="Starting Balance" type="line" />
          </>
        ) : (
          <>
            <LegendItem color={COLOR_INTEREST} label="Interest" type="square" />
            <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" type="square" />
            <LegendItem color={COLOR_STARTING} label="Starting Balance" type="square" />
          </>
        )}
        {/* Milestone legend entries */}
        {showMilestones && (() => {
          // Collect unique milestones by amount (deduped across strategies)
          const seen = new Set<string>();
          const entries: { amount: number; chevronCount: number; icon?: string; label: string }[] = [];
          for (const milestones of allMilestoneData.values()) {
            for (const group of milestones) {
              for (const m of group.milestones) {
                const key = (m.icon || m.inverted) ? m.label : m.amount.toString();
                if (!seen.has(key)) {
                  seen.add(key);
                  entries.push({ amount: m.amount, chevronCount: m.chevronCount, icon: m.icon, label: m.label });
                }
              }
            }
          }
          entries.sort((a, b) => a.amount - b.amount);
          return entries.map((m) => (
            <div key={m.amount} className="flex items-center gap-1.5">
              {m.icon ? (
                <span className="text-sm leading-none">{m.icon}</span>
              ) : (
                <LegendChevrons count={m.chevronCount} />
              )}
              <span className="text-xs text-slate-400 dark:text-neutral-500">{m.label}</span>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

// --- Synced Overlay Tooltip (rendered on non-hovered charts) ---
// Positioned using data index as percentage of chart width, accounting for chart margins + Y-axis
interface SyncedOverlayTooltipProps {
  data: Record<string, number>;
  dataLength: number;
  index: number;
  funds: Fund[];
  showReal: boolean;
  timelineMode: 'years' | 'retirement';
  darkMode: boolean;
  barView?: BarViewMode;
  highestFields?: Record<string, boolean>;
}

function SyncedOverlayTooltip({ data, dataLength, index, funds, showReal, timelineMode, barView, highestFields }: SyncedOverlayTooltipProps) {
  const balance = data?.balance ?? 0;
  const label = data?.label as unknown as string ?? '';
  const pct = (v: number) => (balance > 0 ? `${Math.round((v / balance) * 100)}%` : '—');

  // Approximate x position: chart has margin left ~0 + YAxis width ~55px, margin right ~10px
  // The plot area starts after the Y-axis and ends before right margin
  const yAxisWidth = 55;
  const marginRight = 10;
  const fraction = dataLength > 1 ? index / (dataLength - 1) : 0.5;

  // Determine if tooltip should flip to left side to avoid overflow
  const flipLeft = fraction > 0.7;

  return (
    <div
      className="absolute top-[10px] z-20 pointer-events-none"
      style={{
        left: `calc(${yAxisWidth}px + (100% - ${yAxisWidth + marginRight}px) * ${fraction})`,
        transform: flipLeft ? 'translateX(-100%)' : 'translateX(0)',
      }}
    >
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg p-2.5 shadow-xl min-w-[160px]">
        <p className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 mb-1.5">
          {timelineMode === 'retirement' ? `Age ${label}` : `Year ${label}`}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-[11px] text-slate-600 dark:text-neutral-300">Total</span>
            <span className={`text-[11px] font-medium tabular-nums ${highestFields?.balance ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(balance)}</span>
          </div>
          {funds.length > 1 && barView === 'by-fund' ? (
            [...funds].reverse().map((f) => {
              const val = data?.[`fund_${f.id}`] ?? 0;
              return (
                <div key={f.id} className="flex justify-between gap-3">
                  <span className="text-[10px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: f.color }} />
                    {f.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums">{formatCurrency(val)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[28px] text-right">{pct(val)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-[10px] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: COLOR_INTEREST }} />Interest</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] tabular-nums ${highestFields?.interest ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-neutral-400'}`}>{formatCurrency(data?.interest ?? 0)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[28px] text-right">{pct(data?.interest ?? 0)}</span>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[10px] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: COLOR_CONTRIBUTIONS }} />Contributions</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] tabular-nums ${highestFields?.contributions ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-neutral-400'}`}>{formatCurrency(data?.contributions ?? 0)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[28px] text-right">{pct(data?.contributions ?? 0)}</span>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[10px] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: COLOR_STARTING }} />Starting</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] tabular-nums ${highestFields?.startingBal ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-neutral-400'}`}>{formatCurrency(data?.startingBal ?? 0)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[28px] text-right">{pct(data?.startingBal ?? 0)}</span>
                </div>
              </div>
            </>
          )}
          {showReal && <p className="text-[9px] text-slate-400 dark:text-neutral-600 mt-0.5">In today's dollars</p>}
        </div>
      </div>
    </div>
  );
}

// --- Grid Tooltip (same as ProjectionChart's ChartTooltip) ---
interface GridTooltipProps {
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
  highestFields?: Record<string, boolean>;
}

function GridTooltip({ active, payload, label, funds, showReal, timelineMode, darkMode, barView, highestFields }: GridTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as Record<string, number>;
  const balance = data?.balance ?? 0;
  const pct = (v: number) => (balance > 0 ? `${Math.round((v / balance) * 100)}%` : '—');

  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg p-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 mb-2">
        {timelineMode === 'retirement' ? `Age ${label}` : `Year ${label}`}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-slate-600 dark:text-neutral-300">Total Balance</span>
          <span className={`text-xs font-medium ${highestFields?.balance ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(balance)}</span>
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
                      <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 tabular-nums">{formatCurrency(fundTotal)}</span>
                      <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(fundTotal)}</span>
                    </div>
                  </div>
                  <div className="ml-3.5 space-y-0.5">
                    {[
                      { lbl: 'Interest', key: `fund_${f.id}_interest`, color: v.interest },
                      { lbl: 'Contributions', key: `fund_${f.id}_contrib`, color: v.contributions },
                      { lbl: 'Starting', key: `fund_${f.id}_starting`, color: v.starting },
                    ].map((item) => (
                      <div key={item.key} className="flex justify-between gap-4">
                        <span className="text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
                          {item.lbl}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums">{formatCurrency(data?.[item.key] ?? 0)}</span>
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.[item.key] ?? 0)}</span>
                        </div>
                      </div>
                    ))}
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
                    <span className="text-xs font-medium text-slate-600 dark:text-neutral-300 tabular-nums">{formatCurrency(val)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(val)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <TooltipByType data={data} pct={pct} highestFields={highestFields} />
          )
        ) : (
          <TooltipByType data={data} pct={pct} highestFields={highestFields} />
        )}
        {showReal && <p className="text-[10px] text-slate-400 dark:text-neutral-600 mt-1">In today's dollars</p>}
      </div>
    </div>
  );
}

function TooltipByType({ data, pct, highestFields }: { data: Record<string, number>; pct: (v: number) => string; highestFields?: Record<string, boolean> }) {
  return (
    <>
      <div className="flex justify-between gap-4">
        <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_INTEREST }} />Interest</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${highestFields?.interest ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{formatCurrency(data?.interest ?? 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.interest ?? 0)}</span>
        </div>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_CONTRIBUTIONS }} />Contributions</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${highestFields?.contributions ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{formatCurrency(data?.contributions ?? 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.contributions ?? 0)}</span>
        </div>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-xs flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: COLOR_STARTING }} />Starting Bal.</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${highestFields?.startingBal ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-neutral-300'}`}>{formatCurrency(data?.startingBal ?? 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 tabular-nums w-[32px] text-right">{pct(data?.startingBal ?? 0)}</span>
        </div>
      </div>
    </>
  );
}
