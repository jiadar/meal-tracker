import { useState } from "react";
import { Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { MonthPicker } from "@/components/MonthPicker";
import { StatCard } from "@/components/StatCard";
import { monthBounds, parseToday } from "@/lib/months";
import {
  useDaysRange,
  useMonthSummary,
  useToday,
} from "@/features/days/api";
import { WeightChart } from "./WeightChart";

function formatChange(change: number): string {
  // weight.change is positive when the user LOST weight (start - end).
  // Display the signed delta from start to end (i.e. negate).
  const delta = -change;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

function changeColor(change: number): string | undefined {
  if (change > 0) return "green";
  if (change < 0) return "red";
  return undefined;
}

export function WeightPage() {
  const today = useToday();
  const max = parseToday(today.data?.date);
  const [{ year, month }, setMonth] = useState(max);
  const bounds = monthBounds(year, month);

  const summary = useMonthSummary(year, month);
  const days = useDaysRange(bounds.from, bounds.to);

  const loading = summary.isLoading || days.isLoading;
  const weight = summary.data?.weight ?? null;
  const list = days.data ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Weight</Title>
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
      ) : weight == null ? (
        <Paper withBorder p="md" radius="md">
          <Text c="dimmed">No weight logged for this month.</Text>
        </Paper>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <StatCard label="Start" value={weight.start.toFixed(1)} />
            <StatCard label="Current" value={weight.end.toFixed(1)} />
            <StatCard
              label="Change"
              value={formatChange(weight.change)}
              color={changeColor(weight.change)}
            />
            <StatCard label="Low" value={weight.low.toFixed(1)} color="green" />
          </SimpleGrid>
          <Paper withBorder p="md" radius="md">
            <WeightChart days={list} />
          </Paper>
        </>
      )}
    </Stack>
  );
}
