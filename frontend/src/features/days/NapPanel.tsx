import { useEffect, useState } from "react";
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Title,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { trimSeconds } from "@/lib/time";
import {
  useCreateNap,
  useDeleteNap,
  useUpdateNap,
  type Day,
  type NapLog,
} from "./api";

interface Props {
  day: Day;
  onChanged?: () => void;
}

function initialHours(nap: NapLog | null): number | "" {
  return nap ? Number(nap.hours) : "";
}

export function NapPanel({ day, onChanged }: Props) {
  const create = useCreateNap();
  const update = useUpdateNap();
  const del = useDeleteNap();

  const [hours, setHours] = useState<number | "">(initialHours(day.nap));
  const [startTime, setStartTime] = useState<string>(
    day.nap ? trimSeconds(day.nap.start_time) : "",
  );

  useEffect(() => {
    setHours(initialHours(day.nap));
    setStartTime(day.nap ? trimSeconds(day.nap.start_time) : "");
  }, [day.id, day.nap]);

  const canSubmit =
    typeof hours === "number" && hours >= 0 && startTime.length > 0;

  const dirty = day.nap
    ? (typeof hours === "number" ? hours.toFixed(2) : null) !==
        Number(day.nap.hours).toFixed(2) ||
      startTime !== trimSeconds(day.nap.start_time)
    : hours !== "" || startTime !== "";

  const submit = async () => {
    if (!canSubmit) return;
    const hoursStr = Number(hours).toFixed(2);
    try {
      if (day.nap) {
        await update.mutateAsync({
          id: day.nap.id,
          data: { hours: hoursStr, start_time: startTime },
        });
      } else {
        await create.mutateAsync({
          day: day.id,
          hours: hoursStr,
          start_time: startTime,
        });
      }
      onChanged?.();
    } catch {
      notifications.show({ color: "red", message: "Could not save nap." });
    }
  };

  const onDelete = async () => {
    if (!day.nap) return;
    if (!window.confirm("Delete nap entry?")) return;
    try {
      await del.mutateAsync(day.nap.id);
      onChanged?.();
    } catch {
      notifications.show({ color: "red", message: "Could not delete nap." });
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={5} ff="monospace" tt="uppercase">
          Nap
        </Title>
        <Group grow align="flex-end" wrap="wrap">
          <NumberInput
            label="Hours"
            value={hours}
            onChange={(v) => setHours(typeof v === "number" ? v : "")}
            min={0}
            step={0.25}
            decimalScale={2}
          />
          <TimeInput
            label="Start time"
            value={startTime}
            onChange={(e) => setStartTime(e.currentTarget.value)}
          />
          {day.nap && (
            <Button
              variant="subtle"
              color="red"
              onClick={onDelete}
              loading={del.isPending}
            >
              Delete
            </Button>
          )}
          <Button
            onClick={submit}
            disabled={!dirty || !canSubmit}
            loading={saving}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
