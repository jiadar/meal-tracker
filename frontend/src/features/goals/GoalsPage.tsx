import {
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { StatCard } from "@/components/StatCard";
import { useDaysRange } from "@/features/days/api";
import { useActiveGoal, useCreateGoal, useDeleteGoal } from "./api";
import { GoalForm } from "./GoalForm";
import { GoalTable } from "./GoalTable";

const CALS_PER_LB = 3500;

function daysBetween(start: string, end: string): number {
  const ms =
    new Date(`${end}T00:00:00Z`).getTime() -
    new Date(`${start}T00:00:00Z`).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function GoalsPage() {
  const goalQ = useActiveGoal();
  const create = useCreateGoal();
  const del = useDeleteGoal();
  const goal = goalQ.data ?? null;
  const days = useDaysRange(goal?.start_date, goal?.end_date);

  const handleCreate = async (data: {
    start_date: string;
    end_date: string;
    start_weight: string;
    goal_weight: string;
  }) => {
    await create.mutateAsync(data);
  };

  const handleDelete = async () => {
    if (!goal) return;
    if (!window.confirm("Delete the active goal?")) return;
    try {
      await del.mutateAsync(goal.id);
    } catch {
      notifications.show({ color: "red", message: "Could not delete goal." });
    }
  };

  if (goalQ.isLoading) return <Text>Loading…</Text>;

  if (!goal) {
    return (
      <Stack>
        <Title order={2}>Goals</Title>
        <GoalForm onSubmit={handleCreate} />
      </Stack>
    );
  }

  const startW = Number(goal.start_weight);
  const goalW = Number(goal.goal_weight);
  const total = daysBetween(goal.start_date, goal.end_date);
  const totalLoss = startW - goalW;
  const dailyLoss = total > 0 ? totalLoss / total : 0;
  const dailyDeficit = dailyLoss * CALS_PER_LB;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Goals</Title>
        <Button
          variant="subtle"
          color="red"
          onClick={handleDelete}
          loading={del.isPending}
        >
          Delete goal
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
        <StatCard label="Start Weight" value={startW.toFixed(1)} />
        <StatCard label="Goal Weight" value={goalW.toFixed(1)} color="green" />
        <StatCard label="Total Loss" value={totalLoss.toFixed(1)} />
        <StatCard label="Daily Loss" value={dailyLoss.toFixed(2)} />
        <StatCard
          label="Daily Deficit"
          value={Math.round(dailyDeficit).toLocaleString()}
        />
        <StatCard label="Target Date" value={goal.end_date} />
      </SimpleGrid>
      <GoalTable goal={goal} days={days.data ?? []} />
    </Stack>
  );
}
