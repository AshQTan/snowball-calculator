import { useState, useMemo, useCallback, useEffect } from 'react';
import { AppState, GlobalSettings, Fund, ChartMode, getDefaultState } from './types';
import { computeProjection } from './utils/calculations';
import { stateToURL, stateFromURL, exportToCSV } from './utils/sharing';
import Header from './components/Header';
import GlobalSettingsPanel from './components/GlobalSettingsPanel';
import FundsPanel from './components/FundsPanel';
import ProjectionChart from './components/ProjectionChart';
import CompositionChart from './components/CompositionChart';
import SummaryStats from './components/SummaryStats';
import ScheduleTable from './components/ScheduleTable';

export default function App() {
  const [state, setState] = useState<AppState>(() => stateFromURL() || getDefaultState());
  const [shareToast, setShareToast] = useState(false);

  const result = useMemo(() => computeProjection(state), [state]);

  const updateGlobal = useCallback((updates: Partial<GlobalSettings>) => {
    setState((prev) => ({ ...prev, global: { ...prev.global, ...updates } }));
  }, []);

  const updateFunds = useCallback((funds: Fund[]) => {
    setState((prev) => ({ ...prev, funds }));
  }, []);

  const setChartMode = useCallback((chartMode: ChartMode) => {
    setState((prev) => ({ ...prev, chartMode }));
  }, []);

  const handleShare = useCallback(() => {
    const url = stateToURL(state);
    navigator.clipboard.writeText(url).then(() => {
      window.history.replaceState({}, '', url);
      setShareToast(true);
    });
  }, [state]);

  const handleExport = useCallback(() => {
    exportToCSV(result.schedule, state.global.timelineMode === 'retirement');
  }, [result.schedule, state.global.timelineMode]);

  useEffect(() => {
    if (shareToast) {
      const t = setTimeout(() => setShareToast(false), 2500);
      return () => clearTimeout(t);
    }
  }, [shareToast]);

  const showIncomeOption = state.global.income > 0;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <Header onShare={handleShare} onExport={handleExport} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: Settings */}
          <div className="space-y-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-2 lg:sticky lg:top-[76px]">
            <GlobalSettingsPanel settings={state.global} onChange={updateGlobal} />
            <FundsPanel funds={state.funds} showIncomeOption={showIncomeOption} onChange={updateFunds} />
          </div>

          {/* Right: Results */}
          <div className="space-y-4 min-w-0">
            <SummaryStats result={result} showReal={state.global.showReal} />
            <ProjectionChart
              schedule={result.schedule}
              funds={state.funds}
              milestones={result.milestones}
              showReal={state.global.showReal}
              timelineMode={state.global.timelineMode}
              chartMode={state.chartMode}
              onChartModeChange={setChartMode}
            />
            <CompositionChart
              schedule={result.schedule}
              funds={state.funds}
              timelineMode={state.global.timelineMode}
            />
            <ScheduleTable
              schedule={result.schedule}
              funds={state.funds}
              showReal={state.global.showReal}
              timelineMode={state.global.timelineMode}
              milestones={result.milestones}
            />
          </div>
        </div>
      </main>

      {shareToast && (
        <div className="fixed bottom-6 right-6 bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm px-4 py-2.5 rounded-lg shadow-xl z-50">
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}
