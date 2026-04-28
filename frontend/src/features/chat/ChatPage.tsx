import { useRef, useState } from "react";
import {
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { IconSend, IconX } from "@tabler/icons-react";
import { streamChat, type ChatMessage, type ToolCallEvent } from "./api";
import { MessageBubble } from "./MessageBubble";

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: text };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", toolCalls: [] };
    const next = [...messages, userMsg, assistantMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const controller = streamChat([...messages, userMsg], {
      onTextDelta: (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          }
          return copy;
        });
      },
      onToolCall: (event: ToolCallEvent) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              toolCalls: [...(last.toolCalls ?? []), event],
            };
          }
          return copy;
        });
      },
      onError: (msg) => setError(msg),
      onDone: () => {
        setStreaming(false);
        controllerRef.current = null;
      },
    });
    controllerRef.current = controller;
  };

  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        copy.pop();
      }
      return copy;
    });
  };

  return (
    <Stack h="calc(100vh - 100px)">
      <Title order={2}>Chat</Title>

      <Paper withBorder p="md" radius="md" style={{ flex: 1, overflowY: "auto" }}>
        {messages.length === 0 ? (
          <Text c="dimmed">
            Tell me what you ate or how you slept. e.g. <em>"I had 2 eggs and a banana
            for breakfast"</em>.
          </Text>
        ) : (
          <Stack gap="md">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {streaming && (
              <Group gap={6}>
                <Loader size="xs" />
                <Text c="dimmed" size="sm">Thinking…</Text>
              </Group>
            )}
          </Stack>
        )}
      </Paper>

      {error && (
        <Paper withBorder p="sm" radius="md" c="red">
          <Text size="sm">Error: {error}</Text>
        </Paper>
      )}

      <Group align="flex-end" wrap="nowrap">
        <Textarea
          flex={1}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="Type a message..."
          minRows={1}
          rows={2}
          disabled={streaming}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {streaming ? (
          <Button
            onClick={cancel}
            variant="subtle"
            color="red"
            leftSection={<IconX size={16} />}
          >
            Cancel
          </Button>
        ) : (
          <Button
            onClick={send}
            disabled={!input.trim()}
            leftSection={<IconSend size={16} />}
          >
            Send
          </Button>
        )}
      </Group>

      <Text c="dimmed" size="xs">
        Sent to Claude (your Max plan).
      </Text>
    </Stack>
  );
}
