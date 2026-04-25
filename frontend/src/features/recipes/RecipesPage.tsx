import { useState } from "react";
import {
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useFoods } from "@/features/foods/api";
import {
  useDeleteRecipe,
  useRecipes,
  useRecomputeRecipe,
  type Recipe,
} from "./api";
import { IngredientList } from "./IngredientList";
import { RecipeForm } from "./RecipeForm";

function foodNameFor(recipe: Recipe, foodNames: Map<string, string>): string {
  return foodNames.get(recipe.food) ?? "(unknown food)";
}

export function RecipesPage() {
  const recipesQ = useRecipes();
  const foodsQ = useFoods();
  const del = useDeleteRecipe();
  const recompute = useRecomputeRecipe();

  const recipes = recipesQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select the first recipe once data loads — render-time state sync
  // (avoids set-state-in-effect on a one-shot init).
  if (selectedId == null && recipes.length > 0) {
    setSelectedId(recipes[0].id);
  }

  const foodNames = new Map<string, string>(
    (foodsQ.data ?? []).map((f) => [f.id, f.name]),
  );
  const selected = recipes.find((r) => r.id === selectedId) ?? null;

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete recipe? Ingredients will also be removed.")) return;
    try {
      await del.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
    } catch {
      notifications.show({ color: "red", message: "Could not delete recipe." });
    }
  };

  const handleRecompute = async () => {
    if (!selected) return;
    try {
      await recompute.mutateAsync(selected.id);
      notifications.show({ message: "Nutrition recomputed." });
    } catch {
      notifications.show({ color: "red", message: "Could not recompute." });
    }
  };

  if (recipesQ.isLoading) return <Text>Loading…</Text>;

  return (
    <Stack>
      <Title order={2}>Recipes</Title>

      {recipes.length === 0 ? (
        <>
          <Paper withBorder p="md" radius="md">
            <Text c="dimmed">
              No recipes yet. Pick an existing food to attach a recipe to it.
            </Text>
          </Paper>
          <RecipeForm onCreated={(id) => setSelectedId(id)} />
        </>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper withBorder p="sm" radius="md">
              <Stack gap={4}>
                {recipes.map((r) => {
                  const isActive = r.id === selectedId;
                  return (
                    <Group
                      key={r.id}
                      justify="space-between"
                      style={{
                        padding: 8,
                        borderRadius: 4,
                        cursor: "pointer",
                        background: isActive
                          ? "var(--mantine-color-dark-5)"
                          : undefined,
                      }}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div>
                        <Text fw={600}>{foodNameFor(r, foodNames)}</Text>
                        <Text size="xs" c="dimmed">
                          {r.servings ? `${r.servings} servings` : "—"}
                          {r.total_grams_produced
                            ? ` · ${Number(r.total_grams_produced).toFixed(0)} g`
                            : ""}
                          {" · "}
                          {r.ingredients.length} ingredient
                          {r.ingredients.length === 1 ? "" : "s"}
                        </Text>
                      </div>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(r.id);
                        }}
                      >
                        Delete
                      </Button>
                    </Group>
                  );
                })}
              </Stack>
            </Paper>

            <Paper withBorder p="sm" radius="md">
              {selected ? (
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={5}>
                      {foodNameFor(selected, foodNames)}
                    </Title>
                    <Button
                      size="xs"
                      onClick={handleRecompute}
                      loading={recompute.isPending}
                    >
                      Recompute nutrition
                    </Button>
                  </Group>
                  <IngredientList recipe={selected} />
                </Stack>
              ) : (
                <Text c="dimmed">Select a recipe to view ingredients.</Text>
              )}
            </Paper>
          </SimpleGrid>

          <RecipeForm onCreated={(id) => setSelectedId(id)} />
        </>
      )}
    </Stack>
  );
}
