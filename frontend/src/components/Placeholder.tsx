import { Paper, Stack, Text, Title } from "@mantine/core";

export function Placeholder({ title }: { title: string }) {
  return (
    <Stack>
      <Title order={2}>{title}</Title>
      <Paper withBorder p="xl" radius="md">
        <Text c="dimmed" ta="center" py="xl">
          Coming soon.
        </Text>
      </Paper>
    </Stack>
  );
}
