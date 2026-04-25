import { useState } from "react";
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FoodPicker } from "@/components/FoodPicker";
import { useCreateRecipe } from "./api";

interface Props {
  onCreated?: (id: string) => void;
}

export function RecipeForm({ onCreated }: Props) {
  const create = useCreateRecipe();
  const [foodId, setFoodId] = useState<string | null>(null);
  const [servings, setServings] = useState<number | "">("");
  const [totalGrams, setTotalGrams] = useState<number | "">("");
  const [sourceUrl, setSourceUrl] = useState("");

  const canSubmit = Boolean(foodId);

  const submit = async () => {
    if (!foodId) return;
    try {
      const res = await create.mutateAsync({
        food: foodId,
        servings: typeof servings === "number" ? servings : null,
        total_grams_produced:
          typeof totalGrams === "number" ? totalGrams.toFixed(2) : null,
        source_url: sourceUrl || undefined,
      });
      setFoodId(null);
      setServings("");
      setTotalGrams("");
      setSourceUrl("");
      onCreated?.(res.id);
    } catch {
      notifications.show({
        color: "red",
        message: "Could not create recipe (the food may already have one).",
      });
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Title order={5} ff="monospace" tt="uppercase">
          New recipe
        </Title>
        <Group grow align="flex-end" wrap="wrap">
          <FoodPicker value={foodId} onChange={(id) => setFoodId(id)} />
          <NumberInput
            label="Servings"
            value={servings}
            onChange={(v) => setServings(typeof v === "number" ? v : "")}
            min={0}
            step={1}
          />
          <NumberInput
            label="Total grams produced"
            value={totalGrams}
            onChange={(v) => setTotalGrams(typeof v === "number" ? v : "")}
            min={0}
            step={1}
            decimalScale={2}
          />
          <TextInput
            label="Source URL"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.currentTarget.value)}
            placeholder="https://…"
          />
          <Button
            onClick={submit}
            disabled={!canSubmit}
            loading={create.isPending}
          >
            Create recipe
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
