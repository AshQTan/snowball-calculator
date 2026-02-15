import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, MoreHorizontal, Copy, Trash2, Pencil } from 'lucide-react';
import { Fund, Strategy, MAX_STRATEGIES, STRATEGY_COLORS, FUND_COLORS, createFund } from '../types';
import FundConfigurator from './FundConfigurator';

interface FundsPanelProps {
  funds: Fund[];
  showIncomeOption: boolean;
  onChange: (funds: Fund[]) => void;
  strategies: Strategy[];
  activeStrategyId: string;
  onSwitchStrategy: (id: string) => void;
  onAddStrategy: () => void;
  onDeleteStrategy: (id: string) => void;
  onRenameStrategy: (id: string, name: string) => void;
  onDuplicateStrategy: (id: string) => void;
  onChangeStrategyColor: (id: string, color: string) => void;
}

function StrategyTabMenu({
  anchorRect,
  canDelete,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
}: {
  anchorRect: DOMRect;
  canDelete: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      <button onClick={() => { onRename(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700">
        <Pencil className="w-3 h-3" /> Rename
      </button>
      <button onClick={() => { onDuplicate(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700">
        <Copy className="w-3 h-3" /> Duplicate
      </button>
      {canDelete && (
        <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      )}
    </div>,
    document.body,
  );
}

function StrategyColorPicker({
  anchorRect,
  currentColor,
  onChange,
  onClose,
}: {
  anchorRect: DOMRect;
  currentColor: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-xl p-2"
      style={{ top: anchorRect.bottom + 6, left: anchorRect.left - 40 }}
    >
      <div className="flex items-center gap-2">
        {STRATEGY_COLORS.map((c) => (
          <button
            key={c}
            className={`color-swatch ${currentColor === c ? 'color-swatch-active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => { onChange(c); }}
          />
        ))}
        <div className="relative">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => { onChange(e.target.value); }}
            className="w-6 h-6 rounded-md cursor-pointer border-2 border-slate-300 dark:border-neutral-700"
            title="Custom color"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FundsPanel({
  funds,
  showIncomeOption,
  onChange,
  strategies,
  activeStrategyId,
  onSwitchStrategy,
  onAddStrategy,
  onDeleteStrategy,
  onRenameStrategy,
  onDuplicateStrategy,
  onChangeStrategyColor,
}: FundsPanelProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [colorPickerRect, setColorPickerRect] = useState<DOMRect | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const addFund = () => {
    const newFund = createFund(funds.length);
    const usedColors = new Set(funds.map((f) => f.color));
    const available = FUND_COLORS.find((c) => !usedColors.has(c));
    if (available) newFund.color = available;
    onChange([...funds, newFund]);
  };

  const updateFund = (id: string, updates: Partial<Fund>) => {
    onChange(funds.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteFund = (id: string) => {
    onChange(funds.filter((f) => f.id !== id));
  };

  const startRename = useCallback((id: string) => {
    const strategy = strategies.find((s) => s.id === id);
    if (!strategy) return;
    setRenamingId(id);
    setRenameValue(strategy.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, [strategies]);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameStrategy(renamingId, renameValue);
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onRenameStrategy]);

  const totalStarting = funds.reduce((s, f) => s + f.startingBalance, 0);
  const showTabs = strategies.length > 1;
  const activeStrategy = strategies.find((s) => s.id === activeStrategyId);
  const panelStyle = showTabs && activeStrategy
    ? { borderColor: `${activeStrategy.color}33`, backgroundColor: `${activeStrategy.color}21` } as React.CSSProperties
    : undefined;

  return (
    <div className="card space-y-4" style={panelStyle}>
      {/* Strategy tabs — only shown when 2+ strategies */}
      {showTabs && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 border-b border-slate-200 dark:border-neutral-700">
          {strategies.map((s) => (
            <div key={s.id} className="relative flex-shrink-0">
              {renamingId === s.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }}
                  className="text-xs font-medium px-2 py-1 rounded-md bg-white dark:bg-neutral-800 border border-sky-400 outline-none w-28"
                />
              ) : (
                <button
                  onClick={() => onSwitchStrategy(s.id)}
                  onContextMenu={(e) => { e.preventDefault(); setMenuOpenId(s.id); }}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors max-w-[140px] ${
                    s.id === activeStrategyId
                      ? 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-200'
                      : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 cursor-pointer hover:scale-125 transition-transform ring-offset-1 ring-offset-white dark:ring-offset-neutral-900"
                    style={{ backgroundColor: s.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (colorPickerId === s.id) {
                        setColorPickerId(null);
                        setColorPickerRect(null);
                      } else {
                        setColorPickerId(s.id);
                        setColorPickerRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                      }
                    }}
                    title="Change color"
                  />
                  <span className="truncate">{s.name}</span>
                  <MoreHorizontal
                    className="w-3 h-3 flex-shrink-0 opacity-40 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuOpenId === s.id) {
                        setMenuOpenId(null);
                        setMenuAnchorRect(null);
                      } else {
                        setMenuOpenId(s.id);
                        setMenuAnchorRect((e.currentTarget as unknown as HTMLElement).closest('button')!.getBoundingClientRect());
                      }
                    }}
                  />
                </button>
              )}
              {menuOpenId === s.id && menuAnchorRect && (
                <StrategyTabMenu
                  anchorRect={menuAnchorRect}
                  canDelete={strategies.length > 1}
                  onRename={() => startRename(s.id)}
                  onDuplicate={() => onDuplicateStrategy(s.id)}
                  onDelete={() => onDeleteStrategy(s.id)}
                  onClose={() => { setMenuOpenId(null); setMenuAnchorRect(null); }}
                />
              )}
              {colorPickerId === s.id && colorPickerRect && (
                <StrategyColorPicker
                  anchorRect={colorPickerRect}
                  currentColor={s.color}
                  onChange={(color) => onChangeStrategyColor(s.id, color)}
                  onClose={() => { setColorPickerId(null); setColorPickerRect(null); }}
                />
              )}
            </div>
          ))}
          {strategies.length < MAX_STRATEGIES && (
            <button
              onClick={onAddStrategy}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
              title="Add strategy"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
            Funds
          </h2>
          {totalStarting > 0 && (
            <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
              Total starting: ${totalStarting.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!showTabs && (
            <button
              onClick={onAddStrategy}
              className="btn-ghost text-xs text-slate-400 dark:text-neutral-500"
              title="Compare strategies"
            >
              <Plus className="w-3.5 h-3.5" />
              Strategy
            </button>
          )}
          <button onClick={addFund} className="btn-ghost text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Fund
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {funds.map((fund) => (
          <FundConfigurator
            key={fund.id}
            fund={fund}
            canDelete={funds.length > 1}
            showIncomeOption={showIncomeOption}
            onChange={(updates) => updateFund(fund.id, updates)}
            onDelete={() => deleteFund(fund.id)}
          />
        ))}
      </div>
    </div>
  );
}
