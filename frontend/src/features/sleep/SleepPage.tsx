import { useState } from "react";
import { Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTargets } from "@/features/settings/api";
import { MonthPicker } from "@/components/MonthPicker";
import { StatCard } from "@/components/StatCard";
import { sleepHoursColor, sleepQualityColor } from "@/lib/sleepColors";
import { monthBounds, parseToday } from "@/lib/months";
import { useDaysRange, useMonthSummary, useToday } from "@/features/days/api";
import { SleepChart } from "./SleepChart";
import { SleepTable } from "./SleepTable";

export function SleepPage() {
  const today = useToday();
  const max = parseToday(today.data?.date);
  const [{ year, month }, setMonth] = useState(max);
  const bounds = monthBounds(year, month);

  const summary = useMonthSummary(year, month);
  const days = useDaysRange(bounds.from, bounds.to);
  const targets = useTargets();

  const hoursTarget = Number(targets.data?.sleep_hours_low ?? 8);
  const qualityTarget = targets.data?.sleep_quality_low ?? 4;

  const sleepDays = (days.data ?? []).filter((d) => d.sleep);
  const sleepStats = summary.data?.sleep ?? null;
  const totalDays = summary.data?.days_tracked ?? 0;

  const loading = summary.isLoading || days.isLoading;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Sleep</Title>
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
      ) : sleepDays.length === 0 ? (
        <Paper withBorder p="md" radius="md">
          <Text c="dimmed">No sleep logged for this month.</Text>
        </Paper>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatCard
              label="Avg Hours"
              value={sleepStats ? sleepStats.avg_hours.toFixed(2) : "—"}
              color={
                sleepStats
                  ? sleepHoursColor(sleepStats.avg_hours, hoursTarget)
                  : undefined
              }
            />
            <StatCard
              label="Avg Quality"
              value={sleepStats ? sleepStats.avg_quality.toFixed(2) : "—"}
              color={
                sleepStats
                  ? sleepQualityColor(sleepStats.avg_quality, qualityTarget)
                  : undefined
              }
            />
            <StatCard
              label="Days Tracked"
              value={`${sleepStats?.days_with_data ?? 0}/${totalDays}`}
              color="grape"
            />
          </SimpleGrid>

          <Paper withBorder p="md" radius="md">
            <SleepChart days={sleepDays} />
          </Paper>

          <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
            <SleepTable
              days={sleepDays}
              hoursTarget={hoursTarget}
              qualityTarget={qualityTarget}
            />
          </Paper>
        </>
      )}
    </Stack>
  );
}
