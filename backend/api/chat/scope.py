"""Per-request user scope for chat tools.

The chat view sets the current user before invoking the Agent SDK; tool
functions read it via ``get_current_user`` to filter ORM queries. We use
``contextvars`` so the scope works correctly inside the SDK's async loop.
"""

from contextvars import ContextVar

from django.contrib.auth import get_user_model

User = get_user_model()

_current_user: ContextVar[User | None] = ContextVar("current_user", default=None)


def set_current_user(user: User) -> None:
    _current_user.set(user)


def get_current_user() -> User:
    user = _current_user.get()
    if user is None:
        raise RuntimeError(
            "current_user not set; chat tool called outside chat_view scope"
        )
    return user
