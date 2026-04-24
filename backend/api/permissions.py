from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """Object-level permission: obj must be owned by request.user.

    Works for models with a `user` FK, or models that hang off an object
    that has a `user` FK (e.g. Meal → Day → User).
    """

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "user", None)
        if owner is None and hasattr(obj, "day"):
            owner = obj.day.user
        if owner is None and hasattr(obj, "food"):
            owner = obj.food.user
        if owner is None and hasattr(obj, "recipe"):
            owner = obj.recipe.food.user
        return owner == request.user


class IsEmailVerified(permissions.BasePermission):
    """Require that request.user has a verified email.

    Applied to domain endpoints so unverified users can't interact with
    user data via the API. Auth endpoints (login, verify, etc.) remain open.
    """

    message = "Email verification required."
    code = "email_not_verified"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_email_verified)
