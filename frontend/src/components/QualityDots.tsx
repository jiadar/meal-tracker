import { Box, Group } from "@mantine/core";
import { sleepQualityColor } from "@/lib/sleepColors";

interface Props {
  quality: number;
  target: number;
}

export function QualityDots({ quality, target }: Props) {
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
