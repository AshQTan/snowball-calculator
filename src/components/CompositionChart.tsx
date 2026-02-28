import { useState, useMemo } from 'react';
import { YearBreakdown, Fund, Strategy, ProjectionResult, Debt } from '../types';
import { formatPercent, formatCurrency } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, COLOR_DEBT } from '../utils/colors';
import LegendItem from './LegendItem';
import { ChevronDown } from 'lucide-react';

interface CompositionChartProps {
    schedule: YearBreakdown[];
    funds: Fund[];
    debts?: Debt[];
    initialDebt?: number;
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
    'by-fund': 'Detailed',
};

export default function CompositionChart({
    schedule,
    funds,
    debts = [],
    initialDebt = 0,
    darkMode,
    timelineMode,
    strategies,
    activeStrategyId,
    allResults,
    onSwitchStrategy,
}: CompositionChartProps) {
    const [selectedYear, setSelectedYear] = useState(schedule.length);
    const [compView, setCompView] = useState<CompView>('combined');

    // --- Fix #1 & #5: hasDebts drives ALL debt section visibility ---
    const hasDebts = debts.length > 0;
    const hasManyFunds = funds.length > 1;

    // Fix #5: Show toggle when active strategy OR any other strategy has multi-fund/debt
    const anyStrategyHasDetail = useMemo(() => {
        if (hasManyFunds || hasDebts) return true;
        if (!strategies || !allResults) return false;
        return strategies.some(s => s.funds.length > 1 || (s.debts && s.debts.length > 0));
    }, [hasManyFunds, hasDebts, strategies, allResults]);

    const clampedYear = Math.min(Math.max(selectedYear, 1), schedule.length);
    const row = schedule[clampedYear - 1];

    const data = useMemo(() => {
        if (!row) return { pctStart: 0, pctContrib: 0, pctInterest: 0, total: 0, startVal: 0, contribVal: 0, interestVal: 0, debtTotal: 0 };
        return {
            pctStart: row.pctStartingBalance,
            pctContrib: row.pctContributions,
            pctInterest: row.pctInterest,
            total: row.endBalance,
            startVal: row.cumulativeStartingBalance,
            contribVal: row.cumulativeContributions,
            interestVal: row.cumulativeInterest,
            debtTotal: row.debtBalance || 0,
        };
    }, [row]);

    // Per-fund cumulative data up to the selected year
    const fundData = useMemo(() => {
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
                pctStart: total > 0 ? (startVal / total) * 100 : 0,
                pctContrib: total > 0 ? (cumContrib / total) * 100 : 0,
                pctInterest: total > 0 ? (cumInterest / total) * 100 : 0,
            };
        });
    }, [funds, schedule, clampedYear, row]);

    // --- Fix #4: Per-debt data with initial principal track ---
    const debtData = useMemo(() => {
        if (!hasDebts || !row) return [];
        return debts.map(d => {
            const balance = row.debtBalances?.[d.id] || 0;
            const initial = d.principal;
            const effectiveInitial = initial > 0 ? initial : balance;
            const paid = Math.max(0, effectiveInitial - balance);
            return {
                debt: d,
                balance,
                initial: effectiveInitial,
                paid,
                pctOfTotal: (row.debtBalance || 0) > 0 ? (balance / (row.debtBalance || 1)) * 100 : 0,
                // What fraction of initial is remaining vs paid
                pctRemaining: effectiveInitial > 0 ? (Math.min(balance, effectiveInitial) / effectiveInitial) * 100 : 0,
                pctPaid: effectiveInitial > 0 ? (paid / effectiveInitial) * 100 : 0,
            };
        }).sort((a, b) => b.balance - a.balance);
    }, [debts, row, hasDebts]);

    // Scale for detailed view: max among all funds and debts (against the initial, not current)
    const maxBarValue = useMemo(() => {
        if (compView !== 'by-fund') return 1;
        const maxFund = fundData.length > 0 ? Math.max(...fundData.map(f => f.total)) : 0;
        // Use effectiveInitial as the ceiling for debt bars so paid-off portion is visible
        const maxDebt = debtData.length > 0 ? Math.max(...debtData.map(d => d.initial)) : 0;
        return Math.max(maxFund, maxDebt, 1);
    }, [fundData, debtData, compView]);

    // --- Fix #3: Stable combined debt breakdown always has 3 values ---
    const combinedDebtBreakdown = useMemo(() => {
        if (!hasDebts) return null;
        const current = data.debtTotal;
        const effectiveInitial = initialDebt > 0 ? initialDebt : current;
        const basis = Math.max(effectiveInitial, current);
        const remainingVal = Math.min(current, effectiveInitial);
        // Interest accumulating = portion of current balance above initial (debt grew)
        const accrualVal = Math.max(0, current - effectiveInitial);
        const paidVal = Math.max(0, effectiveInitial - current);

        const pctRemaining = basis > 0 ? (remainingVal / basis) * 100 : 0;
        const pctAccrual = basis > 0 ? (accrualVal / basis) * 100 : 0;
        const pctPaid = basis > 0 ? (paidVal / basis) * 100 : 0;

        return { current, effectiveInitial, remainingVal, accrualVal, paidVal, pctRemaining, pctAccrual, pctPaid };
    }, [hasDebts, data.debtTotal, initialDebt]);

    const colorPaid = darkMode ? '#34d399' : '#10b981';

    const yearLabel = timelineMode === 'retirement' && row?.age
        ? `Age ${row.age}`
        : `Year ${row?.year ?? (clampedYear - 1)}`;

    // Fix #7: scorecard conditions — use hasDebts uniformly
    const showDebtScorecards = hasDebts;
    const debtChange = (row?.totalDebtPayment || 0) - (row?.totalDebtInterest || 0);
    const startDebt = (row?.debtBalance || 0) + debtChange;
    const pctDebtChange = startDebt > 0 ? (debtChange / startDebt) * 100 : 0;
    const isDebtReduction = debtChange >= 0;

    const isMultiStrategy = strategies && strategies.length > 1;
    const activeStrategy = isMultiStrategy && strategies ? strategies.find(s => s.id === activeStrategyId) : undefined;
    const accentColor = activeStrategy?.color || 'transparent';

    return (
        <div
            className="card relative overflow-hidden"
            style={{
                borderLeftWidth: isMultiStrategy ? '4px' : '1px',
                borderLeftColor: isMultiStrategy ? accentColor : undefined
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    Wealth Composition
                </h2>
                <div className="flex items-center gap-2">
                    {/* Fix #5: Show toggle based on any strategy having detail-worthy content */}
                    {anyStrategyHasDetail && (
                        <div className="relative group">
                            <button className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 px-2 py-1 rounded-md transition-colors">
                                {COMP_VIEW_LABELS[compView]}
                                <ChevronDown className="w-3 h-3" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[100px]">
                                {(['combined', 'by-fund'] as CompView[]).map((mode) => (
                                    <button
                                        key={mode}
                                        className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${compView === mode
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
                {/* ── ASSETS ── */}
                <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                        Assets
                    </h3>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(data.total)}
                    </span>
                </div>

                {compView === 'by-fund' ? (
                    <div className="space-y-1.5">
                        {fundData.map(({ fund, pctStart, pctContrib, pctInterest, pctOfTotal, startVal, contribVal, interestVal, total }) => {
                            const barWidth = maxBarValue > 0 ? (total / maxBarValue) * 100 : 0;
                            return (
                                <div key={fund.id} className="space-y-0.5 p-2 rounded-lg" style={{ backgroundColor: `${fund.color}25` }}>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">{fund.name}</div>
                                        <div className="text-[10px] text-slate-600 dark:text-neutral-300 font-semibold tabular-nums">
                                            {formatCurrency(total)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-7 bg-slate-100 dark:bg-neutral-800/60 rounded-md">
                                            <div className="h-full flex [&>div:first-child]:rounded-l-md [&>div:last-child]:rounded-r-md" style={{ width: `${barWidth}%` }}>
                                                <BarSegment pct={pctStart} color={COLOR_STARTING} label="Starting" value={startVal} size="sm" />
                                                <BarSegment pct={pctContrib} color={COLOR_CONTRIBUTIONS} label="Contributions" value={contribVal} size="sm" />
                                                <BarSegment pct={pctInterest} color={COLOR_INTEREST} label="Interest" value={interestVal} size="sm" textClass="text-white/90" />
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 tabular-nums w-[36px] text-right shrink-0">{Math.round(pctOfTotal)}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <>
                        <div className="w-full h-10 flex rounded-lg [&>div:first-child]:rounded-l-lg [&>div:last-child]:rounded-r-lg">
                            <BarSegment pct={data.pctStart} color={COLOR_STARTING} label="Starting Balance" value={data.startVal} size="lg" />
                            <BarSegment pct={data.pctContrib} color={COLOR_CONTRIBUTIONS} label="Contributions" value={data.contribVal} size="lg" />
                            <BarSegment pct={data.pctInterest} color={COLOR_INTEREST} label="Interest" value={data.interestVal} size="lg" textClass="text-white/90" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <DetailCard color={COLOR_STARTING} label="Starting Balance" pct={data.pctStart} value={data.startVal} />
                            <DetailCard color={COLOR_CONTRIBUTIONS} label="Contributions" pct={data.pctContrib} value={data.contribVal} />
                            <DetailCard color={COLOR_INTEREST} label="Interest" pct={data.pctInterest} value={data.interestVal} />
                        </div>
                    </>
                )}

                {/* ── LIABILITIES ── Fix #1: gate on hasDebts, not debtTotal > 0 */}
                {hasDebts && (
                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                                Liabilities
                            </h3>
                            <span
                                className={`text-xs font-semibold tabular-nums ${data.debtTotal <= 0 ? 'text-emerald-500 dark:text-emerald-400' : ''}`}
                                style={data.debtTotal > 0 ? { color: COLOR_DEBT } : undefined}
                            >
                                {data.debtTotal <= 0 ? 'Paid Off ✓' : formatCurrency(data.debtTotal)}
                            </span>
                        </div>

                        {compView === 'by-fund' ? (
                            /* Fix #4: Detailed debt bars — full-width track shows initial; filled = remaining */
                            <div className="space-y-1.5">
                                {debtData.map(({ debt, balance, initial, paid, pctOfTotal, pctRemaining, pctPaid }) => {
                                    const barWidth = maxBarValue > 0 ? (initial / maxBarValue) * 100 : 0;
                                    const isPaidOff = balance <= 0;
                                    return (
                                        <div key={debt.id} className="space-y-0.5 p-2 rounded-lg" style={{ backgroundColor: `${debt.color}25` }}>
                                            <div className="flex items-center justify-between">
                                                <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">{debt.name}</div>
                                                <div className={`text-[10px] font-semibold tabular-nums ${isPaidOff ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300'}`}>
                                                    {isPaidOff ? 'Paid Off ✓' : formatCurrency(balance)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-5 bg-slate-100 dark:bg-neutral-800/60 rounded-md">
                                                    {/* Outer container = full initial width for scale */}
                                                    <div className="h-full flex [&>div:first-child]:rounded-l-md [&>div:last-child]:rounded-r-md" style={{ width: `${barWidth}%` }}>
                                                        {/* Remaining debt portion */}
                                                        <BarSegment
                                                            pct={pctRemaining}
                                                            color={COLOR_DEBT}
                                                            label="Remaining"
                                                            value={balance}
                                                            size="sm"
                                                        />
                                                        {/* Paid-off portion */}
                                                        <BarSegment
                                                            pct={pctPaid}
                                                            color={colorPaid}
                                                            label="Paid Off"
                                                            value={paid}
                                                            size="sm"
                                                            textClass="text-white/90"
                                                        />
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 tabular-nums w-[36px] text-right shrink-0">{Math.round(pctOfTotal)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Fix #3: Stable 3-column debt breakdown in combined view */
                            combinedDebtBreakdown && (
                                <>
                                    <div className="w-full h-8 flex rounded-lg bg-slate-100 dark:bg-neutral-800 [&>div:first-child]:rounded-l-lg [&>div:last-child]:rounded-r-lg">
                                        <BarSegment
                                            pct={combinedDebtBreakdown.pctRemaining}
                                            color={COLOR_DEBT}
                                            label="Principal Remaining"
                                            value={combinedDebtBreakdown.remainingVal}
                                            size="lg"
                                        />
                                        <BarSegment
                                            pct={combinedDebtBreakdown.pctAccrual}
                                            color={COLOR_INTEREST}
                                            label="Accrued Interest"
                                            value={combinedDebtBreakdown.accrualVal}
                                            size="lg"
                                            textClass="text-white/90"
                                        />
                                        <BarSegment
                                            pct={combinedDebtBreakdown.pctPaid}
                                            color={colorPaid}
                                            label="Paid Off"
                                            value={combinedDebtBreakdown.paidVal}
                                            size="lg"
                                            textClass="text-white/90"
                                        />
                                    </div>
                                    {/* Always 3-column, stable layout */}
                                    <div className="grid grid-cols-3 gap-3 mt-3">
                                        <DetailCard color={COLOR_DEBT} label="Remaining" pct={combinedDebtBreakdown.pctRemaining} value={combinedDebtBreakdown.remainingVal} />
                                        <DetailCard color={COLOR_INTEREST} label="Accrued Interest" pct={combinedDebtBreakdown.pctAccrual} value={combinedDebtBreakdown.accrualVal} />
                                        <DetailCard color={colorPaid} label="Paid Off" pct={combinedDebtBreakdown.pctPaid} value={combinedDebtBreakdown.paidVal} />
                                    </div>
                                </>
                            )
                        )}
                    </div>
                )}

                {/* Year slider */}
                <div className="pt-4">
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

            {/* Legend and Annual Scorecards */}
            <div className="flex flex-wrap items-center justify-between gap-y-3 mt-4 px-2">
                {/* Fix #6: Legend always stable; debt entries only when hasDebts */}
                <div className="flex flex-wrap items-center gap-4">
                    <LegendItem color={COLOR_STARTING} label="Starting Balance" />
                    <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" />
                    <LegendItem color={COLOR_INTEREST} label="Interest" />
                    {hasDebts && <LegendItem color={COLOR_DEBT} label="Remaining Debt" />}
                    {hasDebts && <LegendItem color={colorPaid} label="Paid Off" />}
                </div>

                <div className="flex items-center gap-2">
                    {/* Asset Growth scorecard — always shown */}
                    <div className="group/ag relative bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-700/50 rounded-md px-2 py-1 flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider leading-none mb-1">Asset Growth</span>
                        <div className="flex items-center gap-1 leading-none">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                +{formatCurrency(row?.totalInterest || 0)}
                            </span>
                            <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 tabular-nums">
                                ({formatPercent(row?.startBalance ? (row.totalInterest / row.startBalance) * 100 : 0)})
                            </span>
                        </div>
                        <div className="absolute bottom-full right-0 mb-2 w-56 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover/ag:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">
                            Percentage growth of assets relative to the starting balance for this specific year.
                        </div>
                    </div>

                    {/* Fix #7: Debt Reduction and Net Worth — both gated on hasDebts */}
                    {showDebtScorecards && (
                        <>
                            <div className="group/dr relative bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-700/50 rounded-md px-2 py-1 flex flex-col items-end">
                                <span className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider leading-none mb-1">
                                    {isDebtReduction ? 'Debt Reduction' : 'Debt Growth'}
                                </span>
                                <div className="flex items-center gap-1 leading-none">
                                    <span className={`text-xs font-semibold tabular-nums ${isDebtReduction ? 'text-emerald-600 dark:text-emerald-400' : ''}`} style={!isDebtReduction ? { color: COLOR_DEBT } : undefined}>
                                        {isDebtReduction ? '−' : '+'}{formatCurrency(Math.abs(debtChange))}
                                    </span>
                                    {startDebt > 0 && (
                                        <span className={`text-[9px] tabular-nums ${isDebtReduction ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'opacity-70'}`} style={!isDebtReduction ? { color: COLOR_DEBT } : undefined}>
                                            ({isDebtReduction ? '−' : '+'}{formatPercent(Math.abs(pctDebtChange))})
                                        </span>
                                    )}
                                </div>
                                <div className="absolute bottom-full right-0 mb-2 w-56 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover/dr:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">
                                    {isDebtReduction
                                        ? 'Percentage decrease of your debt balance relative to the starting debt for this specific year.'
                                        : 'Percentage increase of your debt balance relative to the starting debt for this specific year.'}
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-neutral-800/40 border border-slate-100 dark:border-neutral-700/50 rounded-md px-2 py-1 flex flex-col items-end">
                                <span className="text-[9px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider leading-none mb-1">Net Worth</span>
                                <span
                                    className={`text-xs font-semibold tabular-nums leading-none ${data.total - data.debtTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                                    style={data.total - data.debtTotal < 0 ? { color: COLOR_DEBT } : undefined}
                                >
                                    {data.total - data.debtTotal < 0 ? '−' : ''}{formatCurrency(Math.abs(data.total - data.debtTotal))}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Fix #2 & #8: Strategy comparison with debt-aware net worth */}
            {isMultiStrategy && allResults && (
                <StrategyComparison
                    strategies={strategies!}
                    activeStrategyId={activeStrategyId!}
                    allResults={allResults}
                    clampedYear={clampedYear}
                    onSwitchStrategy={onSwitchStrategy}
                />
            )}
        </div>
    );
}

// ── Strategy Comparison (Fix #2 & #8) ──────────────────────────────────────

// ── Strategy Bar Row ─────────────────────────────────────────────────────────

type StrategyRowData = {
    strategy: Strategy;
    total: number;
    pctStart: number; pctContrib: number; pctInterest: number;
    startVal: number; contribVal: number; interestVal: number;
    netWorth: number;
    debt: number; debtInterest: number; debtPrincipal: number; initialDebt: number;
};

function StrategyBarRow({
    rowData,
    isActive,
    anyHasDebts,
    zeroLeft,
    maxAssets,
    maxDebtVal,
    colorDebtInterest,
    onSwitch,
}: {
    rowData: StrategyRowData;
    isActive: boolean;
    anyHasDebts: boolean;
    zeroLeft: number;
    maxAssets: number;
    maxDebtVal: number;
    colorDebtInterest: string;
    onSwitch: () => void;
}) {
    const { strategy, total, pctStart, pctContrib, pctInterest, startVal, contribVal, interestVal, netWorth, debt, debtInterest, debtPrincipal, initialDebt } = rowData;
    const [hovered, setHovered] = useState<{ label: string; lines: string[]; xPct: number } | null>(null);

    const assetWidth = maxAssets > 0 ? (total / maxAssets) * (100 - zeroLeft) : 0;
    const debtWidth = maxDebtVal > 0 ? (debt / maxDebtVal) * zeroLeft : 0;
    const principalPct = debt > 0 ? (debtPrincipal / debt) * 100 : 0;
    const interestPct = debt > 0 ? (debtInterest / debt) * 100 : 0;
    const debtPctOfInitial = initialDebt > 0 ? (debt / initialDebt) * 100 : 0;

    // Compute absolute x% of the bar track for hover center
    // Debt side: segments sit within [0, zeroLeft]%, rendered RTL
    // interestPct of debtWidth lives at the far left
    // principalPct of debtWidth lives right of the interest cap
    const interestXPct = zeroLeft - (debtWidth * interestPct / 100) / 2;
    const principalXPct = zeroLeft - debtWidth + (debtWidth * principalPct / 100) / 2;
    // Asset side: segments sit within [zeroLeft, zeroLeft + assetWidth]%, LTR
    const startXPct = zeroLeft + (assetWidth * pctStart / 100) / 2;
    const contribXPct = zeroLeft + (assetWidth * pctStart / 100) + (assetWidth * pctContrib / 100) / 2;
    const interestAssetXPct = zeroLeft + (assetWidth * (pctStart + pctContrib) / 100) + (assetWidth * pctInterest / 100) / 2;

    return (
        <button
            className={`w-full text-left transition-all rounded-md px-2 py-1.5 ${isActive
                ? 'bg-slate-100 dark:bg-neutral-800/60 ring-1 ring-slate-300 dark:ring-neutral-600'
                : 'hover:bg-slate-50 dark:hover:bg-neutral-800/30'
                }`}
            onClick={onSwitch}
        >
            {/* Header row */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: strategy.color }} />
                    <span className={`text-[11px] font-medium ${isActive ? 'text-slate-700 dark:text-neutral-200' : 'text-slate-500 dark:text-neutral-400'}`}>
                        {strategy.name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {anyHasDebts && (
                        <span className={`text-[10px] tabular-nums ${netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                            style={netWorth < 0 ? { color: COLOR_DEBT } : undefined}>
                            NW: {netWorth < 0 ? '−' : ''}{formatCurrency(Math.abs(netWorth))}
                        </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300 tabular-nums">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>

            {/* Diverging bar track */}
            <div className="relative h-5 w-full" onMouseLeave={() => setHovered(null)}>
                {/* Background */}
                <div className="absolute inset-0 bg-slate-100 dark:bg-neutral-800/60 rounded-sm" />

                {/* Debt bar — grows left (RTL) */}
                {anyHasDebts && debtWidth > 0 && (
                    <div className="absolute top-0 bottom-0 flex flex-row-reverse rounded-l-sm overflow-hidden"
                        style={{ right: `${100 - zeroLeft}%`, width: `${debtWidth}%` }}>
                        {interestPct > 0 && (
                            <div className="h-full flex-shrink-0 cursor-default"
                                style={{ width: `${interestPct}%`, backgroundColor: colorDebtInterest }}
                                onMouseEnter={() => setHovered({ label: 'Accrued Debt Interest', lines: [formatCurrency(debtInterest)], xPct: interestXPct })} />
                        )}
                        {principalPct > 0 && (
                            <div className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white/90 cursor-default"
                                style={{ width: `${principalPct}%`, backgroundColor: COLOR_DEBT }}
                                onMouseEnter={() => setHovered({ label: 'Remaining Principal', lines: [formatCurrency(debtPrincipal), `${Math.round(debtPctOfInitial)}% of initial debt (${formatCurrency(initialDebt)})`], xPct: principalXPct })}>
                                {debtPctOfInitial >= 10 && <span className="select-none">{Math.round(debtPctOfInitial)}%</span>}
                            </div>
                        )}
                    </div>
                )}

                {/* Asset bar — grows right */}
                <div className="absolute top-0 bottom-0 flex rounded-r-sm overflow-hidden"
                    style={{ left: `${zeroLeft}%`, width: `${assetWidth}%` }}>
                    {pctStart > 0 && (
                        <div className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white cursor-default"
                            style={{ width: `${pctStart}%`, backgroundColor: COLOR_STARTING }}
                            onMouseEnter={() => setHovered({ label: 'Starting Balance', lines: [formatCurrency(startVal), formatPercent(pctStart, 1)], xPct: startXPct })}>
                            {pctStart >= 10 && <span className="select-none">{formatPercent(pctStart, 0)}</span>}
                        </div>
                    )}
                    {pctContrib > 0 && (
                        <div className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white cursor-default"
                            style={{ width: `${pctContrib}%`, backgroundColor: COLOR_CONTRIBUTIONS }}
                            onMouseEnter={() => setHovered({ label: 'Contributions', lines: [formatCurrency(contribVal), formatPercent(pctContrib, 1)], xPct: contribXPct })}>
                            {pctContrib >= 10 && <span className="select-none">{formatPercent(pctContrib, 0)}</span>}
                        </div>
                    )}
                    {pctInterest > 0 && (
                        <div className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white/90 cursor-default"
                            style={{ width: `${pctInterest}%`, backgroundColor: COLOR_INTEREST }}
                            onMouseEnter={() => setHovered({ label: 'Interest', lines: [formatCurrency(interestVal), formatPercent(pctInterest, 1)], xPct: interestAssetXPct })}>
                            {pctInterest >= 10 && <span className="select-none">{formatPercent(pctInterest, 0)}</span>}
                        </div>
                    )}
                </div>

                {/* Zero axis rule */}
                {anyHasDebts && (
                    <div className="absolute top-0 bottom-0 w-px bg-slate-400 dark:bg-neutral-500 z-10"
                        style={{ left: `${zeroLeft}%` }} />
                )}

                {/* Floating tooltip — rendered here, outside any overflow-hidden */}
                {hovered && (
                    <div
                        className="absolute bottom-full mb-1.5 z-40 pointer-events-none"
                        style={{ left: `${Math.min(Math.max(hovered.xPct, 5), 95)}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className="bg-slate-800 dark:bg-neutral-900 text-white text-[10px] rounded-md px-2 py-1 shadow-lg whitespace-nowrap text-left">
                            <div className="font-medium">{hovered.label}</div>
                            {hovered.lines.map((l, i) => <div key={i} className={i > 0 ? 'text-slate-400 dark:text-neutral-500 mt-0.5' : 'tabular-nums'}>{l}</div>)}
                        </div>
                        <div className="mx-auto w-0 h-0 border-4 border-transparent border-t-slate-800 dark:border-t-neutral-900" />
                    </div>
                )}
            </div>
        </button>
    );
}

// ── Strategy Comparison ───────────────────────────────────────────────────────

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
    onSwitchStrategy?: (id: string) => void;
}) {
    const anyHasDebts = strategies.some(s => s.debts && s.debts.length > 0);
    const [sortBy, setSortBy] = useState<'netWorth' | 'assets'>('netWorth');

    const strategyData = useMemo(() => {
        return strategies.map((s) => {
            const result = allResults.get(s.id);
            if (!result || clampedYear < 1 || clampedYear > result.schedule.length) {
                return { strategy: s, total: 0, pctStart: 0, pctContrib: 0, pctInterest: 0, startVal: 0, contribVal: 0, interestVal: 0, debt: 0, netWorth: 0, debtInterest: 0, debtPrincipal: 0, initialDebt: 0 };
            }
            const row = result.schedule[clampedYear - 1];
            const debt = row.debtBalance || 0;
            const initialDebt = result.initialDebtBalance || 0;
            // Unpaid accrued interest exists only if current balance > initial principal
            const debtInterest = Math.max(0, debt - initialDebt);
            const debtPrincipal = Math.max(0, debt - debtInterest);
            return {
                strategy: s,
                total: row.endBalance,
                pctStart: row.pctStartingBalance,
                pctContrib: row.pctContributions,
                pctInterest: row.pctInterest,
                startVal: row.cumulativeStartingBalance,
                contribVal: row.cumulativeContributions,
                interestVal: row.cumulativeInterest,
                debt,
                netWorth: row.endBalance - debt,
                debtInterest,
                debtPrincipal,
                initialDebt: result.initialDebtBalance,
            };
        });
    }, [strategies, allResults, clampedYear]);

    // Sort by net worth or total assets
    const sortedData = useMemo(() => {
        if (!anyHasDebts) return [...strategyData].sort((a, b) => b.total - a.total);
        if (sortBy === 'netWorth') {
            return [...strategyData].sort((a, b) => b.netWorth - a.netWorth);
        } else {
            return [...strategyData].sort((a, b) => b.total - a.total);
        }
    }, [strategyData, anyHasDebts, sortBy]);

    // Separate scales per side so the largest value always reaches its zone edge
    const { maxAssets, maxDebt: maxDebtVal } = useMemo(() => ({
        maxAssets: Math.max(...strategyData.map(d => d.total), 1),
        maxDebt: Math.max(...strategyData.map(d => d.debt), 1),
    }), [strategyData]);

    // Dynamic zero-axis position as % from left
    const zeroLeft = useMemo(() => {
        if (!anyHasDebts) return 0;
        const maxDebt = Math.max(...strategyData.map(d => d.debt), 0);
        const maxAssets = Math.max(...strategyData.map(d => d.total), 0);
        const total = maxDebt + maxAssets;
        return total > 0 ? (maxDebt / total) * 100 : 0;
    }, [strategyData, anyHasDebts]);

    const colorDebtInterest = '#f59e0b'; // amber

    return (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-medium">
                    Strategy Comparison
                </div>
                {anyHasDebts && (
                    <div className="relative group">
                        <button className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">
                            {sortBy === 'netWorth' ? 'sorted by net worth' : 'sorted by assets'}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[120px]">
                            <button
                                className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${sortBy === 'netWorth' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700'}`}
                                onClick={() => setSortBy('netWorth')}
                            >
                                Sort by Net Worth
                            </button>
                            <button
                                className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${sortBy === 'assets' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700'}`}
                                onClick={() => setSortBy('assets')}
                            >
                                Sort by Assets
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bar rows */}
            <div className="space-y-1.5">
                {sortedData.map((rowData) => (
                    <StrategyBarRow
                        key={rowData.strategy.id}
                        rowData={rowData}
                        isActive={rowData.strategy.id === activeStrategyId}
                        anyHasDebts={anyHasDebts}
                        zeroLeft={zeroLeft}
                        maxAssets={maxAssets}
                        maxDebtVal={maxDebtVal}
                        colorDebtInterest={colorDebtInterest}
                        onSwitch={() => onSwitchStrategy?.(rowData.strategy.id)}
                    />
                ))}
            </div>

            {/* Zero axis label + debt legend */}
            {anyHasDebts && (
                <div className="relative mt-0.5">
                    <div
                        className="absolute text-[9px] text-slate-400 dark:text-neutral-600 -translate-x-1/2"
                        style={{ left: `${zeroLeft}%` }}
                    >
                        $0
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 pl-1">
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: COLOR_DEBT }} />
                            Debt Principal
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: colorDebtInterest }} />
                            Debt Interest
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Detail Card ──────────────────────────────────────────────────────────────

function DetailCard({ color, label, pct, value }: { color: string; label: string; pct: number; value: number }) {
    return (
        <div className="bg-slate-50 dark:bg-neutral-800/40 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider leading-tight">{label}</span>
            </div>
            <div className="text-sm font-semibold text-slate-800 dark:text-neutral-200 tabular-nums">{formatPercent(pct)}</div>
            <div className="text-xs text-slate-400 dark:text-neutral-500 tabular-nums">{formatCurrency(value)}</div>
        </div>
    );
}

// ── Bar Segment ──────────────────────────────────────────────────────────────

function BarSegment({
    pct,
    color,
    label,
    value,
    size,
    textClass = 'text-white',
}: {
    pct: number;
    color: string;
    label: string;
    value: number;
    size: 'sm' | 'lg';
    textClass?: string;
}) {
    if (pct <= 0) return null;
    const showInline = size === 'lg' ? pct >= 8 : pct >= 10;
    const fontSize = size === 'lg' ? 'text-xs' : 'text-[10px]';
    return (
        <div
            className={`group/seg relative h-full flex items-center justify-center ${fontSize} font-medium ${textClass} transition-all duration-300`}
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
