import { Paper, Text } from "@mantine/core";

interface Props {
  label: string;
  value: string;
  color?: string;
}

export function StatCard({ label, value, color }: Props) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" c="dimmed" ff="monospace" tt="uppercase" lts={1}>
        {label}
      </Text>
      <Text size="xl" fw={700} ff="monospace" c={color}>
        {value}
      </Text>
    </Paper>
  );
}
