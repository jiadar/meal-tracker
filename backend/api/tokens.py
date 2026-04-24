from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

EMAIL_VERIFY_PURPOSE = "email-verify"
PASSWORD_RESET_PURPOSE = "password-reset"

EMAIL_VERIFY_MAX_AGE = 60 * 60 * 24  # 24h
PASSWORD_RESET_MAX_AGE = 60 * 60  # 1h


def make_token(user_id: int, purpose: str) -> str:
    return TimestampSigner(salt=purpose).sign(str(user_id))


def read_token(token: str, purpose: str, max_age: int) -> int | None:
    try:
        value = TimestampSigner(salt=purpose).unsign(token, max_age=max_age)
        return int(value)
    except (SignatureExpired, BadSignature, ValueError):
        return None
