import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Fund, PRESET_RETURNS, FUND_COLORS, ContributionFrequency } from '../types';
import NumericInput from './NumericInput';

interface FundConfiguratorProps {
  fund: Fund;
  canDelete: boolean;
  showIncomeOption: boolean;
  onChange: (updates: Partial<Fund>) => void;
  onDelete: () => void;
}



export default function FundConfigurator({
  fund,
  canDelete,
  showIncomeOption,
  onChange,
  onDelete,
}: FundConfiguratorProps) {
  const [expanded, setExpanded] = useState(true);
  const [showColors, setShowColors] = useState(false);

  return (
    <div className="bg-slate-50/80 dark:bg-neutral-800/40 border border-slate-200 dark:border-neutral-700/50 rounded-lg overflow-hidden">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800/60 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          className="color-swatch flex-shrink-0"
          style={{ backgroundColor: fund.color }}
          onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
          title="Change color"
        />
        <input
          type="text"
          className="flex-1 bg-transparent border-none text-sm font-medium text-slate-800 dark:text-neutral-200 focus:outline-none placeholder-slate-400 dark:placeholder-neutral-600 min-w-0"
          value={fund.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Fund name (e.g., 401k, IRA)"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="btn-danger p-1"
              title="Remove fund"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
          {FUND_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${fund.color === c ? 'color-swatch-active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => { onChange({ color: c }); }}
            />
          ))}
          <div className="relative">
            <input
              type="color"
              value={fund.color}
              onChange={(e) => { onChange({ color: e.target.value }); }}
              className="w-6 h-6 rounded-md cursor-pointer border-2 border-slate-300 dark:border-neutral-700"
              title="Custom color"
            />
          </div>
        </div>
      )}

      {/* Expanded settings */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200/50 dark:border-neutral-700/30 pt-3">
          {/* Return Rate */}
          <div>
            <label className="input-label">Projected Return Rate</label>
            <div className="relative">
              <input
                type="number"
                className="input-field pr-7"
                value={fund.returnRate}
                onChange={(e) => onChange({ returnRate: Number(e.target.value) || 0 })}
                min={-20}
                max={50}
                step={0.5}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_RETURNS.map((p) => (
                <button
                  key={p.label}
                  className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
                    fund.returnRate === p.rate
                      ? 'bg-sky-100 dark:bg-neutral-600/40 text-sky-700 dark:text-neutral-200 border border-sky-300 dark:border-neutral-500/50'
                      : 'bg-slate-100 dark:bg-neutral-700/20 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700/30 hover:text-slate-600 dark:hover:text-neutral-400'
                  }`}
                  onClick={() => onChange({ returnRate: p.rate })}
                >
                  {p.label} ({p.rate}%)
                </button>
              ))}
            </div>
          </div>

          {/* Starting Balance */}
          <div>
            <label className="input-label">Starting Balance</label>
            <NumericInput
              value={fund.startingBalance || ''}
              onChange={(v) => onChange({ startingBalance: v })}
              min={0}
              step={1000}
              prefix="$"
            />
          </div>

          {/* Contribution */}
          <div>
            <label className="input-label relative group/contrib inline-flex items-center gap-1">
              Contribution
              {fund.contributionType === 'percent_of_income' && (
                <>
                  <span className="text-slate-300 dark:text-neutral-600 cursor-help">ⓘ</span>
                  <div className="absolute bottom-full left-0 mb-2 w-52 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed normal-case tracking-normal font-normal opacity-0 pointer-events-none group-hover/contrib:opacity-100 transition-opacity z-50 shadow-xl text-left">
                    Percentage of your annual income contributed to this fund. The actual dollar amount grows automatically as your income increases.
                  </div>
                </>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  {fund.contributionType === 'fixed' ? (
                    <NumericInput
                      value={fund.contribution || ''}
                      onChange={(v) => onChange({ contribution: v })}
                      min={0}
                      step={100}
                      prefix="$"
                    />
                  ) : (
                    <>
                      <input
                        type="number"
                        className="input-field pr-7"
                        value={fund.contribution || ''}
                        onChange={(e) => onChange({ contribution: Math.min(Number(e.target.value) || 0, 100) })}
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
                      className={`px-2 rounded-md text-xs font-medium transition-all ${fund.contributionType === 'fixed' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                      onClick={() => onChange({ contributionType: 'fixed' })}
                    >$</button>
                    <button
                      className={`px-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${fund.contributionType === 'percent_of_income' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                      onClick={() => onChange({ contributionType: 'percent_of_income' })}
                    >%</button>
                  </div>
                )}
              </div>
              <select
                className="select-field"
                value={fund.contributionFrequency}
                onChange={(e) => onChange({ contributionFrequency: e.target.value as ContributionFrequency })}
              >
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>

          {/* Contribution Growth — only for fixed $ contributions; % of income grows via income growth */}
          {fund.contributionType === 'fixed' && (
          <div>
              <label className="input-label">Contribution Increase</label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    {fund.contributionGrowthType === 'fixed' ? (
                      <NumericInput
                        value={fund.contributionGrowthRate || ''}
                        onChange={(v) => onChange({ contributionGrowthRate: v })}
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
                          value={fund.contributionGrowthRate}
                          onChange={(e) => onChange({ contributionGrowthRate: Math.min(Number(e.target.value) || 0, 100) })}
                          min={0}
                          max={100}
                          step={0.5}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
                      </>
                    )}
                  </div>
                  <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 h-[38px]">
                    <button
                      className={`px-2 rounded-md text-xs font-medium transition-all ${fund.contributionGrowthType === 'fixed' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                      onClick={() => onChange({ contributionGrowthType: 'fixed', contributionGrowthRate: 0 })}
                    >$</button>
                    <button
                      className={`px-2 rounded-md text-xs font-medium transition-all ${fund.contributionGrowthType === 'percent' ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 shadow-sm' : 'text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-400'}`}
                      onClick={() => onChange({ contributionGrowthType: 'percent', contributionGrowthRate: 0 })}
                    >%</button>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">every</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      className="input-field pr-8"
                      value={fund.contributionGrowthInterval}
                      onChange={(e) => onChange({ contributionGrowthInterval: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                      min={1}
                      max={50}
                      step={1}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-[10px]">
                      {fund.contributionGrowthInterval === 1 ? 'yr' : 'yrs'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
