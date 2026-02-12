import { TrendingUp, Share2, Download } from 'lucide-react';

interface HeaderProps {
  onShare: () => void;
  onExport: () => void;
}

export default function Header({ onShare, onExport }: HeaderProps) {
  return (
    <header className="border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-800 rounded-lg">
            <TrendingUp className="w-5 h-5 text-neutral-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">Snowball</h1>
            <p className="text-xs text-neutral-500 hidden sm:block">a compound wealth calculator</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onShare} className="btn-ghost" title="Copy shareable link">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button onClick={onExport} className="btn-ghost" title="Export as CSV">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
}
