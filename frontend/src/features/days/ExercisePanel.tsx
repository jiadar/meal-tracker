import { useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  useCreateExercise,
  useDeleteExercise,
  type Day,
  type ExerciseLog,
} from "./api";

interface Props {
  day: Day;
  onChanged?: () => void;
}

function ExerciseRow({
  log,
  onChanged,
}: {
  log: ExerciseLog;
  onChanged?: () => void;
}) {
  const del = useDeleteExercise();

  const onDelete = async () => {
    if (!window.confirm(`Delete "${log.activity}"?`)) return;
    try {
      await del.mutateAsync(log.id);
      onChanged?.();
    } catch {
      notifications.show({ color: "red", message: "Could not delete." });
    }
  };

  return (
    <Table.Tr>
      <Table.Td>{log.activity}</Table.Td>
      <Table.Td ta="right">{log.duration_minutes ?? "—"}</Table.Td>
      <Table.Td ta="right">{log.calories}</Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end">
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={onDelete}
            loading={del.isPending}
            aria-label="Delete exercise"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export function ExercisePanel({ day, onChanged }: Props) {
  const [activity, setActivity] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [calories, setCalories] = useState<number | "">("");
  const create = useCreateExercise();

  const canSubmit =
    activity.trim().length > 0 && typeof calories === "number" && calories >= 0;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await create.mutateAsync({
        day: day.id,
        activity: activity.trim(),
        duration_minutes: duration === "" ? null : Number(duration),
        calories: Number(calories),
      });
      setActivity("");
      setDuration("");
      setCalories("");
      onChanged?.();
    } catch {
      notifications.show({ color: "red", message: "Could not add exercise." });
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={5} ff="monospace" tt="uppercase">
          Exercise
        </Title>

        <Group align="flex-end" wrap="wrap">
          <TextInput
            label="Activity"
            value={activity}
            onChange={(e) => setActivity(e.currentTarget.value)}
            placeholder="Jiu Jitsu"
            style={{ flex: 1, minWidth: 160 }}
          />
          <NumberInput
            label="Minutes"
            value={duration}
            onChange={(v) => setDuration(typeof v === "number" ? v : "")}
            min={0}
            step={5}
            w={110}
          />
          <NumberInput
            label="Calories"
            value={calories}
            onChange={(v) => setCalories(typeof v === "number" ? v : "")}
            min={0}
            step={10}
            w={120}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={submit}
            disabled={!canSubmit}
            loading={create.isPending}
          >
            Add exercise
          </Button>
        </Group>

        {day.exercises.length === 0 ? (
          <Text c="dimmed" size="sm">
            No exercise logged yet.
          </Text>
        ) : (
          <Table ff="monospace" fz="sm" withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Activity</Table.Th>
                <Table.Th ta="right">Min</Table.Th>
                <Table.Th ta="right">Cal</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {day.exercises.map((log) => (
                <ExerciseRow key={log.id} log={log} onChanged={onChanged} />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  );
}
