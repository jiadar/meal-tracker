import { useMemo, useState } from "react";
import { Paper, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useFoods, type Food } from "./api";

function n(v: string, digits = 1): string {
  const num = Number(v);
  if (!isFinite(num)) return "—";
  return num.toFixed(digits);
}

export function FoodsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useFoods(search);

  const sorted = useMemo(() => {
    if (!data) return [] as Food[];
    return [...data].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const count = sorted.length;

  return (
    <Stack>
      <Title order={2}>Foods</Title>
      <TextInput
        placeholder="Search foods"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
      />
      <Text size="xs" c="dimmed" ff="monospace" tt="uppercase">
        {isLoading ? "Loading…" : `${count} items · per 100g`}
      </Text>
      <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
        <Table
          striped
          highlightOnHover
          stickyHeader
          withRowBorders={false}
          ff="monospace"
          fz="sm"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Food</Table.Th>
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
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((f, i) => (
              <Table.Tr key={f.id}>
                <Table.Td c="dimmed">{i + 1}</Table.Td>
                <Table.Td>{f.name}</Table.Td>
                <Table.Td ta="right">{n(f.calories, 0)}</Table.Td>
                <Table.Td ta="right">{n(f.fat)}</Table.Td>
                <Table.Td ta="right">{n(f.sat_fat)}</Table.Td>
                <Table.Td ta="right">{n(f.cholesterol, 0)}</Table.Td>
                <Table.Td ta="right">{n(f.sodium, 0)}</Table.Td>
                <Table.Td ta="right">{n(f.carbs)}</Table.Td>
                <Table.Td ta="right">{n(f.fiber)}</Table.Td>
                <Table.Td ta="right">{n(f.sugar)}</Table.Td>
                <Table.Td ta="right">{n(f.add_sugar)}</Table.Td>
                <Table.Td ta="right">{n(f.protein)}</Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && sorted.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={12}>
                  <Text ta="center" c="dimmed" py="lg">
                    No foods match.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
