import time

import pytest
from django.core.signing import TimestampSigner

from api.tokens import (
    EMAIL_VERIFY_PURPOSE,
    PASSWORD_RESET_PURPOSE,
    make_token,
    read_token,
)


def test_make_and_read_roundtrip():
    token = make_token(42, EMAIL_VERIFY_PURPOSE)
    assert read_token(token, EMAIL_VERIFY_PURPOSE, max_age=60) == 42


def test_read_with_wrong_purpose_fails():
    token = make_token(42, EMAIL_VERIFY_PURPOSE)
    assert read_token(token, PASSWORD_RESET_PURPOSE, max_age=60) is None


def test_read_with_tampered_token_fails():
    token = make_token(42, EMAIL_VERIFY_PURPOSE) + "x"
    assert read_token(token, EMAIL_VERIFY_PURPOSE, max_age=60) is None


def test_read_garbage_returns_none():
    assert read_token("not-a-token", EMAIL_VERIFY_PURPOSE, max_age=60) is None


def test_read_expired_token_fails():
    token = make_token(42, EMAIL_VERIFY_PURPOSE)
    time.sleep(1.1)
    assert read_token(token, EMAIL_VERIFY_PURPOSE, max_age=1) is None
