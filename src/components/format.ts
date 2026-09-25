const PERCENT_DIGITS = 1;

export function formatPercent(ratio: number, digits = PERCENT_DIGITS): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatCount(count: number): string {
  return Math.round(count).toLocaleString("en-IN");
}

export function padCount(count: number): string {
  return String(count).padStart(2, "0");
}
