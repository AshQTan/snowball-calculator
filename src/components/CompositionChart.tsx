import { useMemo } from 'react';
import { YearBreakdown, Fund, Debt } from '../types';
import { formatPercent, formatCurrency } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, COLOR_DEBT } from '../utils/colors';
import LegendItem from './LegendItem';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CompositionChartProps {
    schedule: YearBreakdown[];
    funds: Fund[];
    debts?: Debt[];
    initialDebt?: number;
    darkMode: boolean;
    timelineMode: 'years' | 'retirement';
    selectedYear: number;
    onYearChange: (year: number) => void;
    asSubpanel?: boolean;
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
    selectedYear,
    onYearChange,
    asSubpanel = false,
}: CompositionChartProps) {
    const [compView, setCompView] = useState<CompView>('combined');

    const hasDebts = debts.length > 0;
    const hasManyFunds = funds.length > 1;
    const anyStrategyHasDetail = hasManyFunds || hasDebts;

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
                pctRemaining: effectiveInitial > 0 ? (Math.min(balance, effectiveInitial) / effectiveInitial) * 100 : 0,
                pctPaid: effectiveInitial > 0 ? (paid / effectiveInitial) * 100 : 0,
            };
        }).sort((a, b) => b.balance - a.balance);
    }, [debts, row, hasDebts]);

    const maxBarValue = useMemo(() => {
        if (compView !== 'by-fund') return 1;
        const maxFund = fundData.length > 0 ? Math.max(...fundData.map(f => f.total)) : 0;
        const maxDebt = debtData.length > 0 ? Math.max(...debtData.map(d => d.initial)) : 0;
        return Math.max(maxFund, maxDebt, 1);
    }, [fundData, debtData, compView]);

    const combinedDebtBreakdown = useMemo(() => {
        if (!hasDebts) return null;
        const current = data.debtTotal;
        const effectiveInitial = initialDebt > 0 ? initialDebt : current;
        const basis = Math.max(effectiveInitial, current);
        const remainingVal = Math.min(current, effectiveInitial);
        const accrualVal = Math.max(0, current - effectiveInitial);
        const paidVal = Math.max(0, effectiveInitial - current);
        const pctRemaining = basis > 0 ? (remainingVal / basis) * 100 : 0;
        const pctAccrual = basis > 0 ? (accrualVal / basis) * 100 : 0;
        const pctPaid = basis > 0 ? (paidVal / basis) * 100 : 0;
        return { current, effectiveInitial, remainingVal, accrualVal, paidVal, pctRemaining, pctAccrual, pctPaid };
    }, [hasDebts, data.debtTotal, initialDebt]);

    const colorPaidBorder = darkMode ? 'rgba(148,163,184,0.5)' : 'rgba(148,163,184,0.6)';

    const yearLabel = timelineMode === 'retirement' && row?.age
        ? `Age ${row.age}`
        : `Year ${row?.year ?? (clampedYear - 1)}`;

    const showDebtScorecards = hasDebts;
    const debtChange = (row?.totalDebtPayment || 0) - (row?.totalDebtInterest || 0);
    const startDebt = (row?.debtBalance || 0) + debtChange;
    const pctDebtChange = startDebt > 0 ? (debtChange / startDebt) * 100 : 0;
    const isDebtReduction = debtChange >= 0;

    return (
        <div className={asSubpanel
            ? 'relative overflow-hidden'
            : 'card relative overflow-hidden'
        }>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                    Wealth Composition
                </h2>
                <div className="flex items-center gap-2">
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
                        {/* Compact inline legend row replacing the 3-col detail cards */}
                        <InlineLegendRow entries={[
                            { color: COLOR_STARTING, label: 'Starting', pct: data.pctStart, value: data.startVal },
                            { color: COLOR_CONTRIBUTIONS, label: 'Contributions', pct: data.pctContrib, value: data.contribVal },
                            { color: COLOR_INTEREST, label: 'Interest', pct: data.pctInterest, value: data.interestVal },
                        ]} />
                    </>
                )}

                {/* ── LIABILITIES ── */}
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
                                                    <div className="h-full flex [&>div:first-child]:rounded-l-md [&>div:last-child]:rounded-r-md" style={{ width: `${barWidth}%` }}>
                                                        <BarSegment
                                                            pct={pctRemaining}
                                                            color={COLOR_DEBT}
                                                            label="Remaining"
                                                            value={balance}
                                                            size="sm"
                                                        />
                                                        {pctPaid > 0 && (
                                                            <div
                                                                className="group/seg relative h-full flex items-center justify-center text-[10px] font-medium text-slate-400 dark:text-neutral-500 transition-all duration-300"
                                                                style={{
                                                                    width: `${pctPaid}%`,
                                                                    borderTop: `1.5px solid ${colorPaidBorder}`,
                                                                    borderRight: `1.5px solid ${colorPaidBorder}`,
                                                                    borderBottom: `1.5px solid ${colorPaidBorder}`,
                                                                    borderLeft: isPaidOff ? `1.5px solid ${colorPaidBorder}` : 'none',
                                                                    borderRadius: isPaidOff ? '3px' : '0 3px 3px 0',
                                                                    minWidth: pctPaid > 3 ? undefined : 0
                                                                }}
                                                            >
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-800 dark:bg-neutral-900 text-white text-[10px] rounded-md px-2 py-1 opacity-0 invisible group-hover/seg:opacity-100 group-hover/seg:visible transition-all z-30 whitespace-nowrap pointer-events-none shadow-lg">
                                                                    <div className="font-medium">Paid Off</div>
                                                                    <div className="tabular-nums">{formatCurrency(paid)} · {formatPercent(pctPaid, 1)}</div>
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-neutral-900" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 tabular-nums w-[36px] text-right shrink-0">{Math.round(pctOfTotal)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
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
                                        {combinedDebtBreakdown.pctPaid > 0 && (
                                            <div
                                                className="group/seg relative h-full flex items-center justify-center text-xs font-medium text-slate-400 dark:text-neutral-500 transition-all duration-300"
                                                style={{
                                                    width: `${combinedDebtBreakdown.pctPaid}%`,
                                                    borderTop: `1.5px solid ${colorPaidBorder}`,
                                                    borderRight: `1.5px solid ${colorPaidBorder}`,
                                                    borderBottom: `1.5px solid ${colorPaidBorder}`,
                                                    borderLeft: data.debtTotal <= 0 ? `1.5px solid ${colorPaidBorder}` : 'none',
                                                    borderRadius: data.debtTotal <= 0 ? '4px' : '0 4px 4px 0',
                                                    minWidth: combinedDebtBreakdown.pctPaid > 3 ? undefined : 0
                                                }}
                                            >
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-800 dark:bg-neutral-900 text-white text-[10px] rounded-md px-2 py-1 opacity-0 invisible group-hover/seg:opacity-100 group-hover/seg:visible transition-all z-30 whitespace-nowrap pointer-events-none shadow-lg">
                                                    <div className="font-medium">Paid Off</div>
                                                    <div className="tabular-nums">{formatCurrency(combinedDebtBreakdown.paidVal)} · {formatPercent(combinedDebtBreakdown.pctPaid, 1)}</div>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-neutral-900" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Compact inline legend replacing 3-col detail cards */}
                                    <InlineLegendRow entries={[
                                        { color: COLOR_DEBT, label: 'Remaining', pct: combinedDebtBreakdown.pctRemaining, value: combinedDebtBreakdown.remainingVal },
                                        { color: COLOR_INTEREST, label: 'Accrued Interest', pct: combinedDebtBreakdown.pctAccrual, value: combinedDebtBreakdown.accrualVal },
                                        { color: colorPaidBorder, label: 'Paid Off', pct: combinedDebtBreakdown.pctPaid, value: combinedDebtBreakdown.paidVal, outlined: true },
                                    ]} />
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
                        onChange={(e) => onYearChange(Number(e.target.value))}
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
                <div className="flex flex-wrap items-center gap-4">
                    <LegendItem color={COLOR_STARTING} label="Starting Balance" />
                    <LegendItem color={COLOR_CONTRIBUTIONS} label="Contributions" />
                    <LegendItem color={COLOR_INTEREST} label="Interest" />
                    {hasDebts && <LegendItem color={COLOR_DEBT} label="Remaining Debt" />}
                </div>

                <div className="flex items-center gap-2">
                    {/* Asset Growth scorecard */}
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
        </div>
    );
}

// ── Inline Legend Row ────────────────────────────────────────────────────────

interface InlineLegendEntry {
    color: string;
    label: string;
    pct: number;
    value: number;
    outlined?: boolean;
}

function InlineLegendRow({ entries }: { entries: InlineLegendEntry[] }) {
    const visible = entries.filter(e => e.pct > 0);
    if (visible.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 px-0.5">
            {visible.map((e) => (
                <span key={e.label} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400">
                    <span
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={e.outlined
                            ? { border: `1.5px solid ${e.color}` }
                            : { backgroundColor: e.color }}
                    />
                    <span className="text-slate-400 dark:text-neutral-500">{e.label}</span>
                    <span className="font-semibold text-slate-600 dark:text-neutral-300 tabular-nums">{formatPercent(e.pct, 0)}</span>
                    <span className="text-slate-400 dark:text-neutral-500 tabular-nums">·</span>
                    <span className="tabular-nums">{formatCurrency(e.value)}</span>
                </span>
            ))}
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
