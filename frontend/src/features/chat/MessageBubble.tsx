import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import type { ChatMessage } from "./api";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const align = isUser ? "flex-end" : "flex-start";
  const bg = isUser ? "var(--mantine-color-grape-light)" : "var(--mantine-color-dark-6)";

  return (
    <Group justify={isUser ? "flex-end" : "flex-start"} align="flex-start" w="100%">
      <Stack gap={4} align={align} maw="80%">
        <Paper p="sm" radius="md" style={{ background: bg }}>
          <Text style={{ whiteSpace: "pre-wrap" }}>{message.content}</Text>
        </Paper>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <Group gap={4} wrap="wrap" justify={isUser ? "flex-end" : "flex-start"}>
            {message.toolCalls.map((tc, idx) => (
              <Badge
                key={idx}
                variant="light"
                color={tc.is_error ? "red" : "green"}
                title={`${tc.name}(${JSON.stringify(tc.input)}) → ${tc.result}`}
              >
                {tc.is_error ? "✗" : "✓"} {tc.name}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
    </Group>
  );
}
