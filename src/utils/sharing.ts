import { AppState, getDefaultState } from '../types';

export function stateToURL(state: AppState): string {
  const params = new URLSearchParams();
  const g = state.global;
  params.set('tm', g.timelineMode);
  params.set('y', String(g.years));
  params.set('ca', String(g.currentAge));
  params.set('ra', String(g.retirementAge));
  params.set('ir', String(g.inflationRate));
  params.set('sr', g.showReal ? '1' : '0');
  params.set('inc', String(g.income));
  params.set('ig', String(g.incomeGrowthRate));

  const funds = state.funds.map((f) => ({
    n: f.name,
    c: f.color,
    sb: f.startingBalance,
    ct: f.contribution,
    cty: f.contributionType,
    cf: f.contributionFrequency,
    cg: f.contributionGrowthRate,
    cgt: f.contributionGrowthType,
    cgi: f.contributionGrowthInterval,
    r: f.returnRate,
  }));
  params.set('f', JSON.stringify(funds));
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export function stateFromURL(): AppState | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('f')) return null;
  try {
    const d = getDefaultState();
    const st: AppState = {
      global: {
        timelineMode: (params.get('tm') as 'years' | 'retirement') || d.global.timelineMode,
        years: Number(params.get('y')) || d.global.years,
        currentAge: Number(params.get('ca')) || d.global.currentAge,
        retirementAge: Number(params.get('ra')) || d.global.retirementAge,
        inflationRate: Number(params.get('ir')) ?? d.global.inflationRate,
        showReal: params.get('sr') === '1',
        income: Number(params.get('inc')) || d.global.income,
        incomeGrowthRate: Number(params.get('ig')) ?? d.global.incomeGrowthRate,
      },
      funds: d.funds,
      chartMode: 'line',
    };
    const fundsRaw = JSON.parse(params.get('f')!) as {
      n: string; c: string; sb: number; ct: number;
      cty: string; cf: string; cg: number; cgt?: string; cgi?: number; r: number;
    }[];
    st.funds = fundsRaw.map((f) => ({
      id: crypto.randomUUID(),
      name: f.n,
      color: f.c,
      startingBalance: f.sb,
      contribution: f.ct,
      contributionType: f.cty as 'fixed' | 'percent_of_income',
      contributionFrequency: f.cf as 'monthly' | 'annually',
      contributionGrowthRate: f.cg,
      contributionGrowthType: (f.cgt as 'percent' | 'fixed') || 'percent',
      contributionGrowthInterval: f.cgi || 1,
      returnRate: f.r,
    }));
    return st;
  } catch {
    return null;
  }
}

export function exportToCSV(
  schedule: { year: number; age: number | null; startBalance: number; totalContribution: number; totalInterest: number; endBalance: number; cumulativeContributions: number; cumulativeInterest: number }[],
  showAge: boolean,
): void {
  const headers = [
    'Year', ...(showAge ? ['Age'] : []),
    'Start Balance', 'Contribution', 'Interest', 'End Balance',
    'Cumulative Contributions', 'Cumulative Interest',
  ];
  const rows = schedule.map((r) => [
    r.year, ...(showAge ? [r.age ?? ''] : []),
    r.startBalance.toFixed(2), r.totalContribution.toFixed(2),
    r.totalInterest.toFixed(2), r.endBalance.toFixed(2),
    r.cumulativeContributions.toFixed(2), r.cumulativeInterest.toFixed(2),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'snowball.csv';
  a.click();
  URL.revokeObjectURL(url);
}
