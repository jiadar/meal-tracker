from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse

from .tokens import EMAIL_VERIFY_PURPOSE, PASSWORD_RESET_PURPOSE, make_token


def _absolute(path: str) -> str:
    return f"{settings.API_BASE_URL.rstrip('/')}{path}"


def send_verification_email(user) -> None:
    token = make_token(user.pk, EMAIL_VERIFY_PURPOSE)
    url = _absolute(reverse("verify-email")) + f"?token={token}"
    send_mail(
        subject="Verify your email",
        message=(
            f"Welcome to Meal Tracker.\n\n"
            f"Click this link to verify your email address:\n{url}\n\n"
            f"The link expires in 24 hours."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_password_reset_email(user) -> None:
    token = make_token(user.pk, PASSWORD_RESET_PURPOSE)
    url = _absolute(reverse("password-reset-form")) + f"?token={token}"
    send_mail(
        subject="Reset your password",
        message=(
            f"You requested a password reset for Meal Tracker.\n\n"
            f"Click this link to reset your password:\n{url}\n\n"
            f"The link expires in 1 hour. If you didn't request this, ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
