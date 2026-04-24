import { useEffect, useState } from "react";
import { Button, Group, NumberInput, Paper, Stack, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useUpdateDay, type Day } from "./api";

interface Props {
  day: Day;
  onSaved?: () => void;
}

export function DayFieldsPanel({ day, onSaved }: Props) {
  const update = useUpdateDay();
  const [weight, setWeight] = useState<number | "">(
    day.weight_lbs != null ? Number(day.weight_lbs) : "",
  );
  const [location, setLocation] = useState<string>(day.location ?? "");
  const [creatine, setCreatine] = useState<number | "">(day.creatine_mg ?? "");

  useEffect(() => {
    setWeight(day.weight_lbs != null ? Number(day.weight_lbs) : "");
    setLocation(day.location ?? "");
    setCreatine(day.creatine_mg ?? "");
  }, [day.id, day.weight_lbs, day.location, day.creatine_mg]);

  const dirty =
    (weight === "" ? null : Number(weight).toFixed(1)) !==
      (day.weight_lbs != null ? Number(day.weight_lbs).toFixed(1) : null) ||
    location !== (day.location ?? "") ||
    (creatine === "" ? null : Number(creatine)) !== (day.creatine_mg ?? null);

  const save = async () => {
    try {
      await update.mutateAsync({
        id: day.id,
        data: {
          weight_lbs: weight === "" ? null : Number(weight).toFixed(1),
          location,
          creatine_mg: creatine === "" ? null : Number(creatine),
        },
      });
      onSaved?.();
    } catch {
      notifications.show({ color: "red", message: "Could not save day details." });
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={5} ff="monospace" tt="uppercase">
          Day details
        </Title>
        <Group grow align="flex-end" wrap="wrap">
          <NumberInput
            label="Weight (lbs)"
            value={weight}
            onChange={(v) => setWeight(typeof v === "number" ? v : "")}
            min={0}
            decimalScale={1}
            step={0.1}
          />
          <TextInput
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.currentTarget.value)}
            placeholder="SD"
            maxLength={20}
          />
          <NumberInput
            label="Creatine (mg)"
            value={creatine}
            onChange={(v) => setCreatine(typeof v === "number" ? v : "")}
            min={0}
            step={1}
          />
          <Button onClick={save} disabled={!dirty} loading={update.isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
