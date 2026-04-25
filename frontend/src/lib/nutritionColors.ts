// Macro percentage targets are stored as whole numbers (20 = 20%); macros
// from MonthSummary are also whole numbers (e.g. 32.5).
export function pctColor(pct: number | null, low: number, high: number): string | undefined {
  if (pct == null) return undefined;
  return pct >= low && pct <= high ? "green" : "red";
}

// Single-cap fields like cholesterol & sodium: green if value <= max, else red.
export function maxColor(value: number, max: number): string {
  return value <= max ? "green" : "red";
}

// Range fields like fiber: green if low <= value <= high.
export function rangeColor(value: number, low: number, high: number): string {
  return value >= low && value <= high ? "green" : "red";
}

// Min-only fields like protein_min and creatine_min: green if value >= min.
export function minColor(value: number, min: number): string {
  return value >= min ? "green" : "red";
}

export function surplusColor(isSurplus: boolean): string {
  return isSurplus ? "red" : "green";
}
