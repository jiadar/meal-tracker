import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";

export function DayDetailPage() {
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Day Detail</Title>
      </Group>
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" py="xl">
          <Text c="dimmed">No meals logged yet.</Text>
          <Button leftSection={<IconPlus size={16} />} disabled>
            Add food (coming soon)
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
