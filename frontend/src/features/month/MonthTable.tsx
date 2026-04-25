import { Paper, Table } from "@mantine/core";
import { useNavigate } from "react-router";
import {
  maxColor,
  pctColor,
  rangeColor,
  surplusColor,
} from "@/lib/nutritionColors";
import type { Day, MonthSummary } from "@/features/days/api";
import type { UserTargets } from "@/api/generated/models";

interface Props {
  days: Day[];
  summary: MonthSummary;
  targets: UserTargets | undefined;
}

function n(t: UserTargets | undefined, key: keyof UserTargets, fallback: number): number {
  const v = t?.[key];
  if (v == null || v === "") return fallback;
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

const NUM = (v: number) => v.toLocaleString();
const F1 = (v: number) => v.toFixed(1);
const F0 = (v: number) => v.toFixed(0);

export function MonthTable({ days, summary, targets }: Props) {
  const navigate = useNavigate();
  const t = targets;

  const fatLow = n(t, "fat_pct_low", 20);
  const fatHigh = n(t, "fat_pct_high", 35);
  const satLow = n(t, "sat_fat_pct_low", 0);
  const satHigh = n(t, "sat_fat_pct_high", 10);
  const carbLow = n(t, "carb_pct_low", 45);
  const carbHigh = n(t, "carb_pct_high", 65);
  const proteinLow = n(t, "protein_pct_low", 10);
  const proteinHigh = n(t, "protein_pct_high", 35);
  const addSugarLow = n(t, "added_sugar_pct_low", 0);
  const addSugarHigh = n(t, "added_sugar_pct_high", 10);
  const cholHigh = n(t, "cholesterol_high", 200);
  const sodiumHigh = n(t, "sodium_high", 2300);
  const fiberLow = n(t, "fiber_low", 28);
  const fiberHigh = n(t, "fiber_high", 34);

  const sorted = days.slice().sort((a, b) => a.date.localeCompare(b.date));

  const sumWeights = sorted
    .map((d) => (d.weight_lbs ? Number(d.weight_lbs) : null))
    .filter((w): w is number => w != null);
  const avgWeight =
    sumWeights.length > 0
      ? sumWeights.reduce((a, b) => a + b, 0) / sumWeights.length
      : null;

  const a = summary.averages;
  const m = summary.macros;
  const ttls = summary.totals;
  const dayCount = Math.max(summary.days_tracked, 1);
  const allowedAvg = ttls.allowed_calories / dayCount;

  return (
    <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
      <Table ff="monospace" fz="sm" withRowBorders={false} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Day</Table.Th>
            <Table.Th ta="right">Weight</Table.Th>
            <Table.Th ta="right">Allowed</Table.Th>
            <Table.Th ta="right">Cal</Table.Th>
            <Table.Th ta="right">Δ</Table.Th>
            <Table.Th ta="right">Fat</Table.Th>
            <Table.Th ta="right">Sat</Table.Th>
            <Table.Th ta="right">Chol</Table.Th>
            <Table.Th ta="right">Na</Table.Th>
            <Table.Th ta="right">Carbs</Table.Th>
            <Table.Th ta="right">Fiber</Table.Th>
            <Table.Th ta="right">Sugar</Table.Th>
            <Table.Th ta="right">Add S</Table.Th>
            <Table.Th ta="right">Prot</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((d) => {
            const s = d.summary;
            const totals = s.totals;
            const macros = s.macros;
            return (
              <Table.Tr
                key={d.id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/?date=${d.date}`)}
              >
                <Table.Td>{Number(d.date.slice(8, 10))}</Table.Td>
                <Table.Td ta="right">
                  {d.weight_lbs ? F1(Number(d.weight_lbs)) : "—"}
                </Table.Td>
                <Table.Td ta="right">{NUM(s.allowed_calories)}</Table.Td>
                <Table.Td ta="right" c="grape">
                  {NUM(Math.round(s.consumed_calories))}
                </Table.Td>
                <Table.Td ta="right" c={surplusColor(s.is_surplus)}>
                  {F0(Math.abs(s.net_calories))}
                </Table.Td>
                <Table.Td ta="right" c={pctColor(macros.fat_pct, fatLow, fatHigh)}>
                  {F1(totals.fat ?? 0)}
                </Table.Td>
                <Table.Td ta="right" c={pctColor(macros.sat_fat_pct, satLow, satHigh)}>
                  {F1(totals.sat_fat ?? 0)}
                </Table.Td>
                <Table.Td ta="right" c={maxColor(totals.cholesterol ?? 0, cholHigh)}>
                  {F0(totals.cholesterol ?? 0)}
                </Table.Td>
                <Table.Td ta="right" c={maxColor(totals.sodium ?? 0, sodiumHigh)}>
                  {F0(totals.sodium ?? 0)}
                </Table.Td>
                <Table.Td ta="right" c={pctColor(macros.carb_pct, carbLow, carbHigh)}>
                  {F1(totals.carbs ?? 0)}
                </Table.Td>
                <Table.Td ta="right" c={rangeColor(totals.fiber ?? 0, fiberLow, fiberHigh)}>
                  {F1(totals.fiber ?? 0)}
                </Table.Td>
                <Table.Td ta="right">{F1(totals.sugar ?? 0)}</Table.Td>
                <Table.Td
                  ta="right"
                  c={pctColor(macros.add_sugar_pct, addSugarLow, addSugarHigh)}
                >
                  {F1(totals.add_sugar ?? 0)}
                </Table.Td>
                <Table.Td
                  ta="right"
                  c={pctColor(macros.protein_pct, proteinLow, proteinHigh)}
                >
                  {F1(totals.protein ?? 0)}
                </Table.Td>
              </Table.Tr>
            );
          })}

          {sorted.length > 0 && (
            <Table.Tr fw={700}>
              <Table.Td>AVG</Table.Td>
              <Table.Td ta="right">
                {avgWeight != null ? F1(avgWeight) : "—"}
              </Table.Td>
              <Table.Td ta="right">{F0(allowedAvg)}</Table.Td>
              <Table.Td ta="right" c="grape">
                {NUM(Math.round(a.calories ?? 0))}
              </Table.Td>
              <Table.Td ta="right" c={surplusColor(ttls.is_surplus)}>
                {F0(Math.abs(ttls.net_calories))}
              </Table.Td>
              <Table.Td ta="right" c={pctColor(m.fat_pct, fatLow, fatHigh)}>
                {F1(a.fat ?? 0)}
              </Table.Td>
              <Table.Td ta="right" c={pctColor(m.sat_fat_pct, satLow, satHigh)}>
                {F1(a.sat_fat ?? 0)}
              </Table.Td>
              <Table.Td ta="right" c={maxColor(a.cholesterol ?? 0, cholHigh)}>
                {F0(a.cholesterol ?? 0)}
              </Table.Td>
              <Table.Td ta="right" c={maxColor(a.sodium ?? 0, sodiumHigh)}>
                {F0(a.sodium ?? 0)}
              </Table.Td>
              <Table.Td ta="right" c={pctColor(m.carb_pct, carbLow, carbHigh)}>
                {F1(a.carbs ?? 0)}
              </Table.Td>
              <Table.Td ta="right" c={rangeColor(a.fiber ?? 0, fiberLow, fiberHigh)}>
                {F1(a.fiber ?? 0)}
              </Table.Td>
              <Table.Td ta="right">{F1(a.sugar ?? 0)}</Table.Td>
              <Table.Td
                ta="right"
                c={pctColor(m.add_sugar_pct, addSugarLow, addSugarHigh)}
              >
                {F1(a.add_sugar ?? 0)}
              </Table.Td>
              <Table.Td
                ta="right"
                c={pctColor(m.protein_pct, proteinLow, proteinHigh)}
              >
                {F1(a.protein ?? 0)}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
