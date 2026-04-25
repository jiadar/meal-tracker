import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipesPage } from "./RecipesPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import {
  buildHandlers,
  createTestState,
  makeFood,
  type RecipeFixture,
} from "@/test/handlers";

afterEach(() => {
  vi.restoreAllMocks();
});

function seedRecipe(
  state: ReturnType<typeof createTestState>,
  foodId: string,
  partial: Partial<RecipeFixture> = {},
): RecipeFixture {
  const recipe: RecipeFixture = {
    id: `recipe-${state.nextRecipeId++}`,
    food: foodId,
    servings: 4,
    total_grams_produced: "1000.00",
    prep_time_minutes: null,
    cook_time_minutes: null,
    instructions: "",
    notes: "",
    source_url: "",
    ingredients: [],
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...partial,
  };
  state.recipes.push(recipe);
  return recipe;
}

describe("RecipesPage", () => {
  it("shows the empty-state plus form when no recipes exist", async () => {
    const state = createTestState({
      foods: [makeFood({ id: "f-rice", name: "Rice", calories: 130 })],
    });
    server.use(...buildHandlers(state));

    renderWithProviders(<RecipesPage />);

    expect(await screen.findByText(/no recipes yet/i)).toBeInTheDocument();
    expect(screen.getByText(/^new recipe$/i)).toBeInTheDocument();
  });

  it("lists recipes and shows ingredients for the selected one", async () => {
    const state = createTestState({
      foods: [
        makeFood({ id: "f-veg", name: "Veggie Loaf", calories: 108 }),
        makeFood({ id: "f-onion", name: "Onion", calories: 40 }),
      ],
    });
    const recipe = seedRecipe(state, "f-veg");
    recipe.ingredients.push({
      id: "ing-1",
      recipe: recipe.id,
      food: "f-onion",
      food_name: "Onion",
      grams: "200.00",
      note: "diced",
      position: 0,
    });
    server.use(...buildHandlers(state));

    renderWithProviders(<RecipesPage />);

    expect((await screen.findAllByText("Veggie Loaf")).length).toBeGreaterThanOrEqual(1);
    // Selected (first/only) recipe's ingredient list shows Onion + note.
    await waitFor(() => {
      // "Onion" can appear in the FoodPicker options too — at least one match is enough.
      expect(screen.getAllByText("Onion").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("diced")).toBeInTheDocument();
  });

  it("deletes a recipe after confirm", async () => {
    const state = createTestState({
      foods: [makeFood({ id: "f-veg", name: "Veggie Loaf", calories: 108 })],
    });
    seedRecipe(state, "f-veg");
    server.use(...buildHandlers(state));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { user } = renderWithProviders(<RecipesPage />);
    await screen.findAllByText("Veggie Loaf");

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(state.recipes).toHaveLength(0);
    });
  });
});
