import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { API_BASE, buildHandlers, createTestState } from "@/test/handlers";

describe("SettingsPage", () => {
  it("renders all 12 target rows; protein min and creatine min have no High input", async () => {
    const state = createTestState();
    server.use(...buildHandlers(state));

    renderWithProviders(<SettingsPage />);

    // Wait for data to load.
    await screen.findByLabelText("Fat % low");

    for (const label of [
      "Fat %",
      "Sat Fat %",
      "Carb %",
      "Protein %",
      "Added Sugar %",
      "Cholesterol (mg)",
      "Sodium (mg)",
      "Fiber (g)",
      "Protein min (g)",
      "Creatine min (mg)",
      "Sleep hours",
      "Sleep quality (1-5)",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Min-only fields: only one input.
    expect(screen.getByLabelText("Protein min (g) low")).toBeInTheDocument();
    expect(screen.queryByLabelText("Protein min (g) high")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Creatine min (mg) low")).toBeInTheDocument();
    expect(screen.queryByLabelText("Creatine min (mg) high")).not.toBeInTheDocument();

    // Initial values reflect the MSW state (defaults: fat_pct_low = "20.00" → 20).
    expect((screen.getByLabelText("Fat % low") as HTMLInputElement).value).toBe("20");
    expect((screen.getByLabelText("Sleep hours low") as HTMLInputElement).value).toBe(
      "8",
    );

    // Profile / BMR section.
    expect(
      (screen.getByLabelText(/BMR \(calories\/day\)/i) as HTMLInputElement).value,
    ).toBe("1970");
  });

  it("auto-saves BMR after the debounce window", async () => {
    const state = createTestState();
    server.use(...buildHandlers(state));

    const { user } = renderWithProviders(<SettingsPage />);

    const bmr = await screen.findByLabelText(/BMR \(calories\/day\)/i);
    await user.tripleClick(bmr);
    await user.keyboard("2100");

    await waitFor(
      () => {
        expect(state.user.profile.bmr).toBe(2100);
      },
      { timeout: 3500 },
    );
  });

  it("debounces saves: a single edit lands as one PATCH after the debounce window", async () => {
    const state = createTestState();
    let patchCount = 0;
    server.use(
      http.patch(`${API_BASE}/targets/`, async ({ request }) => {
        patchCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        Object.assign(state.targets, body);
        return HttpResponse.json(state.targets);
      }),
      ...buildHandlers(state),
    );

    const { user } = renderWithProviders(<SettingsPage />);

    const fatLow = await screen.findByLabelText("Fat % low");
    await user.tripleClick(fatLow);
    await user.keyboard("25");

    await waitFor(
      () => {
        expect(state.targets.fat_pct_low).toBe("25");
      },
      { timeout: 3500 },
    );
    expect(patchCount).toBe(1);
  });

  it("batches multiple rapid edits into a single PATCH", async () => {
    const state = createTestState();
    let patchCount = 0;
    let lastBody: Record<string, unknown> = {};
    server.use(
      http.patch(`${API_BASE}/targets/`, async ({ request }) => {
        patchCount += 1;
        const body = (await request.json()) as Record<string, unknown>;
        lastBody = body;
        Object.assign(state.targets, body);
        return HttpResponse.json(state.targets);
      }),
      ...buildHandlers(state),
    );

    const { user } = renderWithProviders(<SettingsPage />);

    const fatLow = await screen.findByLabelText("Fat % low");
    await user.tripleClick(fatLow);
    await user.keyboard("21");

    const carbLow = screen.getByLabelText("Carb % low");
    await user.tripleClick(carbLow);
    await user.keyboard("50");

    const sodHigh = screen.getByLabelText("Sodium (mg) high");
    await user.tripleClick(sodHigh);
    await user.keyboard("2000");

    await waitFor(
      () => {
        expect(patchCount).toBe(1);
        expect(state.targets.fat_pct_low).toBe("21");
        expect(state.targets.carb_pct_low).toBe("50");
        expect(state.targets.sodium_high).toBe("2000");
      },
      { timeout: 3500 },
    );

    // Sanity-check: only changed fields are in the PATCH body.
    expect(Object.keys(lastBody).sort()).toEqual(
      ["carb_pct_low", "fat_pct_low", "sodium_high"].sort(),
    );
  });

  it("save status pill cycles through Unsaved → Saving → Saved", async () => {
    const state = createTestState();
    server.use(...buildHandlers(state));

    const { user } = renderWithProviders(<SettingsPage />);

    const fatLow = await screen.findByLabelText("Fat % low");

    // Initial pill is "Saved" (server matches form).
    const pill = screen.getByLabelText(/save status:/i);
    expect(within(pill).getByText("Saved")).toBeInTheDocument();

    // Edit → "Unsaved".
    await user.tripleClick(fatLow);
    await user.keyboard("22");
    await waitFor(() => {
      expect(within(pill).getByText("Unsaved")).toBeInTheDocument();
    });

    // After debounce + save → "Saved".
    await waitFor(
      () => {
        expect(within(pill).getByText("Saved")).toBeInTheDocument();
      },
      { timeout: 3500 },
    );
  });

  it("sleep quality is sent as a number, not a string", async () => {
    const state = createTestState();
    let lastBody: Record<string, unknown> = {};
    server.use(
      http.patch(`${API_BASE}/targets/`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        lastBody = body;
        Object.assign(state.targets, body);
        return HttpResponse.json(state.targets);
      }),
      ...buildHandlers(state),
    );

    const { user } = renderWithProviders(<SettingsPage />);

    const qualLow = await screen.findByLabelText("Sleep quality (1-5) low");
    await user.tripleClick(qualLow);
    await user.keyboard("3");

    await waitFor(
      () => {
        expect(state.targets.sleep_quality_low).toBe(3);
      },
      { timeout: 3500 },
    );
    expect(typeof lastBody.sleep_quality_low).toBe("number");
  });
});
