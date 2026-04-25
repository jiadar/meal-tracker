import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Day } from "@/features/days/api";

interface Props {
  days: Day[];
}

export function SleepChart({ days }: Props) {
  const data = days
    .filter((d) => d.sleep)
    .map((d) => ({
      day: Number(d.date.slice(8, 10)),
      hours: Number(d.sleep!.hours),
      quality: d.sleep!.quality,
    }))
    .sort((a, b) => a.day - b.day);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--mantine-color-dark-4)" strokeDasharray="3 3" />
        <XAxis dataKey="day" stroke="var(--mantine-color-dimmed)" />
        <YAxis
          yAxisId="hours"
          domain={[0, 12]}
          stroke="var(--mantine-color-grape-6)"
        />
        <YAxis
          yAxisId="quality"
          orientation="right"
          domain={[0, 5]}
          stroke="var(--mantine-color-green-6)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--mantine-color-dark-7)",
            border: "1px solid var(--mantine-color-dark-4)",
          }}
        />
        <Area
          yAxisId="hours"
          type="monotone"
          dataKey="hours"
          stroke="var(--mantine-color-grape-6)"
          fill="var(--mantine-color-grape-6)"
          fillOpacity={0.3}
        />
        <Area
          yAxisId="quality"
          type="monotone"
          dataKey="quality"
          stroke="var(--mantine-color-green-6)"
          fill="var(--mantine-color-green-6)"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
