import { Badge, Box, Group, Table, Text } from "@mantine/core";
import { trimSeconds } from "@/lib/time";
import { sleepHoursColor, sleepQualityColor } from "@/lib/sleepColors";
import type { Day } from "@/features/days/api";

interface Props {
  days: Day[];
  hoursTarget: number;
  qualityTarget: number;
}

function QualityDots({ quality, target }: { quality: number; target: number }) {
  const color = sleepQualityColor(quality, target);
  return (
    <Group gap={3} wrap="nowrap">
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          w={8}
          h={8}
          style={{
            borderRadius: "50%",
            backgroundColor:
              i < quality
                ? `var(--mantine-color-${color}-6)`
                : "var(--mantine-color-dark-4)",
          }}
        />
      ))}
    </Group>
  );
}

export function SleepTable({ days, hoursTarget, qualityTarget }: Props) {
  const rows = days
    .filter((d) => d.sleep)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Table ff="monospace" fz="sm" withRowBorders={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Day</Table.Th>
          <Table.Th>Loc</Table.Th>
          <Table.Th>Bedtime</Table.Th>
          <Table.Th>Wake</Table.Th>
          <Table.Th ta="right">Hours</Table.Th>
          <Table.Th ta="right">Nap</Table.Th>
          <Table.Th ta="right">Total</Table.Th>
          <Table.Th>Quality</Table.Th>
          <Table.Th>Meds</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((d) => {
          const hours = Number(d.sleep!.hours);
          const napHours = d.nap ? Number(d.nap.hours) : 0;
          const total = hours + napHours;
          return (
            <Table.Tr key={d.id}>
              <Table.Td>{Number(d.date.slice(8, 10))}</Table.Td>
              <Table.Td>
                <Badge variant="light" color="gray">
                  {d.location || "—"}
                </Badge>
              </Table.Td>
              <Table.Td>{trimSeconds(d.sleep!.bedtime)}</Table.Td>
              <Table.Td>{trimSeconds(d.sleep!.wake)}</Table.Td>
              <Table.Td ta="right">
                <Text
                  span
                  ff="monospace"
                  fz="sm"
                  c={sleepHoursColor(hours, hoursTarget)}
                >
                  {hours.toFixed(1)}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                {d.nap ? `${napHours.toFixed(1)}` : "—"}
              </Table.Td>
              <Table.Td ta="right">{total.toFixed(1)}</Table.Td>
              <Table.Td>
                <QualityDots quality={d.sleep!.quality} target={qualityTarget} />
              </Table.Td>
              <Table.Td>{d.sleep!.meds ? "Yes" : ""}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
