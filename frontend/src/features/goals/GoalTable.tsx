import { Paper, Table, Text } from "@mantine/core";
import type { Day } from "@/features/days/api";
import type { WeightGoal } from "./api";

interface Props {
  goal: WeightGoal;
  days: Day[];
}

function isoOffset(start: string, n: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const ms =
    new Date(`${end}T00:00:00Z`).getTime() -
    new Date(`${start}T00:00:00Z`).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function GoalTable({ goal, days }: Props) {
  const startW = Number(goal.start_weight);
  const goalW = Number(goal.goal_weight);
  const total = daysBetween(goal.start_date, goal.end_date);
  const dailyLoss = total > 0 ? (startW - goalW) / total : 0;

  const rows: { date: string; goalWeight: number; actual: number | null }[] = [];
  for (let i = 0; i <= total; i += 1) {
    const date = isoOffset(goal.start_date, i);
    const goalWeight = startW - i * dailyLoss;
    const day = days.find((d) => d.date === date);
    const actual = day?.weight_lbs != null ? Number(day.weight_lbs) : null;
    rows.push({ date, goalWeight, actual });
  }

  return (
    <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
      <Table ff="monospace" fz="sm" withRowBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th ta="right">Goal Weight</Table.Th>
            <Table.Th ta="right">Actual</Table.Th>
            <Table.Th ta="right">Diff</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ date, goalWeight, actual }) => {
            const diff = actual != null ? actual - goalWeight : null;
            const onTrack = diff != null && diff <= 0;
            const over = diff != null && diff > 0;
            return (
              <Table.Tr key={date}>
                <Table.Td>{date}</Table.Td>
                <Table.Td ta="right">{goalWeight.toFixed(1)}</Table.Td>
                <Table.Td ta="right">
                  {actual != null ? actual.toFixed(1) : "—"}
                </Table.Td>
                <Table.Td
                  ta="right"
                  c={onTrack ? "green" : over ? "red" : undefined}
                >
                  {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                </Table.Td>
                <Table.Td>
                  {onTrack ? (
                    <Text span c="green">
                      ✓ On track
                    </Text>
                  ) : over ? (
                    <Text span c="red">
                      ✗ Over
                    </Text>
                  ) : (
                    <Text span c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
