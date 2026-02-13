export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 100_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatCurrency(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

export function formatYears(value: number): string {
  if (value === Infinity) return '—';
  if (value < 1) return `${(value * 12).toFixed(0)} months`;
  return `${value.toFixed(1)} years`;
}

export function formatCompact(value: number): string {
  if (value >= 10_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}
