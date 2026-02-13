interface LegendItemProps {
  color: string;
  label: string;
  type?: 'line' | 'square';
}

export default function LegendItem({ color, label, type = 'square' }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      {type === 'line' ? (
        <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      ) : (
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      )}
      <span className="text-xs text-slate-400 dark:text-neutral-500">{label}</span>
    </div>
  );
}
