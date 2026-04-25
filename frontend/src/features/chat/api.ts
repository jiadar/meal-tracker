import { API_BASE_URL, ApiError } from "@/lib/apiClient";
import { getAccessToken, useAuthStore } from "@/lib/authStore";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallEvent[];
}

export interface ToolCallEvent {
  name: string;
  input: Record<string, unknown>;
  result: string;
  is_error: boolean;
}

export interface ChatStreamCallbacks {
  onTextDelta: (delta: string) => void;
  onToolCall: (event: ToolCallEvent) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/**
 * POST the message history to /api/v1/chat/ and parse the SSE response.
 * Returns an AbortController so the caller can cancel.
 */
export function streamChat(
  messages: ChatMessage[],
  callbacks: ChatStreamCallbacks,
): AbortController {
  const controller = new AbortController();
  void run(messages, callbacks, controller.signal);
  return controller;
}

async function run(
  messages: ChatMessage[],
  cb: ChatStreamCallbacks,
  signal: AbortSignal,
): Promise<void> {
  const access =
    getAccessToken() ?? useAuthStore.getState().accessToken ?? "";
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (access) headers.Authorization = `Bearer ${access}`;

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}/chat/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    });
  } catch (e) {
    if (signal.aborted) return;
    cb.onError((e as Error).message);
    cb.onDone();
    return;
  }

  if (!resp.ok || !resp.body) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (Array.isArray(body?.errors) && body.errors.length) {
        detail = body.errors[0].message ?? detail;
      }
    } catch {
      // ignore parse error
    }
    cb.onError(detail);
    cb.onDone();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed) continue;
        const parsed = parseFrame(trimmed);
        if (!parsed) continue;
        dispatch(parsed.event, parsed.data, cb);
      }
    }
  } catch (e) {
    if (!signal.aborted) cb.onError((e as Error).message);
  } finally {
    cb.onDone();
  }
}

function parseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

function dispatch(event: string, data: string, cb: ChatStreamCallbacks): void {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    payload = { raw: data };
  }
  switch (event) {
    case "text":
      cb.onTextDelta(String(payload.delta ?? ""));
      break;
    case "tool_call":
      cb.onToolCall({
        name: String(payload.name ?? ""),
        input: (payload.input as Record<string, unknown>) ?? {},
        result: String(payload.result ?? ""),
        is_error: Boolean(payload.is_error),
      });
      break;
    case "error":
      cb.onError(String(payload.message ?? "unknown error"));
      break;
    case "done":
      // onDone is fired by the finally block; ignore the explicit frame.
      break;
  }
}

// Avoid unused-import lint when ApiError isn't referenced (we use the
// SSE error frame instead of throwing ApiError).
void ApiError;
