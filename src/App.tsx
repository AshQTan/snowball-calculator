import { useState, useMemo, useCallback, useEffect } from 'react';
import { AppState, GlobalSettings, Fund, ChartMode, CustomMilestone, Strategy, MILESTONE_ICONS, STRATEGY_COLORS, MAX_STRATEGIES, getDefaultState, createStrategy } from './types';
import { computeProjection } from './utils/calculations';
import { formatCompact } from './utils/formatters';
import { stateToURL, stateFromURL, exportToCSV } from './utils/sharing';
import Header from './components/Header';
import GlobalSettingsPanel from './components/GlobalSettingsPanel';
import FundsPanel from './components/FundsPanel';
import ProjectionChart from './components/ProjectionChart';
import ProjectionChartComparison from './components/ProjectionChartComparison';
import CompositionChart from './components/CompositionChart';
import SummaryStats, { MilestoneBadge } from './components/SummaryStats';
import ScheduleTable from './components/ScheduleTable';

export default function App() {
  const [state, setState] = useState<AppState>(() => stateFromURL() || getDefaultState());
  const [shareToast, setShareToast] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showMilestones, setShowMilestones] = useState(true);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [newMsName, setNewMsName] = useState('');
  const [newMsAmount, setNewMsAmount] = useState('');
  const [newMsIcon, setNewMsIcon] = useState(MILESTONE_ICONS[0]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Derive active strategy and funds
  const activeStrategy = useMemo(
    () => state.strategies.find((s) => s.id === state.activeStrategyId) || state.strategies[0],
    [state.strategies, state.activeStrategyId],
  );
  const activeFunds = activeStrategy.funds;

  // Compute projections for all strategies
  const allResults = useMemo(
    () => new Map(state.strategies.map((s) => [
      s.id,
      computeProjection(state.global, s.funds, state.customMilestones),
    ])),
    [state.strategies, state.global, state.customMilestones],
  );
  const result = allResults.get(state.activeStrategyId) || allResults.values().next().value!;

  const updateGlobal = useCallback((updates: Partial<GlobalSettings>) => {
    setState((prev) => ({ ...prev, global: { ...prev.global, ...updates } }));
  }, []);

  const updateFunds = useCallback((funds: Fund[]) => {
    setState((prev) => ({
      ...prev,
      strategies: prev.strategies.map((s) =>
        s.id === prev.activeStrategyId ? { ...s, funds } : s
      ),
    }));
  }, []);

  const setChartMode = useCallback((chartMode: ChartMode) => {
    setState((prev) => ({ ...prev, chartMode }));
  }, []);

  const handleShare = useCallback(() => {
    const url = stateToURL(state);
    navigator.clipboard.writeText(url).then(() => {
      window.history.replaceState({}, '', url);
      setShareToast(true);
    }).catch(() => {
      // Fallback: still update URL even if clipboard fails
      window.history.replaceState({}, '', url);
    });
  }, [state]);

  const handleExport = useCallback(() => {
    exportToCSV(result.schedule, state.global.timelineMode === 'retirement');
  }, [result.schedule, state.global.timelineMode]);

  const addCustomMilestone = useCallback(() => {
    const amount = parseFloat(newMsAmount.replace(/,/g, ''));
    if (!newMsName.trim() || isNaN(amount) || amount <= 0) return;
    if (editingMilestoneId) {
      // Update existing milestone
      setState((prev) => ({
        ...prev,
        customMilestones: prev.customMilestones.map((m) =>
          m.id === editingMilestoneId ? { ...m, name: newMsName.trim(), amount, icon: newMsIcon } : m
        ),
      }));
    } else {
      // Add new milestone
      const cm: CustomMilestone = {
        id: crypto.randomUUID(),
        name: newMsName.trim(),
        amount,
        icon: newMsIcon,
      };
      setState((prev) => ({ ...prev, customMilestones: [...prev.customMilestones, cm] }));
    }
    setNewMsName('');
    setNewMsAmount('');
    setNewMsIcon(MILESTONE_ICONS[0]);
    setEditingMilestoneId(null);
    setShowAddMilestone(false);
  }, [newMsName, newMsAmount, newMsIcon, editingMilestoneId]);

  const removeCustomMilestone = useCallback((id: string) => {
    setState((prev) => ({ ...prev, customMilestones: prev.customMilestones.filter((m) => m.id !== id) }));
    if (editingMilestoneId === id) {
      setEditingMilestoneId(null);
      setNewMsName('');
      setNewMsAmount('');
      setNewMsIcon(MILESTONE_ICONS[0]);
      setShowAddMilestone(false);
    }
  }, [editingMilestoneId]);

  const startEditingMilestone = useCallback((id: string) => {
    const cm = state.customMilestones.find((m) => m.id === id);
    if (!cm) return;
    setEditingMilestoneId(id);
    setNewMsName(cm.name);
    setNewMsAmount(String(cm.amount));
    setNewMsIcon(cm.icon);
    setShowAddMilestone(true);
  }, [state.customMilestones]);

  useEffect(() => {
    if (shareToast) {
      const t = setTimeout(() => setShareToast(false), 2500);
      return () => clearTimeout(t);
    }
  }, [shareToast]);

  const showIncomeOption = state.global.income > 0;

  // — Strategy management —
  const nextStrategyColor = useCallback((strategies: Strategy[]) => {
    const usedColors = new Set(strategies.map((s) => s.color));
    return STRATEGY_COLORS.find((c) => !usedColors.has(c)) || STRATEGY_COLORS[0];
  }, []);

  const addStrategy = useCallback(() => {
    setState((prev) => {
      if (prev.strategies.length >= MAX_STRATEGIES) return prev;
      const active = prev.strategies.find((s) => s.id === prev.activeStrategyId) || prev.strategies[0];
      // Generate unique name: Strategy 2, Strategy 3, etc.
      const existingNames = new Set(prev.strategies.map((s) => s.name));
      let n = prev.strategies.length + 1;
      while (existingNames.has(`Strategy ${n}`)) n++;
      const baseName = `Strategy ${n}`;
      const newFunds = active.funds.map((f) => ({ ...f, id: crypto.randomUUID() }));
      const color = nextStrategyColor(prev.strategies);
      const strategy = createStrategy(baseName, color, newFunds);
      return {
        ...prev,
        strategies: [...prev.strategies, strategy],
        activeStrategyId: strategy.id,
      };
    });
  }, [nextStrategyColor]);

  const deleteStrategy = useCallback((id: string) => {
    setState((prev) => {
      if (prev.strategies.length <= 1) return prev;
      const filtered = prev.strategies.filter((s) => s.id !== id);
      return {
        ...prev,
        strategies: filtered,
        activeStrategyId: prev.activeStrategyId === id ? filtered[0].id : prev.activeStrategyId,
      };
    });
  }, []);

  const renameStrategy = useCallback((id: string, name: string) => {
    if (!name.trim()) return;
    setState((prev) => ({
      ...prev,
      strategies: prev.strategies.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)),
    }));
  }, []);

  const duplicateStrategy = useCallback((id: string) => {
    setState((prev) => {
      if (prev.strategies.length >= MAX_STRATEGIES) return prev;
      const source = prev.strategies.find((s) => s.id === id);
      if (!source) return prev;
      let baseName = `${source.name} (copy)`;
      const existingNames = new Set(prev.strategies.map((s) => s.name));
      if (existingNames.has(baseName)) {
        let i = 2;
        while (existingNames.has(`${source.name} (copy ${i})`)) i++;
        baseName = `${source.name} (copy ${i})`;
      }
      const newFunds = source.funds.map((f) => ({ ...f, id: crypto.randomUUID() }));
      const color = nextStrategyColor(prev.strategies);
      const strategy = createStrategy(baseName, color, newFunds);
      return {
        ...prev,
        strategies: [...prev.strategies, strategy],
        activeStrategyId: strategy.id,
      };
    });
  }, [nextStrategyColor]);

  const setActiveStrategyId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeStrategyId: id }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-neutral-950 transition-colors duration-500">
      <Header onShare={handleShare} onExportPDF={() => window.print()} darkMode={darkMode} onToggleDark={() => setDarkMode(!darkMode)} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: Settings */}
          <div className="space-y-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-2 lg:sticky lg:top-[76px]">
            <GlobalSettingsPanel settings={state.global} onChange={updateGlobal} />
            <FundsPanel
              funds={activeFunds}
              showIncomeOption={showIncomeOption}
              onChange={updateFunds}
              strategies={state.strategies}
              activeStrategyId={state.activeStrategyId}
              onSwitchStrategy={setActiveStrategyId}
              onAddStrategy={addStrategy}
              onDeleteStrategy={deleteStrategy}
              onRenameStrategy={renameStrategy}
              onDuplicateStrategy={duplicateStrategy}
            />
          </div>

          {/* Right: Results */}
          <div className="space-y-4 min-w-0">
            <SummaryStats result={result} showReal={state.global.showReal} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMilestones(!showMilestones)}
                className={`btn-ghost text-xs transition-colors ${
                  showMilestones
                    ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30'
                    : 'text-slate-400 dark:text-neutral-500'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${showMilestones ? 'bg-sky-500' : 'bg-slate-300 dark:bg-neutral-600'}`} />
                Milestones {showMilestones ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setShowAddMilestone(!showAddMilestone)}
                className={`btn-ghost text-xs transition-colors ${
                  showAddMilestone
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    : 'text-slate-400 dark:text-neutral-500'
                }`}
              >
                <span className="text-sm leading-none mr-1">+</span>
                Custom
              </button>
            </div>
            {showAddMilestone && (
              <div className="card !p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">{editingMilestoneId ? 'Edit Custom Milestone' : 'Add Custom Milestone'}</span>
                  <button onClick={() => { setShowAddMilestone(false); setEditingMilestoneId(null); setNewMsName(''); setNewMsAmount(''); setNewMsIcon(MILESTONE_ICONS[0]); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 text-lg leading-none">&times;</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-neutral-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={newMsName}
                      onChange={(e) => setNewMsName(e.target.value)}
                      placeholder="e.g. Emergency Fund"
                      className="w-full text-sm bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-neutral-200 placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-neutral-400 mb-1">Target Amount</label>
                    <input
                      type="text"
                      value={newMsAmount}
                      onChange={(e) => setNewMsAmount(e.target.value)}
                      placeholder="e.g. 75000"
                      className="w-full text-sm bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-neutral-200 placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-400 tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-neutral-400 mb-1">Icon</label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {MILESTONE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewMsIcon(icon)}
                        className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all ${
                          newMsIcon === icon
                            ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 scale-110'
                            : 'bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addCustomMilestone}
                  disabled={!newMsName.trim() || !newMsAmount.trim()}
                  className="w-full text-xs font-medium py-1.5 rounded-md transition-colors bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingMilestoneId ? 'Save Milestone' : 'Add Milestone'}
                </button>
                {editingMilestoneId && (
                  <button
                    onClick={() => removeCustomMilestone(editingMilestoneId)}
                    className="w-full text-xs font-medium py-1.5 rounded-md transition-colors bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                  >
                    Delete Milestone
                  </button>
                )}
                {state.customMilestones.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-neutral-700 pt-2 space-y-1.5">
                    <span className="text-[11px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Custom milestones</span>
                    {state.customMilestones.map((cm) => (
                      <div key={cm.id} className="flex items-center justify-between bg-slate-50 dark:bg-neutral-800/40 rounded-md px-2.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cm.icon}</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-neutral-300">{cm.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500">{formatCompact(cm.amount)}</span>
                        </div>
                        <button onClick={() => removeCustomMilestone(cm.id)} className="text-slate-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 text-sm leading-none">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showMilestones && result.milestones.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.milestones.map((m, i) => (
                  <MilestoneBadge
                    key={m.amount}
                    milestone={m}
                    chevronCount={i + 1}
                    onClick={m.customMilestoneId ? () => startEditingMilestone(m.customMilestoneId!) : undefined}
                  />
                ))}
              </div>
            )}
            {state.strategies.length > 1 ? (
              <ProjectionChartComparison
                strategies={state.strategies}
                allResults={allResults}
                showReal={state.global.showReal}
                inflationRate={state.global.inflationRate}
                timelineMode={state.global.timelineMode}
                chartMode={state.chartMode}
                darkMode={darkMode}
                onChartModeChange={setChartMode}
              />
            ) : (
              <ProjectionChart
                schedule={result.schedule}
                funds={activeFunds}
                milestones={showMilestones ? result.milestones : []}
                showReal={state.global.showReal}
                inflationRate={state.global.inflationRate}
                timelineMode={state.global.timelineMode}
                chartMode={state.chartMode}
                darkMode={darkMode}
                onChartModeChange={setChartMode}
              />
            )}
            <CompositionChart
              schedule={result.schedule}
              funds={activeFunds}
              darkMode={darkMode}
              timelineMode={state.global.timelineMode}
            />
            <ScheduleTable
              schedule={result.schedule}
              funds={activeFunds}
              showReal={state.global.showReal}
              darkMode={darkMode}
              timelineMode={state.global.timelineMode}
              milestones={showMilestones ? result.milestones : []}
              onExport={handleExport}
            />
          </div>
        </div>
      </main>

      {shareToast && (
        <div className="fixed bottom-6 right-6 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-200 text-sm px-4 py-2.5 rounded-lg shadow-xl z-50">
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}
