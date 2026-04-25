import { useState } from "react";
import { Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { MonthPicker } from "@/components/MonthPicker";
import { StatCard } from "@/components/StatCard";
import { monthBounds, parseToday } from "@/lib/months";
import {
  maxColor,
  minColor,
  pctColor,
  rangeColor,
  surplusColor,
} from "@/lib/nutritionColors";
import { sleepHoursColor, sleepQualityColor } from "@/lib/sleepColors";
import { useTargets } from "@/features/settings/api";
import {
  useDaysRange,
  useMonthSummary,
  useToday,
  type MonthSummary,
} from "@/features/days/api";
import type { UserTargets } from "@/api/generated/models";
import { MonthTable } from "./MonthTable";

function n(t: UserTargets | undefined, key: keyof UserTargets, fallback: number): number {
  const v = t?.[key];
  if (v == null || v === "") return fallback;
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function CardRow1({
  summary,
  targets,
}: {
  summary: MonthSummary;
  targets: UserTargets | undefined;
}) {
  const fatLow = n(targets, "fat_pct_low", 20);
  const fatHigh = n(targets, "fat_pct_high", 35);
  const carbLow = n(targets, "carb_pct_low", 45);
  const carbHigh = n(targets, "carb_pct_high", 65);
  const proteinLow = n(targets, "protein_pct_low", 10);
  const proteinHigh = n(targets, "protein_pct_high", 35);

  const a = summary.averages;
  const m = summary.macros;
  const totals = summary.totals;
  const w = summary.weight;

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
      <StatCard
        label="Avg Calories"
        value={a.calories != null ? Math.round(a.calories).toLocaleString() : "—"}
        color="grape"
      />
      <StatCard
        label={totals.is_surplus ? "Total Surplus" : "Total Deficit"}
        value={Math.abs(totals.net_calories).toFixed(0)}
        color={surplusColor(totals.is_surplus)}
      />
      <StatCard
        label="Weight Loss"
        value={w ? w.change.toFixed(1) : "—"}
        color={w ? (w.change > 0 ? "green" : w.change < 0 ? "red" : undefined) : undefined}
      />
      <StatCard
        label="Fat"
        value={a.fat != null ? a.fat.toFixed(1) : "—"}
        color={pctColor(m.fat_pct, fatLow, fatHigh)}
      />
      <StatCard
        label="Carbs"
        value={a.carbs != null ? a.carbs.toFixed(1) : "—"}
        color={pctColor(m.carb_pct, carbLow, carbHigh)}
      />
      <StatCard
        label="Protein"
        value={a.protein != null ? a.protein.toFixed(1) : "—"}
        color={pctColor(m.protein_pct, proteinLow, proteinHigh)}
      />
    </SimpleGrid>
  );
}

function CardRow2({
  summary,
  targets,
}: {
  summary: MonthSummary;
  targets: UserTargets | undefined;
}) {
  const fiberLow = n(targets, "fiber_low", 28);
  const fiberHigh = n(targets, "fiber_high", 34);
  const sodiumHigh = n(targets, "sodium_high", 2300);
  const creatineMin = n(targets, "creatine_min", 5);
  const sleepHoursLow = n(targets, "sleep_hours_low", 8);
  const sleepQualityLow = n(targets, "sleep_quality_low", 4);

  const a = summary.averages;
  const sleep = summary.sleep;
  const creatine = summary.creatine_avg_mg;

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
      <StatCard
        label="Avg Fiber"
        value={a.fiber != null ? a.fiber.toFixed(1) : "—"}
        color={a.fiber != null ? rangeColor(a.fiber, fiberLow, fiberHigh) : undefined}
      />
      <StatCard
        label="Avg Sodium"
        value={a.sodium != null ? a.sodium.toFixed(0) : "—"}
        color={a.sodium != null ? maxColor(a.sodium, sodiumHigh) : undefined}
      />
      <StatCard
        label="Avg Creatine"
        value={creatine != null ? creatine.toFixed(0) : "—"}
        color={creatine != null ? minColor(creatine, creatineMin) : undefined}
      />
      <StatCard
        label="Avg Sleep"
        value={sleep ? sleep.avg_hours.toFixed(2) : "—"}
        color={sleep ? sleepHoursColor(sleep.avg_hours, sleepHoursLow) : undefined}
      />
      <StatCard
        label="Sleep Quality"
        value={sleep ? sleep.avg_quality.toFixed(2) : "—"}
        color={
          sleep ? sleepQualityColor(sleep.avg_quality, sleepQualityLow) : undefined
        }
      />
    </SimpleGrid>
  );
}

export function MonthPage() {
  const today = useToday();
  const max = parseToday(today.data?.date);
  const [{ year, month }, setMonth] = useState(max);
  const bounds = monthBounds(year, month);

  const summary = useMonthSummary(year, month);
  const days = useDaysRange(bounds.from, bounds.to);
  const targets = useTargets();

  const loading = summary.isLoading || days.isLoading;
  const list = days.data ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Month</Title>
        <MonthPicker
          year={year}
          month={month}
          onChange={setMonth}
          maxYear={max.year}
          maxMonth={max.month}
        />
      </Group>

      {loading ? (
        <Text>Loading…</Text>
      ) : list.length === 0 ? (
        <Paper withBorder p="md" radius="md">
          <Text c="dimmed">No days logged for this month.</Text>
        </Paper>
      ) : summary.data ? (
        <>
          <CardRow1 summary={summary.data} targets={targets.data} />
          <CardRow2 summary={summary.data} targets={targets.data} />
          <MonthTable days={list} summary={summary.data} targets={targets.data} />
          <Text c="dimmed" size="sm">
            Click any row to see day detail.
          </Text>
        </>
      ) : null}
    </Stack>
  );
}
