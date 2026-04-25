import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Group,
  Input,
  NumberInput,
  Paper,
  Rating,
  Stack,
  Title,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { trimSeconds } from "@/lib/time";
import {
  useCreateSleep,
  useDeleteSleep,
  useUpdateSleep,
  type Day,
  type SleepLog,
} from "./api";

interface Props {
  day: Day;
  onChanged?: () => void;
}

function initialHours(sleep: SleepLog | null): number | "" {
  return sleep ? Number(sleep.hours) : "";
}

export function SleepPanel({ day, onChanged }: Props) {
  const create = useCreateSleep();
  const update = useUpdateSleep();
  const del = useDeleteSleep();

  const [hours, setHours] = useState<number | "">(initialHours(day.sleep));
  const [quality, setQuality] = useState<number>(day.sleep?.quality ?? 0);
  const [bedtime, setBedtime] = useState<string>(
    day.sleep ? trimSeconds(day.sleep.bedtime) : "",
  );
  const [wake, setWake] = useState<string>(
    day.sleep ? trimSeconds(day.sleep.wake) : "",
  );
  const [meds, setMeds] = useState<boolean>(day.sleep?.meds ?? false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop→form-state sync on day change
    setHours(initialHours(day.sleep));
    setQuality(day.sleep?.quality ?? 0);
    setBedtime(day.sleep ? trimSeconds(day.sleep.bedtime) : "");
    setWake(day.sleep ? trimSeconds(day.sleep.wake) : "");
    setMeds(day.sleep?.meds ?? false);
  }, [day.id, day.sleep]);

  const canSubmit =
    typeof hours === "number" &&
    hours >= 0 &&
    quality >= 1 &&
    quality <= 5 &&
    bedtime.length > 0 &&
    wake.length > 0;

  const dirty = day.sleep
    ? (typeof hours === "number" ? hours.toFixed(2) : null) !==
        Number(day.sleep.hours).toFixed(2) ||
      quality !== day.sleep.quality ||
      bedtime !== trimSeconds(day.sleep.bedtime) ||
      wake !== trimSeconds(day.sleep.wake) ||
      meds !== day.sleep.meds
    : hours !== "" ||
      quality !== 0 ||
      bedtime !== "" ||
      wake !== "" ||
      meds !== false;

  const submit = async () => {
    if (!canSubmit) return;
    const hoursStr = Number(hours).toFixed(2);
    try {
      if (day.sleep) {
        await update.mutateAsync({
          id: day.sleep.id,
          data: { hours: hoursStr, quality, bedtime, wake, meds },
        });
      } else {
        await create.mutateAsync({
          day: day.id,
          hours: hoursStr,
          quality,
          bedtime,
          wake,
          meds,
        });
      }
      onChanged?.();
    } catch {
      notifications.show({ color: "red", message: "Could not save sleep." });
    }
  };

  const onDelete = async () => {
    if (!day.sleep) return;
    if (!window.confirm("Delete sleep entry?")) return;
    try {
      await del.mutateAsync(day.sleep.id);
      onChanged?.();
    } catch {
      notifications.show({ color: "red", message: "Could not delete sleep." });
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={5} ff="monospace" tt="uppercase">
          Sleep
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
          <Input.Wrapper label="Quality">
            <Rating value={quality} onChange={setQuality} count={5} />
          </Input.Wrapper>
          <TimeInput
            label="Bedtime"
            value={bedtime}
            onChange={(e) => setBedtime(e.currentTarget.value)}
          />
          <TimeInput
            label="Wake"
            value={wake}
            onChange={(e) => setWake(e.currentTarget.value)}
          />
          <Checkbox
            label="Meds"
            checked={meds}
            onChange={(e) => setMeds(e.currentTarget.checked)}
          />
          {day.sleep && (
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
