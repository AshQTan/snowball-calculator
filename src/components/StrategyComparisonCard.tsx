import { useState, useMemo } from 'react';
import { Strategy, ProjectionResult } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { COLOR_STARTING, COLOR_CONTRIBUTIONS, COLOR_INTEREST, COLOR_DEBT } from '../utils/colors';
import { ChevronDown } from 'lucide-react';

interface StrategyComparisonCardProps {
    strategies: Strategy[];
    activeStrategyId: string;
    allResults: Map<string, ProjectionResult>;
    selectedYear: number;
    darkMode: boolean;
    timelineMode: 'years' | 'retirement';
    scheduleLength: number;
    onSwitchStrategy?: (id: string) => void;
    asSubpanel?: boolean;
}

type BarMode = 'simple' | 'breakdown';
type SortBy = 'netWorth' | 'assets';

// ── Row Data Type ──────────────────────────────────────────────────────────
type StrategyRowData = {
    strategy: Strategy;
    total: number;
    pctStart: number; pctContrib: number; pctInterest: number;
    startVal: number; contribVal: number; interestVal: number;
    netWorth: number;
    debt: number; debtInterest: number; debtPrincipal: number; initialDebt: number;
};

// ── Individual Bar Row ─────────────────────────────────────────────────────
function StrategyBarRow({
    rowData,
    isActive,
    anyHasDebts,
    zeroLeft,
    maxAssets,
    maxDebtVal,
    barMode,
    colorDebtInterest,
    onSwitch,
    sortBy,
}: {
    rowData: StrategyRowData;
    isActive: boolean;
    anyHasDebts: boolean;
    zeroLeft: number;
    maxAssets: number;
    maxDebtVal: number;
    barMode: BarMode;
    colorDebtInterest: string;
    onSwitch: () => void;
    sortBy: SortBy;
}) {
    const { strategy, total, pctStart, pctContrib, pctInterest, startVal, contribVal, interestVal, netWorth, debt, debtInterest, debtPrincipal, initialDebt } = rowData;
    const [hovered, setHovered] = useState<{ label: string; lines: string[]; xPct: number } | null>(null);

    const assetWidth = maxAssets > 0 ? (total / maxAssets) * (100 - zeroLeft) : 0;
    const debtWidth = maxDebtVal > 0 ? (debt / maxDebtVal) * zeroLeft : 0;
    const principalPct = debt > 0 ? (debtPrincipal / debt) * 100 : 0;
    const interestPct = debt > 0 ? (debtInterest / debt) * 100 : 0;
    const debtPctOfInitial = initialDebt > 0 ? (debt / initialDebt) * 100 : 0;

    // X positions for tooltips
    const interestXPct = zeroLeft - (debtWidth * interestPct / 100) / 2;
    const principalXPct = zeroLeft - debtWidth + (debtWidth * principalPct / 100) / 2;
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
                    {anyHasDebts && sortBy === 'netWorth' && (
                        <span className={`text-[10px] tabular-nums ${netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                            style={netWorth < 0 ? { color: COLOR_DEBT } : undefined}>
                            NW: {netWorth < 0 ? '−' : ''}{formatCurrency(Math.abs(netWorth))}
                        </span>
                    )}
                    {(!anyHasDebts || sortBy === 'assets') && (
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300 tabular-nums">
                            {formatCurrency(total)}
                        </span>
                    )}
                </div>
            </div>

            {/* Diverging bar track */}
            <div className="relative h-5 w-full" onMouseLeave={() => setHovered(null)}>
                {/* Background */}
                <div className="absolute inset-0 bg-slate-100 dark:bg-neutral-800/60 rounded-sm" />

                {/* ── DEBT SIDE (grows left) ── */}
                {anyHasDebts && debtWidth > 0 && (
                    <div
                        className="absolute top-0 bottom-0 flex flex-row-reverse rounded-l-sm overflow-hidden"
                        style={{ right: `${100 - zeroLeft}%`, width: `${debtWidth}%` }}
                    >
                        {barMode === 'breakdown' ? (
                            <>
                                {interestPct > 0 && (
                                    <div
                                        className="h-full flex-shrink-0 cursor-default"
                                        style={{ width: `${interestPct}%`, backgroundColor: colorDebtInterest }}
                                        onMouseEnter={() => setHovered({ label: 'Accrued Debt Interest', lines: [formatCurrency(debtInterest)], xPct: interestXPct })}
                                    />
                                )}
                                {principalPct > 0 && (
                                    <div
                                        className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white/90 cursor-default"
                                        style={{ width: `${principalPct}%`, backgroundColor: COLOR_DEBT }}
                                        onMouseEnter={() => setHovered({ label: 'Remaining Principal', lines: [formatCurrency(debtPrincipal), `${Math.round(debtPctOfInitial)}% of initial (${formatCurrency(initialDebt)})`], xPct: principalXPct })}
                                    >
                                        {debtPctOfInitial >= 10 && <span className="select-none">{Math.round(debtPctOfInitial)}%</span>}
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Simple mode: single solid debt bar */
                            <div
                                className="h-full w-full flex items-center justify-center text-[10px] font-medium text-white/90 cursor-default rounded-l-sm"
                                style={{ backgroundColor: COLOR_DEBT }}
                                onMouseEnter={() => setHovered({ label: 'Total Debt', lines: [formatCurrency(debt), `${Math.round(debtPctOfInitial)}% of initial (${formatCurrency(initialDebt)})`], xPct: zeroLeft - debtWidth / 2 })}
                            />
                        )}
                    </div>
                )}

                {/* ── ASSET SIDE (grows right) ── */}
                <div
                    className="absolute top-0 bottom-0 flex rounded-r-sm overflow-hidden"
                    style={{ left: `${zeroLeft}%`, width: `${assetWidth}%` }}
                >
                    {barMode === 'breakdown' ? (
                        <>
                            {pctStart > 0 && (
                                <div
                                    className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white cursor-default"
                                    style={{ width: `${pctStart}%`, backgroundColor: COLOR_STARTING }}
                                    onMouseEnter={() => setHovered({ label: 'Starting Balance', lines: [formatCurrency(startVal), formatPercent(pctStart, 1)], xPct: startXPct })}
                                >
                                    {pctStart >= 10 && <span className="select-none">{formatPercent(pctStart, 0)}</span>}
                                </div>
                            )}
                            {pctContrib > 0 && (
                                <div
                                    className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white cursor-default"
                                    style={{ width: `${pctContrib}%`, backgroundColor: COLOR_CONTRIBUTIONS }}
                                    onMouseEnter={() => setHovered({ label: 'Contributions', lines: [formatCurrency(contribVal), formatPercent(pctContrib, 1)], xPct: contribXPct })}
                                >
                                    {pctContrib >= 10 && <span className="select-none">{formatPercent(pctContrib, 0)}</span>}
                                </div>
                            )}
                            {pctInterest > 0 && (
                                <div
                                    className="h-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-white/90 cursor-default"
                                    style={{ width: `${pctInterest}%`, backgroundColor: COLOR_INTEREST }}
                                    onMouseEnter={() => setHovered({ label: 'Interest', lines: [formatCurrency(interestVal), formatPercent(pctInterest, 1)], xPct: interestAssetXPct })}
                                >
                                    {pctInterest >= 10 && <span className="select-none">{formatPercent(pctInterest, 0)}</span>}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Simple mode: single solid strategy-colored bar */
                        <div
                            className="h-full w-full flex items-center justify-center text-[10px] font-medium text-white/90 cursor-default"
                            style={{ backgroundColor: strategy.color }}
                            onMouseEnter={() => setHovered({ label: strategy.name, lines: [formatCurrency(total)], xPct: zeroLeft + assetWidth / 2 })}
                        />
                    )}
                </div>

                {/* Zero axis rule */}
                {anyHasDebts && (
                    <div
                        className="absolute top-0 bottom-0 w-px bg-slate-400 dark:bg-neutral-500 z-10"
                        style={{ left: `${zeroLeft}%` }}
                    />
                )}

                {/* Floating tooltip */}
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

// ── Strategy Comparison Card ───────────────────────────────────────────────

export default function StrategyComparisonCard({
    strategies,
    activeStrategyId,
    allResults,
    selectedYear,
    timelineMode,
    scheduleLength,
    onSwitchStrategy,
    asSubpanel = false,
}: StrategyComparisonCardProps) {
    const [sortBy, setSortBy] = useState<SortBy>('netWorth');
    const [barMode, setBarMode] = useState<BarMode>('simple');

    const anyHasDebts = strategies.some(s => s.debts && s.debts.length > 0);
    const clampedYear = Math.min(Math.max(selectedYear, 1), scheduleLength);

    // Determine year label from first strategy's schedule
    const firstResult = allResults.get(strategies[0]?.id);
    const firstSchedule = firstResult?.schedule;
    const row0 = firstSchedule?.[clampedYear - 1];
    const yearLabel = timelineMode === 'retirement' && row0?.age
        ? `Age ${row0.age}`
        : `Year ${row0?.year ?? clampedYear - 1}`;

    const strategyData = useMemo(() => {
        return strategies.map((s) => {
            const result = allResults.get(s.id);
            if (!result || clampedYear < 1 || clampedYear > result.schedule.length) {
                return { strategy: s, total: 0, pctStart: 0, pctContrib: 0, pctInterest: 0, startVal: 0, contribVal: 0, interestVal: 0, debt: 0, netWorth: 0, debtInterest: 0, debtPrincipal: 0, initialDebt: 0 };
            }
            const row = result.schedule[clampedYear - 1];
            const debt = row.debtBalance || 0;
            const initialDebt = result.initialDebtBalance || 0;
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

    const sortedData = useMemo(() => {
        if (!anyHasDebts) return [...strategyData].sort((a, b) => b.total - a.total);
        if (sortBy === 'netWorth') return [...strategyData].sort((a, b) => b.netWorth - a.netWorth);
        return [...strategyData].sort((a, b) => b.total - a.total);
    }, [strategyData, anyHasDebts, sortBy]);

    const { maxAssets, maxDebtVal } = useMemo(() => ({
        maxAssets: Math.max(...strategyData.map(d => d.total), 1),
        maxDebtVal: Math.max(...strategyData.map(d => d.debt), 1),
    }), [strategyData]);

    const zeroLeft = useMemo(() => {
        if (!anyHasDebts) return 0;
        const maxDebt = Math.max(...strategyData.map(d => d.debt), 0);
        const maxAss = Math.max(...strategyData.map(d => d.total), 0);
        const total = maxDebt + maxAss;
        return total > 0 ? (maxDebt / total) * 100 : 0;
    }, [strategyData, anyHasDebts]);

    const colorDebtInterest = '#f59e0b';

    return (
        <div className={asSubpanel ? '' : 'card'}>
            {/* Card header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
                        Strategy Comparison
                    </h2>
                    <span className="text-sm text-slate-400 dark:text-neutral-500 font-medium">{yearLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Breakdown toggle */}
                    <button
                        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${barMode === 'breakdown'
                            ? 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                            }`}
                        onClick={() => setBarMode(m => m === 'simple' ? 'breakdown' : 'simple')}
                    >
                        {barMode === 'simple' ? 'Breakdown' : 'Simple'}
                    </button>

                    {/* Sort dropdown (only when debts present) */}
                    {anyHasDebts && (
                        <div className="relative group">
                            <button className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">
                                {sortBy === 'netWorth' ? 'by net worth' : 'by assets'}
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
                        barMode={barMode}
                        colorDebtInterest={colorDebtInterest}
                        onSwitch={() => onSwitchStrategy?.(rowData.strategy.id)}
                        sortBy={sortBy}
                    />
                ))}
            </div>

            {/* Footer: zero axis label + legend */}
            <div className="relative mt-2">
                {anyHasDebts && (
                    <div
                        className="absolute text-[9px] text-slate-400 dark:text-neutral-600 -translate-x-1/2"
                        style={{ left: `${zeroLeft}%` }}
                    >
                        $0
                    </div>
                )}
                {/* Legend — only shown in breakdown mode */}
                {barMode === 'breakdown' && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 pl-1">
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: COLOR_STARTING }} />
                            Starting
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: COLOR_CONTRIBUTIONS }} />
                            Contributions
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: COLOR_INTEREST }} />
                            Interest
                        </span>
                        {anyHasDebts && (
                            <>
                                <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: COLOR_DEBT }} />
                                    Debt Principal
                                </span>
                                <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-neutral-600">
                                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: colorDebtInterest }} />
                                    Debt Interest
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
