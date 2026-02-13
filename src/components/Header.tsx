import { TrendingUp, Share2, Moon, Sun, FileDown } from 'lucide-react';

interface HeaderProps {
  onShare: () => void;
  onExportPDF: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}

export default function Header({ onShare, onExportPDF, darkMode, onToggleDark }: HeaderProps) {
  return (
    <header className="border-b border-slate-200/80 dark:border-neutral-800/50 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 dark:bg-neutral-800 rounded-lg">
            <TrendingUp className="w-5 h-5 text-sky-600 dark:text-neutral-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Snowball</h1>
            <p className="text-xs text-slate-400 dark:text-neutral-500 hidden sm:block">a compound wealth calculator</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleDark} className="btn-ghost" title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={onExportPDF} className="btn-ghost" title="Export as PDF">
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button onClick={onShare} className="btn-ghost" title="Copy shareable link">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>
    </header>
  );
}
