import { useState } from "react";
import {
  Badge,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useDebouncedSave, type SaveStatus } from "@/lib/useDebouncedSave";
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

  const [values, setValues] = useState<TargetValues>({});
  const [serverValues, setServerValues] = useState<TargetValues | undefined>(undefined);

  // Seed form state from the first successful targets fetch (render-time
  // state sync; avoids set-state-in-effect on a one-shot init).
  const [seeded, setSeeded] = useState(false);
  if (!seeded && targetsQ.data) {
    const v = formFromServer(targetsQ.data);
    setValues(v);
    setServerValues(v);
    setSeeded(true);
  }

  const { status, flush } = useDebouncedSave<TargetValues>({
    values,
    serverValues,
    delayMs: 1500,
    diff: diffMaps,
    save: async (changed) => {
      const res = await update.mutateAsync(serverShape(changed));
      setServerValues(formFromServer(res));
    },
  });

  const onFieldChange = (field: TargetField, value: number | "") =>
    setValues((prev) => ({ ...prev, [field]: value }));

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Settings</Title>
        <SaveStatusPill status={status} onRetry={() => void flush()} />
      </Group>
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
