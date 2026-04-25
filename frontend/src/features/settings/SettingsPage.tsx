import { useState } from "react";
import {
  Badge,
  Group,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useDebouncedSave, type SaveStatus } from "@/lib/useDebouncedSave";
import { useMe, useUpdateProfile } from "@/features/auth/api";
import { useTargets, useUpdateTargets } from "./api";
import { TargetRow } from "./TargetRow";
import {
  diffMaps,
  formFromServer,
  ROWS,
  serverShape,
  type TargetField,
  type TargetValues,
} from "./schema";

interface BmrValues {
  bmr: number | null;
}

function combinedStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
  // Worst-of: failed > saving > unsaved > saved > idle.
  const ranked: Record<SaveStatus, number> = {
    failed: 4, saving: 3, unsaved: 2, saved: 1, idle: 0,
  };
  return ranked[a] >= ranked[b] ? a : b;
}

const PILL: Record<SaveStatus, { label: string; color: string }> = {
  idle: { label: "Saved", color: "gray" },
  unsaved: { label: "Unsaved", color: "yellow" },
  saving: { label: "Saving…", color: "blue" },
  saved: { label: "Saved", color: "gray" },
  failed: { label: "Failed", color: "red" },
};

function SaveStatusPill({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const { label, color } = PILL[status];
  return (
    <Badge
      color={color}
      variant="light"
      style={status === "failed" ? { cursor: "pointer" } : undefined}
      onClick={status === "failed" ? onRetry : undefined}
      aria-label={`save status: ${label}`}
    >
      {label}
    </Badge>
  );
}

export function SettingsPage() {
  const targetsQ = useTargets();
  const update = useUpdateTargets();
  const meQ = useMe();
  const updateProfile = useUpdateProfile();

  const [values, setValues] = useState<TargetValues>({});
  const [serverValues, setServerValues] = useState<TargetValues | undefined>(undefined);

  // Seed targets form state from the first successful targets fetch
  // (render-time state sync; avoids set-state-in-effect on one-shot init).
  const [seeded, setSeeded] = useState(false);
  if (!seeded && targetsQ.data) {
    const v = formFromServer(targetsQ.data);
    setValues(v);
    setServerValues(v);
    setSeeded(true);
  }

  // Profile (BMR) form state.
  const [bmrValue, setBmrValue] = useState<number | "">("");
  const [serverBmr, setServerBmr] = useState<number | undefined>(undefined);
  const [bmrSeeded, setBmrSeeded] = useState(false);
  if (!bmrSeeded && meQ.data) {
    setBmrValue(meQ.data.profile.bmr);
    setServerBmr(meQ.data.profile.bmr);
    setBmrSeeded(true);
  }

  const targetsSave = useDebouncedSave<TargetValues>({
    values,
    serverValues,
    delayMs: 1500,
    diff: diffMaps,
    save: async (changed) => {
      const res = await update.mutateAsync(serverShape(changed));
      setServerValues(formFromServer(res));
    },
  });

  const bmrSave = useDebouncedSave<BmrValues>({
    values: { bmr: typeof bmrValue === "number" ? bmrValue : null },
    serverValues: serverBmr != null ? { bmr: serverBmr } : undefined,
    delayMs: 1500,
    diff: (cur, server) =>
      cur.bmr != null && cur.bmr !== server.bmr ? { bmr: cur.bmr } : {},
    save: async (changed) => {
      if (changed.bmr == null) return;
      await updateProfile.mutateAsync({ bmr: changed.bmr });
      setServerBmr(changed.bmr);
    },
  });

  const status = combinedStatus(targetsSave.status, bmrSave.status);
  const flush = () => {
    void targetsSave.flush();
    void bmrSave.flush();
  };

  const onFieldChange = (field: TargetField, value: number | "") =>
    setValues((prev) => ({ ...prev, [field]: value }));

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Settings</Title>
        <SaveStatusPill status={status} onRetry={flush} />
      </Group>
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={5} ff="monospace" tt="uppercase">
            Profile
          </Title>
          <Group grow align="flex-end" wrap="wrap">
            <NumberInput
              label="BMR (calories/day)"
              value={bmrValue}
              onChange={(v) => setBmrValue(typeof v === "number" ? v : "")}
              min={0}
              step={10}
              description="Basal metabolic rate. Drives the daily calorie budget on Day Detail and Month tab averages."
            />
          </Group>
        </Stack>
      </Paper>
      <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Target</Table.Th>
              <Table.Th>Low</Table.Th>
              <Table.Th>High</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {targetsQ.isLoading || serverValues === undefined ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed">Loading…</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              ROWS.map((row) => (
                <TargetRow
                  key={row.label}
                  row={row}
                  values={values}
                  onChange={onFieldChange}
                />
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
      <Text c="dimmed" size="sm">
        Changes auto-save 1.5s after you stop typing. Percentages are whole numbers (e.g. 20 = 20%).
      </Text>
    </Stack>
  );
}
