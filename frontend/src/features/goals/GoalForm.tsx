import { useState } from "react";
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";

interface Props {
  onSubmit: (data: {
    start_date: string;
    end_date: string;
    start_weight: string;
    goal_weight: string;
  }) => Promise<unknown>;
}

function toIso(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GoalForm({ onSubmit }: Props) {
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [startWeight, setStartWeight] = useState<number | "">("");
  const [goalWeight, setGoalWeight] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  const startIso = toIso(start);
  const endIso = toIso(end);

  const validRange = startIso && endIso && endIso >= startIso;
  const canSubmit =
    validRange &&
    typeof startWeight === "number" &&
    startWeight > 0 &&
    typeof goalWeight === "number" &&
    goalWeight > 0;

  const submit = async () => {
    if (!canSubmit || !startIso || !endIso) return;
    setSubmitting(true);
    try {
      await onSubmit({
        start_date: startIso,
        end_date: endIso,
        start_weight: Number(startWeight).toFixed(1),
        goal_weight: Number(goalWeight).toFixed(1),
      });
    } catch {
      notifications.show({ color: "red", message: "Could not save goal." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={5} ff="monospace" tt="uppercase">
          New goal
        </Title>
        <Text c="dimmed" size="sm">
          Set a weight goal with a target date. Linear daily targets will be
          interpolated between start and goal weights.
        </Text>
        <Group grow align="flex-end" wrap="wrap">
          <DatePickerInput
            label="Start date"
            value={start}
            onChange={(v) => setStart(typeof v === "string" ? new Date(v) : v)}
          />
          <DatePickerInput
            label="End date"
            value={end}
            onChange={(v) => setEnd(typeof v === "string" ? new Date(v) : v)}
            error={
              startIso && endIso && endIso < startIso
                ? "End must be after start"
                : undefined
            }
          />
          <NumberInput
            label="Start weight (lbs)"
            value={startWeight}
            onChange={(v) => setStartWeight(typeof v === "number" ? v : "")}
            min={0}
            step={0.1}
            decimalScale={1}
          />
          <NumberInput
            label="Goal weight (lbs)"
            value={goalWeight}
            onChange={(v) => setGoalWeight(typeof v === "number" ? v : "")}
            min={0}
            step={0.1}
            decimalScale={1}
          />
          <Button onClick={submit} disabled={!canSubmit} loading={submitting}>
            Create goal
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
