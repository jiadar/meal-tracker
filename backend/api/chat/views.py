"""Chat view — POST /api/v1/chat/ → text/event-stream.

The view sets the per-request user scope, configures the Agent SDK with our
in-process MCP tool server, and translates the SDK's async message stream
into SSE frames the frontend can consume.

Each request handles a single user turn: the body is the running
``messages`` array (client-managed), and we feed the most recent user
message to the SDK along with the prior turns as context via the
``permission_mode`` and message buffer behavior of ``ClaudeSDKClient``.
For v1 we use the simpler ``query()`` API and let the client send full
history each turn — the SDK does its own caching of the system prompt
and tool defs.
"""

import asyncio
import json
from typing import AsyncIterator

from asgiref.sync import async_to_sync
from django.http import StreamingHttpResponse
from rest_framework import permissions
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.throttling import ScopedRateThrottle

from api.permissions import IsEmailVerified

from .scope import set_current_user
from .system_prompt import SYSTEM_PROMPT
from .tools import ALL_TOOLS

MCP_SERVER_NAME = "meal_tracker"


def _sse_frame(event: str, data: dict | str) -> bytes:
    body = data if isinstance(data, str) else json.dumps(data, default=str)
    return f"event: {event}\ndata: {body}\n\n".encode("utf-8")


async def _run_chat(messages: list[dict]) -> AsyncIterator[bytes]:
    """Invoke the Agent SDK and yield SSE frames."""
    # Local imports keep the module importable in tests where the SDK isn't
    # installed (tests monkeypatch this function).
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        TextBlock,
        ToolResultBlock,
        ToolUseBlock,
        create_sdk_mcp_server,
        query,
    )

    server = create_sdk_mcp_server(name=MCP_SERVER_NAME, version="1.0.0", tools=ALL_TOOLS)
    allowed = [f"mcp__{MCP_SERVER_NAME}__{t.name}" for t in ALL_TOOLS]

    # Compose all prior turns into the prompt; the SDK doesn't take a
    # raw messages array on `query()`, so we serialize the history.
    history = "\n".join(
        f"{m['role'].upper()}: {m['content']}"
        for m in messages[:-1]
        if m.get("content")
    )
    last_user = messages[-1]["content"] if messages else ""
    prompt = f"{history}\n\nUSER: {last_user}".strip() if history else last_user

    options = ClaudeAgentOptions(
        system_prompt=SYSTEM_PROMPT,
        mcp_servers={MCP_SERVER_NAME: server},
        allowed_tools=allowed,
    )

    pending_tool_inputs: dict[str, dict] = {}

    try:
        async for msg in query(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock) and block.text:
                        yield _sse_frame("text", {"delta": block.text})
                    elif isinstance(block, ToolUseBlock):
                        # Buffer the input so we can pair it with the result.
                        pending_tool_inputs[block.id] = {
                            "name": block.name,
                            "input": block.input,
                        }
                    elif isinstance(block, ToolResultBlock):
                        meta = pending_tool_inputs.pop(block.tool_use_id, {})
                        yield _sse_frame(
                            "tool_call",
                            {
                                "name": meta.get("name", ""),
                                "input": meta.get("input", {}),
                                "result": _stringify_result(block.content),
                                "is_error": getattr(block, "is_error", False) or False,
                            },
                        )
    except Exception as e:  # pragma: no cover - surfaced to client
        yield _sse_frame("error", {"message": str(e)})

    yield _sse_frame("done", {})


def _stringify_result(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for c in content:
            if isinstance(c, dict) and c.get("type") == "text":
                out.append(c.get("text", ""))
            else:
                out.append(json.dumps(c, default=str))
        return "\n".join(out)
    return json.dumps(content, default=str)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsEmailVerified])
@throttle_classes([ScopedRateThrottle])
def chat_view(request):
    """
    Body: {"messages": [{"role": "user"|"assistant", "content": "..."}]}
    Returns: text/event-stream
    """
    messages = request.data.get("messages") or []
    if not messages or messages[-1].get("role") != "user":
        return StreamingHttpResponse(
            iter([_sse_frame("error", {"message": "last message must be from user"})]),
            content_type="text/event-stream",
        )

    set_current_user(request.user)

    def stream():
        agen = _run_chat(messages)
        loop = asyncio.new_event_loop()
        try:
            while True:
                try:
                    chunk = loop.run_until_complete(agen.__anext__())
                except StopAsyncIteration:
                    break
                yield chunk
        finally:
            loop.close()

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # disable nginx buffering for SSE
    return response


chat_view.throttle_scope = "chat"  # type: ignore[attr-defined]
