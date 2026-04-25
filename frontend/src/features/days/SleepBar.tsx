import { Badge, Divider, Group, Paper, Text } from "@mantine/core";
import { QualityDots } from "@/components/QualityDots";
import { sleepHoursColor } from "@/lib/sleepColors";
import { trimSeconds } from "@/lib/time";
import { useTargets } from "@/features/settings/api";
import type { Day } from "./api";

interface Props {
  day: Day;
}

export function SleepBar({ day }: Props) {
  const targets = useTargets();
  if (!day.sleep) return null;

  const hoursTarget = Number(targets.data?.sleep_hours_low ?? 8);
  const qualityTarget = targets.data?.sleep_quality_low ?? 4;

  const hours = Number(day.sleep.hours);
  const napHours = day.nap ? Number(day.nap.hours) : null;

  return (
    <Paper withBorder p="sm" radius="md">
      <Group gap="md" wrap="wrap">
        <Text ff="monospace" tt="uppercase" c="dimmed" size="xs" lts={1}>
          Sleep
        </Text>
        <Text c={sleepHoursColor(hours, hoursTarget)} fw={700} ff="monospace">
          {hours.toFixed(1)}h
        </Text>
        <Divider orientation="vertical" />
        <QualityDots quality={day.sleep.quality} target={qualityTarget} />
        <Divider orientation="vertical" />
        <Text ff="monospace" size="sm">
          {trimSeconds(day.sleep.bedtime)} → {trimSeconds(day.sleep.wake)}
        </Text>
        {day.sleep.meds && (
          <Badge color="grape" variant="light">
            MEDS
          </Badge>
        )}
        {napHours != null && (
          <Badge color="yellow" variant="light">
            NAP {napHours.toFixed(1)}h
          </Badge>
        )}
        <Badge color="gray" variant="light">
          {day.location || "—"}
        </Badge>
      </Group>
    </Paper>
  );
}
