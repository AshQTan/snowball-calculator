import { Plus } from 'lucide-react';
import { Fund, createFund } from '../types';
import FundConfigurator from './FundConfigurator';

interface FundsPanelProps {
  funds: Fund[];
  showIncomeOption: boolean;
  onChange: (funds: Fund[]) => void;
}

export default function FundsPanel({ funds, showIncomeOption, onChange }: FundsPanelProps) {
  const addFund = () => {
    onChange([...funds, createFund(funds.length)]);
  };

  const updateFund = (id: string, updates: Partial<Fund>) => {
    onChange(funds.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteFund = (id: string) => {
    onChange(funds.filter((f) => f.id !== id));
  };

  const totalStarting = funds.reduce((s, f) => s + f.startingBalance, 0);

  return (
    <div className="card space-y-4">
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
        <button onClick={addFund} className="btn-ghost text-xs">
          <Plus className="w-3.5 h-3.5" />
          Add Fund
        </button>
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
