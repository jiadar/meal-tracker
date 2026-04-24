import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodsPage } from "./FoodsPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState, makeFood } from "@/test/handlers";

describe("FoodsPage", () => {
  it("renders foods alphabetized with sequential IDs and per-100g values", async () => {
    const state = createTestState({
      foods: [
        makeFood({ id: "f-oats", name: "Oats", calories: 389, protein: 17 }),
        makeFood({ id: "f-milk", name: "Milk", calories: 61, protein: 3.2 }),
        makeFood({ id: "f-apple", name: "Apple", calories: 52, protein: 0.3 }),
      ],
    });
    server.use(...buildHandlers(state));

    renderWithProviders(<FoodsPage />);

    expect(await screen.findByText(/3 items · per 100g/i)).toBeInTheDocument();

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1); // drop header row
    const names = rows.map((r) => within(r).getAllByRole("cell")[1]?.textContent);
    expect(names).toEqual(["Apple", "Milk", "Oats"]);

    // IDs are sequential starting at 1 in alphabetical order.
    const ids = rows.map((r) => within(r).getAllByRole("cell")[0]?.textContent);
    expect(ids).toEqual(["1", "2", "3"]);

    // Calories column renders as whole number per 100g.
    const appleRow = rows[0];
    expect(within(appleRow).getByText("52")).toBeInTheDocument();
  });

  it("filters foods by search via the server", async () => {
    const state = createTestState({
      foods: [
        makeFood({ id: "f-oats", name: "Oats", calories: 389 }),
        makeFood({ id: "f-milk", name: "Milk", calories: 61 }),
        makeFood({ id: "f-apple", name: "Apple", calories: 52 }),
      ],
    });
    server.use(...buildHandlers(state));

    const { user } = renderWithProviders(<FoodsPage />);

    expect(await screen.findByText(/3 items · per 100g/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search foods/i), "oa");

    await waitFor(() => {
      expect(screen.getByText(/1 items · per 100g/i)).toBeInTheDocument();
    });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Oats")).toBeInTheDocument();
    expect(within(table).queryByText("Milk")).not.toBeInTheDocument();
    expect(within(table).queryByText("Apple")).not.toBeInTheDocument();
  });

  it("shows an empty message when no foods match", async () => {
    const state = createTestState({
      foods: [makeFood({ id: "f-milk", name: "Milk", calories: 61 })],
    });
    server.use(...buildHandlers(state));

    const { user } = renderWithProviders(<FoodsPage />);

    await screen.findByText("Milk");
    await user.type(screen.getByPlaceholderText(/search foods/i), "zzz");

    expect(await screen.findByText(/no foods match/i)).toBeInTheDocument();
  });
});
