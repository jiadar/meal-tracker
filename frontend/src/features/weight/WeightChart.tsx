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

export function WeightChart({ days }: Props) {
  const data = days
    .filter((d) => d.weight_lbs != null)
    .map((d) => ({
      day: Number(d.date.slice(8, 10)),
      weight: Number(d.weight_lbs),
    }))
    .sort((a, b) => a.day - b.day);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--mantine-color-dark-4)" strokeDasharray="3 3" />
        <XAxis dataKey="day" stroke="var(--mantine-color-dimmed)" />
        <YAxis
          domain={["dataMin - 2", "dataMax + 2"]}
          stroke="var(--mantine-color-green-6)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--mantine-color-dark-7)",
            border: "1px solid var(--mantine-color-dark-4)",
          }}
          formatter={(v: number) => [`${v} lbs`, "Weight"]}
          labelFormatter={(label) => `Day ${label}`}
        />
        <Area
          type="monotone"
          dataKey="weight"
          stroke="var(--mantine-color-green-6)"
          fill="var(--mantine-color-green-6)"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
