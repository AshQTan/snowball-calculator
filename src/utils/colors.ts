// Shared color constants and utilities used across chart/table components

export const COLOR_STARTING = '#6366f1'; // indigo
export const COLOR_CONTRIBUTIONS = '#22c55e'; // green
export const COLOR_INTEREST = '#f59e0b'; // amber
export const COLOR_DEBT = '#f43f5e'; // rose
export const COLOR_NETWORTH = '#8b5cf6'; // violet

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) =>
        Math.round(Math.max(0, Math.min(255, c)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

export function mixColor(hex: string, target: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(target);
  return rgbToHex(
    r1 + (r2 - r1) * amount,
    g1 + (g2 - g1) * amount,
    b1 + (b2 - b1) * amount
  );
}

export function fundVariants(color: string, darkMode: boolean) {
  return {
    starting: mixColor(color, darkMode ? '#0a0a0a' : '#1e293b', 0.55),
    contributions: color,
    interest: mixColor(color, darkMode ? '#e5e5e5' : '#ffffff', 0.45),
  };
}
