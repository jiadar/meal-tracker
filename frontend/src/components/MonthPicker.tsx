import { ActionIcon, Group, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { MONTH_NAMES, shiftMonth } from "@/lib/months";

interface Props {
  year: number;
  month: number;
  onChange: (next: { year: number; month: number }) => void;
  maxYear: number;
  maxMonth: number;
}

export function MonthPicker({ year, month, onChange, maxYear, maxMonth }: Props) {
  const atMax = year === maxYear && month === maxMonth;
  return (
    <Group gap="xs">
      <ActionIcon
        variant="subtle"
        aria-label="previous month"
        onClick={() => onChange(shiftMonth(year, month, -1))}
      >
        <IconChevronLeft size={18} />
      </ActionIcon>
      <Text ff="monospace" tt="uppercase" fw={600} miw={90} ta="center">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <ActionIcon
        variant="subtle"
        aria-label="next month"
        disabled={atMax}
        onClick={() => onChange(shiftMonth(year, month, 1))}
      >
        <IconChevronRight size={18} />
      </ActionIcon>
    </Group>
  );
}
