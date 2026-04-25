import type {
  PatchedUserTargetsRequest,
  UserTargets,
} from "@/api/generated/models";

export type TargetField = keyof Omit<
  UserTargets,
  "id" | "created_at" | "updated_at"
>;

export interface TargetRowDef {
  label: string;
  low: TargetField;
  high?: TargetField;
  step: number;
  min?: number;
  max?: number;
  decimalScale?: number;
}

export const ROWS: TargetRowDef[] = [
  { label: "Fat %", low: "fat_pct_low", high: "fat_pct_high", step: 1, max: 100 },
  { label: "Sat Fat %", low: "sat_fat_pct_low", high: "sat_fat_pct_high", step: 1, max: 100 },
  { label: "Carb %", low: "carb_pct_low", high: "carb_pct_high", step: 1, max: 100 },
  { label: "Protein %", low: "protein_pct_low", high: "protein_pct_high", step: 1, max: 100 },
  { label: "Added Sugar %", low: "added_sugar_pct_low", high: "added_sugar_pct_high", step: 1, max: 100 },
  { label: "Cholesterol (mg)", low: "cholesterol_low", high: "cholesterol_high", step: 10 },
  { label: "Sodium (mg)", low: "sodium_low", high: "sodium_high", step: 50 },
  { label: "Fiber (g)", low: "fiber_low", high: "fiber_high", step: 1 },
  { label: "Protein min (g)", low: "protein_min", step: 1 },
  { label: "Creatine min (mg)", low: "creatine_min", step: 1 },
  { label: "Sleep hours", low: "sleep_hours_low", high: "sleep_hours_high", step: 0.5, decimalScale: 1 },
  { label: "Sleep quality (1-5)", low: "sleep_quality_low", high: "sleep_quality_high", step: 1, min: 1, max: 5 },
];

const QUALITY_FIELDS: ReadonlySet<TargetField> = new Set([
  "sleep_quality_low",
  "sleep_quality_high",
]);

export type TargetValues = Partial<Record<TargetField, number | "">>;

export function formFromServer(t: UserTargets): TargetValues {
  const out: TargetValues = {};
  for (const row of ROWS) {
    out[row.low] = parseField(t, row.low);
    if (row.high) out[row.high] = parseField(t, row.high);
  }
  return out;
}

function parseField(t: UserTargets, field: TargetField): number | "" {
  const raw = t[field];
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : "";
}

export function serverShape(diff: TargetValues): PatchedUserTargetsRequest {
  const out: Record<string, string | number> = {};
  for (const [field, value] of Object.entries(diff) as Array<[TargetField, number | ""]>) {
    if (value === "") continue;
    if (QUALITY_FIELDS.has(field)) {
      out[field] = value;
    } else {
      out[field] = String(value);
    }
  }
  return out as PatchedUserTargetsRequest;
}

export function diffMaps(current: TargetValues, server: TargetValues): TargetValues {
  const out: TargetValues = {};
  for (const row of ROWS) {
    const fields: TargetField[] = row.high ? [row.low, row.high] : [row.low];
    for (const field of fields) {
      const a = current[field];
      const b = server[field];
      if (a !== b) out[field] = a;
    }
  }
  return out;
}
