import { useMemo, useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconEdit, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { FoodPicker } from "@/components/FoodPicker";
import {
  useCreateDay,
  useCreateMeal,
  useDayByDate,
  useDeleteMeal,
  useToday,
  useUpdateMeal,
  type DaySummary,
  type MealItem,
} from "./api";

function fmt(n: number | undefined | null, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toFixed(digits);
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
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

function SummaryCards({ summary }: { summary: DaySummary }) {
  const net = Math.abs(summary.net_calories);
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
      <StatCard label="BMR" value={summary.bmr.toLocaleString()} />
      <StatCard label="Exercise" value={summary.exercise_calories.toLocaleString()} />
      <StatCard label="Allowed" value={summary.allowed_calories.toLocaleString()} />
      <StatCard label="Consumed" value={fmt(summary.consumed_calories, 0)} color="grape" />
      <StatCard
        label={summary.is_surplus ? "Surplus" : "Deficit"}
        value={fmt(net, 0)}
        color={summary.is_surplus ? "red" : "green"}
      />
      <StatCard
        label="Protein %"
        value={summary.macros.protein_pct != null ? `${(summary.macros.protein_pct * 100).toFixed(1)}%` : "—"}
      />
    </SimpleGrid>
  );
}

function MealRow({
  meal,
  index,
  onSaved,
  dayId,
}: {
  meal: MealItem;
  index: number;
  onSaved: () => void;
  dayId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState<number>(Number(meal.grams));
  const update = useUpdateMeal(dayId);
  const del = useDeleteMeal(dayId);

  const n = meal.nutrition;

  const save = async () => {
    try {
      await update.mutateAsync({ id: meal.id, grams: grams.toString() });
      setEditing(false);
      onSaved();
    } catch {
      notifications.show({ color: "red", message: "Could not update meal." });
    }
  };

  const confirmDelete = async () => {
    if (!window.confirm(`Delete ${meal.food_name}?`)) return;
    try {
      await del.mutateAsync(meal.id);
      onSaved();
    } catch {
      notifications.show({ color: "red", message: "Could not delete." });
    }
  };

  return (
    <Table.Tr>
      <Table.Td c="dimmed">{index + 1}</Table.Td>
      <Table.Td>{meal.food_name}</Table.Td>
      <Table.Td ta="right">
        {editing ? (
          <NumberInput
            value={grams}
            onChange={(v) => setGrams(typeof v === "number" ? v : 0)}
            min={0}
            step={5}
            size="xs"
            styles={{ input: { textAlign: "right", width: 80 } }}
          />
        ) : (
          fmt(Number(meal.grams), 0)
        )}
      </Table.Td>
      <Table.Td ta="right">{fmt(n.calories, 0)}</Table.Td>
      <Table.Td ta="right">{fmt(n.fat)}</Table.Td>
      <Table.Td ta="right">{fmt(n.sat_fat)}</Table.Td>
      <Table.Td ta="right">{fmt(n.cholesterol, 0)}</Table.Td>
      <Table.Td ta="right">{fmt(n.sodium, 0)}</Table.Td>
      <Table.Td ta="right">{fmt(n.carbs)}</Table.Td>
      <Table.Td ta="right">{fmt(n.fiber)}</Table.Td>
      <Table.Td ta="right">{fmt(n.sugar)}</Table.Td>
      <Table.Td ta="right">{fmt(n.add_sugar)}</Table.Td>
      <Table.Td ta="right">{fmt(n.protein)}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap" justify="flex-end">
          {editing ? (
            <>
              <ActionIcon
                variant="subtle"
                color="green"
                onClick={save}
                loading={update.isPending}
                aria-label="Save"
              >
                <IconCheck size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  setGrams(Number(meal.grams));
                  setEditing(false);
                }}
                aria-label="Cancel"
              >
                <IconX size={16} />
              </ActionIcon>
            </>
          ) : (
            <>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setEditing(true)}
                aria-label="Edit"
              >
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={confirmDelete}
                loading={del.isPending}
                aria-label="Delete"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

function AddMealForm({ dayId, onAdded }: { dayId: string; onAdded: () => void }) {
  const [foodId, setFoodId] = useState<string | null>(null);
  const [grams, setGrams] = useState<number | "">(100);
  const create = useCreateMeal(dayId);

  const submit = async () => {
    if (!foodId || typeof grams !== "number" || grams <= 0) return;
    try {
      await create.mutateAsync({ day: dayId, food: foodId, grams: grams.toString() });
      setFoodId(null);
      setGrams(100);
      onAdded();
    } catch {
      notifications.show({ color: "red", message: "Could not add meal." });
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group align="flex-end" wrap="nowrap">
        <div style={{ flex: 1 }}>
          <FoodPicker value={foodId} onChange={(id) => setFoodId(id)} />
        </div>
        <NumberInput
          label="Grams"
          value={grams}
          onChange={(v) => setGrams(typeof v === "number" ? v : "")}
          min={0}
          step={5}
          w={120}
        />
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={submit}
          loading={create.isPending}
          disabled={!foodId || typeof grams !== "number" || grams <= 0}
        >
          Add
        </Button>
      </Group>
    </Paper>
  );
}

export function DayDetailPage() {
  const { data: today } = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const date = selected ?? today?.date;

  const dayQ = useDayByDate(date);
  const createDay = useCreateDay();

  const selectedDate = useMemo(() => (date ? new Date(`${date}T00:00:00`) : null), [date]);

  const day = dayQ.data;
  const meals = day?.meals ?? [];
  const summary = day?.summary;

  const handleCreateDay = async () => {
    if (!date) return;
    try {
      await createDay.mutateAsync({ date });
      dayQ.refetch();
    } catch {
      notifications.show({ color: "red", message: "Could not create day." });
    }
  };

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Day Detail</Title>
        <DatePickerInput
          value={selectedDate}
          onChange={(v) => {
            if (!v) return;
            const d = typeof v === "string" ? new Date(v) : v;
            setSelected(d.toISOString().slice(0, 10));
          }}
          w={180}
        />
      </Group>

      {dayQ.isLoading && <Text c="dimmed">Loading…</Text>}

      {!dayQ.isLoading && !day && date && (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" py="xl">
            <Text c="dimmed">No day record for {date}.</Text>
            <Button onClick={handleCreateDay} loading={createDay.isPending}>
              Create day
            </Button>
          </Stack>
        </Paper>
      )}

      {day && summary && (
        <>
          <SummaryCards summary={summary} />
          <AddMealForm dayId={day.id} onAdded={() => dayQ.refetch()} />
          <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
            <Table ff="monospace" fz="sm" withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">g</Table.Th>
                  <Table.Th ta="right">Cal</Table.Th>
                  <Table.Th ta="right">Fat</Table.Th>
                  <Table.Th ta="right">Sat</Table.Th>
                  <Table.Th ta="right">Chol</Table.Th>
                  <Table.Th ta="right">Na</Table.Th>
                  <Table.Th ta="right">Carb</Table.Th>
                  <Table.Th ta="right">Fiber</Table.Th>
                  <Table.Th ta="right">Sugar</Table.Th>
                  <Table.Th ta="right">Add S</Table.Th>
                  <Table.Th ta="right">Prot</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {meals.map((m, i) => (
                  <MealRow
                    key={m.id}
                    meal={m}
                    index={i}
                    dayId={day.id}
                    onSaved={() => dayQ.refetch()}
                  />
                ))}
                {meals.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={14}>
                      <Text ta="center" c="dimmed" py="lg">
                        No meals logged yet.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {meals.length > 0 && (
                  <>
                    <Table.Tr>
                      <Table.Td />
                      <Table.Td fw={700}>TOTALS</Table.Td>
                      <Table.Td />
                      <Table.Td ta="right" fw={700} c="grape">
                        {fmt(summary.totals.calories, 0)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.fat)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.sat_fat)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.cholesterol, 0)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.sodium, 0)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.carbs)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.fiber)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.sugar)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.add_sugar)}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {fmt(summary.totals.protein)}
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td />
                      <Table.Td fw={700} c="dimmed">
                        MACRO %
                      </Table.Td>
                      <Table.Td />
                      <Table.Td />
                      <Table.Td ta="right" c="dimmed">
                        {summary.macros.fat_pct != null
                          ? `${(summary.macros.fat_pct * 100).toFixed(1)}%`
                          : "—"}
                      </Table.Td>
                      <Table.Td ta="right" c="dimmed">
                        {summary.macros.sat_fat_pct != null
                          ? `${(summary.macros.sat_fat_pct * 100).toFixed(1)}%`
                          : "—"}
                      </Table.Td>
                      <Table.Td colSpan={2} />
                      <Table.Td ta="right" c="dimmed">
                        {summary.macros.carb_pct != null
                          ? `${(summary.macros.carb_pct * 100).toFixed(1)}%`
                          : "—"}
                      </Table.Td>
                      <Table.Td colSpan={2} />
                      <Table.Td ta="right" c="dimmed">
                        {summary.macros.add_sugar_pct != null
                          ? `${(summary.macros.add_sugar_pct * 100).toFixed(1)}%`
                          : "—"}
                      </Table.Td>
                      <Table.Td ta="right" c="dimmed">
                        {summary.macros.protein_pct != null
                          ? `${(summary.macros.protein_pct * 100).toFixed(1)}%`
                          : "—"}
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  </>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </>
      )}
    </Stack>
  );
}
