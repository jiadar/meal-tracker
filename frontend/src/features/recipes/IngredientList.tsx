import { useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { FoodPicker } from "@/components/FoodPicker";
import { useAddIngredient, useDeleteIngredient, type Recipe } from "./api";

interface Props {
  recipe: Recipe;
}

export function IngredientList({ recipe }: Props) {
  const add = useAddIngredient();
  const del = useDeleteIngredient();
  const [foodId, setFoodId] = useState<string | null>(null);
  const [grams, setGrams] = useState<number | "">("");
  const [note, setNote] = useState("");

  const canAdd = Boolean(foodId) && typeof grams === "number" && grams > 0;

  const submit = async () => {
    if (!foodId || typeof grams !== "number") return;
    try {
      await add.mutateAsync({
        recipe: recipe.id,
        food: foodId,
        grams: grams.toFixed(2),
        note,
        position: recipe.ingredients.length,
      });
      setFoodId(null);
      setGrams("");
      setNote("");
    } catch {
      notifications.show({ color: "red", message: "Could not add ingredient." });
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete ingredient?")) return;
    try {
      await del.mutateAsync(id);
    } catch {
      notifications.show({ color: "red", message: "Could not delete." });
    }
  };

  return (
    <Stack gap="sm">
      <Group grow align="flex-end" wrap="wrap">
        <FoodPicker value={foodId} onChange={(id) => setFoodId(id)} />
        <NumberInput
          label="Grams"
          value={grams}
          onChange={(v) => setGrams(typeof v === "number" ? v : "")}
          min={0}
          step={1}
          decimalScale={2}
        />
        <TextInput
          label="Note"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          placeholder="optional"
        />
        <Button onClick={submit} disabled={!canAdd} loading={add.isPending}>
          Add ingredient
        </Button>
      </Group>

      {recipe.ingredients.length === 0 ? (
        <Text c="dimmed" size="sm">
          No ingredients yet.
        </Text>
      ) : (
        <Table ff="monospace" fz="sm" withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th ta="right">#</Table.Th>
              <Table.Th>Ingredient</Table.Th>
              <Table.Th ta="right">Grams</Table.Th>
              <Table.Th>Note</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recipe.ingredients.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td ta="right">{i.position + 1}</Table.Td>
                <Table.Td>{i.food_name}</Table.Td>
                <Table.Td ta="right">{Number(i.grams).toFixed(1)}</Table.Td>
                <Table.Td>{i.note}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => onDelete(i.id)}
                      loading={del.isPending}
                      aria-label={`Delete ingredient ${i.food_name}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
