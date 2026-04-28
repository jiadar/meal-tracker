import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatPage } from "./ChatPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { API_BASE } from "@/test/handlers";

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
}

function chatHandler(frames: string[]) {
  return http.post(`${API_BASE}/chat/`, () =>
    new HttpResponse(sseStream(frames), {
      headers: { "Content-Type": "text/event-stream" },
    }),
  );
}

describe("ChatPage", () => {
  it("renders the empty-state hint when no messages have been sent", async () => {
    renderWithProviders(<ChatPage />);
    expect(
      await screen.findByText(/tell me what you ate or how you slept/i),
    ).toBeInTheDocument();
  });

  it("streams text deltas into the assistant bubble and renders tool-call pills", async () => {
    server.use(
      chatHandler([
        'event: text\ndata: {"delta": "Logged "}\n\n',
        'event: text\ndata: {"delta": "your meal."}\n\n',
        'event: tool_call\ndata: {"name": "log_meal", "input": {"grams": 100}, "result": "ok", "is_error": false}\n\n',
        'event: done\ndata: {}\n\n',
      ]),
    );

    const { user } = renderWithProviders(<ChatPage />);
    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, "I had an egg");
    await user.click(screen.getByRole("button", { name: /send/i }));

    // User bubble immediately reflects the typed text.
    expect(await screen.findByText("I had an egg")).toBeInTheDocument();

    // Streamed assistant text concatenates as deltas arrive.
    await waitFor(() => {
      expect(screen.getByText("Logged your meal.")).toBeInTheDocument();
    });

    // Tool-call pill renders.
    await waitFor(() => {
      expect(screen.getByText(/log_meal/)).toBeInTheDocument();
    });
  });

  it("surfaces server-sent error frames in the UI", async () => {
    server.use(
      chatHandler([
        'event: error\ndata: {"message": "rate limited"}\n\n',
        'event: done\ndata: {}\n\n',
      ]),
    );

    const { user } = renderWithProviders(<ChatPage />);
    await user.type(screen.getByPlaceholderText(/type a message/i), "hi");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });
  });
});
