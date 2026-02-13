import { GlobalSettings as GlobalSettingsType, TimelineMode } from '../types';
import NumericInput from './NumericInput';

interface GlobalSettingsPanelProps {
  settings: GlobalSettingsType;
  onChange: (updates: Partial<GlobalSettingsType>) => void;
}

export default function GlobalSettingsPanel({ settings, onChange }: GlobalSettingsPanelProps) {
  return (
    <div className="card space-y-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
        Global Settings
      </h2>

      {/* Time Horizon + Inflation */}
      <div>
        <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
          {/* Time Horizon Label */}
          <label className="input-label">Time Horizon</label>
          {/* Inflation Label */}
          <label className="input-label text-right w-28">Inflation</label>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-4 mb-3">
          {/* Time Horizon Buttons */}
          <div className="flex gap-2">
            <button
              className={`flex-1 toggle-btn ${settings.timelineMode === 'years' ? 'toggle-btn-active' : 'toggle-btn-inactive'}`}
              onClick={() => onChange({ timelineMode: 'years' as TimelineMode })}
            >
              Years
            </button>
            <button
              className={`flex-1 toggle-btn ${settings.timelineMode === 'retirement' ? 'toggle-btn-active' : 'toggle-btn-inactive'}`}
              onClick={() => onChange({ timelineMode: 'retirement' as TimelineMode })}
            >
              Retirement Age
            </button>
          </div>

          {/* Inflation Toggle */}
          <div className="w-28 flex">
            <button
              className={`w-full toggle-btn ${settings.showReal ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40' : 'toggle-btn-inactive'} group relative`}
              onClick={() => onChange({ showReal: !settings.showReal })}
            >
              {settings.showReal ? 'On' : 'Off'}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl text-left font-normal normal-case tracking-normal">
                Enable to adjust all values for inflation, showing amounts in today's purchasing power.
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
          {/* Time Horizon Inputs */}
          <div>
          {settings.timelineMode === 'years' ? (
            <div>
              <input
                type="number"
                className="input-field"
                value={settings.years || ''}
                onChange={(e) => onChange({ years: Number(e.target.value) || 1 })}
                min={1}
                max={100}
              />
              <input
                type="range"
                className="w-full mt-2 accent-sky-500 dark:accent-neutral-400"
                value={settings.years}
                onChange={(e) => onChange({ years: Number(e.target.value) })}
                min={1}
                max={60}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Current Age</label>
                <input
                  type="number"
                  className="input-field"
                  value={settings.currentAge || ''}
                  onChange={(e) => onChange({ currentAge: Number(e.target.value) || 1 })}
                  min={1}
                  max={120}
                />
              </div>
              <div>
                <label className="input-label">Retirement Age</label>
                <input
                  type="number"
                  className="input-field"
                  value={settings.retirementAge || ''}
                  onChange={(e) => onChange({ retirementAge: Number(e.target.value) || 1 })}
                  min={1}
                  max={120}
                />
              </div>
            </div>
          )}
          </div>

          {/* Inflation Rate Input */}
          <div className="w-28">
          {settings.showReal && (
            <div className="relative w-full">
              <input
                type="number"
                className="input-field pr-7 text-right"
                value={settings.inflationRate}
                onChange={(e) => onChange({ inflationRate: Math.min(Math.max(Number(e.target.value) || 0, 0), 100) })}
                min={0}
                max={20}
                step={0.5}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Income */}
      <div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Annual Income</label>
            <NumericInput
              value={settings.income || ''}
              onChange={(v) => onChange({ income: v })}
              min={0}
              step={5000}
              prefix="$"
            />
          </div>
          <div className="group/ig relative">
            <label className="input-label">Income Growth</label>
            <div className="relative">
              <input
                type="number"
                className="input-field pr-7"
                value={settings.incomeGrowthRate}
                onChange={(e) => onChange({ incomeGrowthRate: Math.min(Math.max(Number(e.target.value) || 0, 0), 100) })}
                min={0}
                max={30}
                step={0.5}
              />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">%</span>
              </div>
            <div className="absolute bottom-full left-0 mb-2 w-56 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-xs text-slate-600 dark:text-neutral-300 leading-relaxed opacity-0 pointer-events-none group-hover/ig:opacity-100 transition-opacity z-50 shadow-xl text-left">
              Annual percentage your income is expected to grow. This affects percent-of-income contributions, increasing them each year in line with your salary.
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-neutral-600 mt-1">Used when fund contribution is set as % of income</p>
      </div>
    </div>
  );
}
