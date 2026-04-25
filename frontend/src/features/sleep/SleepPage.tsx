import { useState } from "react";
import {
  ActionIcon,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTargetsRetrieve } from "@/api/generated/endpoints/targets/targets";
import { StatCard } from "@/components/StatCard";
import { sleepHoursColor, sleepQualityColor } from "@/lib/sleepColors";
import { useDaysRange, useMonthSummary, useToday } from "@/features/days/api";
import { SleepChart } from "./SleepChart";
import { SleepTable } from "./SleepTable";

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
  };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const m = month + delta;
  if (m < 1) return { year: year - 1, month: 12 };
  if (m > 12) return { year: year + 1, month: 1 };
  return { year, month: m };
}

function parseToday(iso: string | undefined): { year: number; month: number } {
  if (!iso) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (next: { year: number; month: number }) => void;
  maxYear: number;
  maxMonth: number;
}

function MonthPicker({ year, month, onChange, maxYear, maxMonth }: MonthPickerProps) {
  const atMax = year === maxYear && month === maxMonth;
  return (
    <Group gap="xs">
      <ActionIcon
        variant="subtle"
        aria-label="previous month"
        onClick={() => onChange(shiftMonth(year, month, -1))}
      >
        <IconChevronLeft size={18} />
      </ActionIcon>
      <Text ff="monospace" tt="uppercase" fw={600} miw={90} ta="center">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <ActionIcon
        variant="subtle"
        aria-label="next month"
        disabled={atMax}
        onClick={() => onChange(shiftMonth(year, month, 1))}
      >
        <IconChevronRight size={18} />
      </ActionIcon>
    </Group>
  );
}

export function SleepPage() {
  const today = useToday();
  const max = parseToday(today.data?.date);
  const [{ year, month }, setMonth] = useState(max);
  const bounds = monthBounds(year, month);

  const summary = useMonthSummary(year, month);
  const days = useDaysRange(bounds.from, bounds.to);
  const targets = useTargetsRetrieve();

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
