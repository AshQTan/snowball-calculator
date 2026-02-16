import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Debt, DEBT_APR_PRESETS, DEBT_COLORS, DEBT_PICKER_COUNT, ContributionFrequency } from '../types';
import NumericInput from './NumericInput';

interface DebtConfiguratorProps {
    debt: Debt;
    showIncomeOption: boolean;
    onChange: (updates: Partial<Debt>) => void;
    onDelete: () => void;
}

export default function DebtConfigurator({
    debt,
    showIncomeOption,
    onChange,
    onDelete,
}: DebtConfiguratorProps) {
    const [expanded, setExpanded] = useState(true);
    const [showColors, setShowColors] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Rough payoff estimate (uses raw monthly payment for display)
    const effectiveMonthlyMin = debt.minimumPaymentType === 'percent_of_income' ? 0 : (debt.paymentFrequency === 'monthly' ? debt.minimumPayment : debt.minimumPayment / 12);
    const effectiveMonthlyExtra = debt.extraPaymentType === 'percent_of_income' ? 0 : (debt.paymentFrequency === 'monthly' ? debt.extraPayment : debt.extraPayment / 12);
    const monthlyPayment = effectiveMonthlyMin + effectiveMonthlyExtra;
    const monthlyRate = debt.interestRate / 100 / 12;
    let payoffMonths: number | null = null;
    if (monthlyPayment > 0 && debt.principal > 0) {
        if (monthlyRate <= 0) {
            payoffMonths = Math.ceil(debt.principal / monthlyPayment);
        } else if (monthlyPayment > debt.principal * monthlyRate) {
            payoffMonths = Math.ceil(
                -Math.log(1 - (debt.principal * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate)
            );
        }
    }

    return (
        <div className="bg-red-50/40 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30 rounded-lg overflow-hidden">
            {/* Header bar */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-red-100/40 dark:hover:bg-red-900/20 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <button
                    className="color-swatch flex-shrink-0"
                    style={{ backgroundColor: debt.color }}
                    onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
                    title="Change color"
                />
                <input
                    type="text"
                    className="flex-1 bg-transparent border-none text-sm font-medium text-slate-800 dark:text-neutral-200 focus:outline-none placeholder-slate-400 dark:placeholder-neutral-600 min-w-0"
                    value={debt.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Debt name (e.g., Student Loan)"
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                    {debt.principal > 0 && (
                        <span className="text-[10px] text-red-500/70 dark:text-red-400/60 tabular-nums font-medium">
                            ${debt.principal.toLocaleString()}
                        </span>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="btn-danger p-1"
                        title="Remove debt"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 dark:text-neutral-500" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 dark:text-neutral-500" />
                    )}
                </div>
            </div>

            {/* Color picker */}
            {showColors && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {DEBT_COLORS.slice(0, DEBT_PICKER_COUNT).map((c) => (
                        <button
                            key={c}
                            className={`color-swatch ${debt.color === c ? 'color-swatch-active' : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => { onChange({ color: c }); }}
                        />
                    ))}
                    <div className="relative">
                        <input
                            type="color"
                            value={debt.color}
                            onChange={(e) => { onChange({ color: e.target.value }); }}
                            className="w-6 h-6 rounded-md cursor-pointer border-2 border-slate-300 dark:border-neutral-700"
                            title="Custom color"
                        />
                    </div>
                </div>
            )}

            {/* Expanded settings */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-red-200/30 dark:border-red-800/20 pt-3">
                    {/* Interest Rate (APR) */}
                    <div>
                        <label className="input-label">Interest Rate (APR)</label>
                        <div className="relative">
                            <input
                                type="number"
                                className="input-field pr-7"
                                value={debt.interestRate}
                                onChange={(e) => onChange({ interestRate: Number(e.target.value) || 0 })}
                                min={0}
                                max={100}
                                step={0.25}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {DEBT_APR_PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${debt.interestRate === p.rate
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/50'
                                        : 'bg-slate-100 dark:bg-neutral-700/20 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700/30 hover:text-slate-600 dark:hover:text-neutral-400'
                                        }`}
                                    onClick={() => onChange({ interestRate: p.rate })}
                                >
                                    {p.label} ({p.rate}%)
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Principal Balance */}
                    <div>
                        <label className="input-label">Balance Owed</label>
                        <NumericInput
                            value={debt.principal || ''}
                            onChange={(v) => onChange({ principal: v })}
                            min={0}
                            step={1000}
                            prefix="$"
                        />
                    </div>

                    {/* Minimum Payment */}
                    <div>
                        <label className="input-label relative group/minpay inline-flex items-center gap-1">
                            Minimum Payment
                            {debt.minimumPaymentType === 'percent_of_income' && (
                                <>
                                    <span className="text-slate-300 dark:text-neutral-600 cursor-help">ⓘ</span>
                                    <div className="absolute bottom-full left-0 mb-2 w-52 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed normal-case tracking-normal font-normal opacity-0 pointer-events-none group-hover/minpay:opacity-100 transition-opacity z-50 shadow-xl text-left">
                                        Percentage of your annual income allocated as minimum debt payment. The actual dollar amount grows automatically as your income increases.
                                    </div>
                                </>
                            )}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex gap-1.5">
                                <div className="relative flex-1">
                                    {debt.minimumPaymentType === 'fixed' ? (
                                        <NumericInput
                                            value={debt.minimumPayment || ''}
                                            onChange={(v) => onChange({ minimumPayment: v })}
                                            min={0}
                                            step={50}
                                            prefix="$"
                                        />
                                    ) : (
                                        <>
                                            <input
                                                type="number"
                                                className="input-field pr-7"
                                                value={debt.minimumPayment || ''}
                                                onChange={(e) => onChange({ minimumPayment: Math.min(Number(e.target.value) || 0, 100) })}
                                                min={0}
                                                max={100}
                                                step={1}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
                                        </>
                                    )}
                                </div>
                                {showIncomeOption && (
                                    <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 h-[38px]">
                                        <button
                                            className={`px-2 rounded-md text-xs font-medium transition-all ${debt.minimumPaymentType === 'fixed' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                                            onClick={() => onChange({ minimumPaymentType: 'fixed' })}
                                        >$</button>
                                        <button
                                            className={`px-2 rounded-md text-xs font-medium transition-all ${debt.minimumPaymentType === 'percent_of_income' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                                            onClick={() => onChange({ minimumPaymentType: 'percent_of_income' })}
                                        >%</button>
                                    </div>
                                )}
                            </div>
                            <select
                                className="select-field"
                                value={debt.paymentFrequency}
                                onChange={(e) => onChange({ paymentFrequency: e.target.value as ContributionFrequency })}
                            >
                                <option value="monthly">Monthly</option>
                                <option value="annually">Annually</option>
                            </select>
                        </div>
                    </div>

                    {/* Extra Payment */}
                    <div>
                        <label className="input-label">Extra Payment</label>
                        <div className="flex gap-1.5">
                            <div className="relative flex-1">
                                {debt.extraPaymentType === 'fixed' ? (
                                    <NumericInput
                                        value={debt.extraPayment || ''}
                                        onChange={(v) => onChange({ extraPayment: v })}
                                        min={0}
                                        step={50}
                                        prefix="$"
                                    />
                                ) : (
                                    <>
                                        <input
                                            type="number"
                                            className="input-field pr-7"
                                            value={debt.extraPayment || ''}
                                            onChange={(e) => onChange({ extraPayment: Math.min(Number(e.target.value) || 0, 100) })}
                                            min={0}
                                            max={100}
                                            step={1}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
                                    </>
                                )}
                            </div>
                            {showIncomeOption && (
                                <div className="relative group/toggle">
                                    <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 h-[38px]">
                                        <button
                                            className={`px-2 rounded-md text-xs font-medium transition-all ${debt.extraPaymentType === 'fixed' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                                            onClick={() => onChange({ extraPaymentType: 'fixed' })}
                                        >$</button>
                                        <button
                                            className={`px-2 rounded-md text-xs font-medium transition-all ${debt.extraPaymentType === 'percent_of_income' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                                            onClick={() => onChange({ extraPaymentType: 'percent_of_income' })}
                                        >%</button>
                                    </div>
                                    <div className="absolute bottom-full right-0 mb-2 w-48 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover/toggle:opacity-100 transition-opacity z-50 shadow-xl text-left">
                                        Toggle between fixed dollar amount or percentage of annual income. % grows automatically with income.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payoff estimate */}
                    {payoffMonths !== null && (
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800/40 rounded-md px-3 py-2">
                            Est. payoff in <span className="font-semibold text-slate-700 dark:text-neutral-200">
                                {payoffMonths < 12
                                    ? `${payoffMonths} month${payoffMonths !== 1 ? 's' : ''}`
                                    : `${(payoffMonths / 12).toFixed(1)} years`}
                            </span>
                            {payoffMonths >= 12 && (
                                <span className="text-slate-400 dark:text-neutral-500"> ({payoffMonths} months)</span>
                            )}
                        </div>
                    )}
                    {monthlyPayment > 0 && debt.principal > 0 && payoffMonths === null && monthlyRate > 0 && (
                        <div className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
                            ⚠ Payment is less than monthly interest — balance will grow
                        </div>
                    )}


                    {/* Advanced: payment growth — only for fixed $ payments */}
                    {debt.minimumPaymentType === 'fixed' && debt.extraPaymentType === 'fixed' && (
                        <>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-[10px] text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
                            >
                                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                Payment Growth
                            </button>

                            {showAdvanced && (
                                <div>
                                    <label className="input-label">Payment Increase</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex gap-1.5">
                                            <div className="relative flex-1">
                                                {debt.paymentGrowthType === 'fixed' ? (
                                                    <NumericInput
                                                        value={debt.paymentGrowthRate || ''}
                                                        onChange={(v) => onChange({ paymentGrowthRate: v })}
                                                        min={0}
                                                        max={10000}
                                                        step={1}
                                                        prefix="$"
                                                    />
                                                ) : (
                                                    <>
                                                        <input
                                                            type="number"
                                                            className="input-field pr-7"
                                                            value={debt.paymentGrowthRate}
                                                            onChange={(e) => onChange({ paymentGrowthRate: Math.min(Number(e.target.value) || 0, 100) })}
                                                            min={0}
                                                            max={100}
                                                            step={0.5}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="relative group/growthtoggle">
                                                <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 h-[38px]">
                                                    <button
                                                        className={`px-2 rounded-md text-xs font-medium transition-all ${debt.paymentGrowthType === 'fixed' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                                                        onClick={() => onChange({ paymentGrowthType: 'fixed', paymentGrowthRate: 0 })}
                                                    >$</button>
                                                    <button
                                                        className={`px-2 rounded-md text-xs font-medium transition-all ${debt.paymentGrowthType === 'percent' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                                                        onClick={() => onChange({ paymentGrowthType: 'percent', paymentGrowthRate: 0 })}
                                                    >%</button>
                                                </div>
                                                <div className="absolute bottom-full left-0 mb-2 w-48 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover/growthtoggle:opacity-100 transition-opacity z-50 shadow-xl text-left">
                                                    Fixed $ increases by a dollar amount, % increases by a percentage each interval.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 items-center">
                                            <span className="text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">every</span>
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    className="input-field pr-8"
                                                    value={debt.paymentGrowthInterval}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? 0 : Math.round(Number(e.target.value));
                                                        onChange({ paymentGrowthInterval: val });
                                                    }}
                                                    onBlur={() => {
                                                        if (debt.paymentGrowthInterval < 1) {
                                                            onChange({ paymentGrowthInterval: 1 });
                                                        }
                                                    }}
                                                    min={1}
                                                    max={50}
                                                    step={1}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-[11px]">
                                                    {debt.paymentGrowthInterval === 1 ? 'yr' : 'yrs'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
