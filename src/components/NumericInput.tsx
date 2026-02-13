import { useState, useCallback, useRef, useEffect } from 'react';

interface NumericInputProps {
  value: number | '';
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export default function NumericInput({
  value,
  onChange,
  min,
  max,
  step,
  className = '',
  prefix,
  suffix,
}: NumericInputProps) {
  const [focused, setFocused] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDisplay = (v: number | ''): string => {
    if (v === '' || v === 0) return '';
    return v.toLocaleString('en-US');
  };

  const handleFocus = useCallback(() => {
    setFocused(true);
    setEditValue(value === '' || value === 0 ? '' : String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = Number(editValue) || 0;
    onChange(parsed);
  }, [editValue, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  // Keep edit value in sync if value changes externally while not focused
  useEffect(() => {
    if (!focused) {
      setEditValue(value === '' || value === 0 ? '' : String(value));
    }
  }, [value, focused]);

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type={focused ? 'number' : 'text'}
        className={`input-field ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''} ${className}`}
        value={focused ? editValue : formatDisplay(value)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}
