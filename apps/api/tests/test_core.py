"""Tests for core modules: response helpers, exceptions, privacy, and cache."""
from __future__ import annotations

import time

import pytest

from app.core.exceptions import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    ExternalServiceError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from app.core.response import error_response, paginated_response, success_response
from app.utils.cache import TTLCache
from app.utils.privacy import mask_email


# ── Response helpers ──────────────────────────────────────────────────────


class TestSuccessResponse:
    """Verify the success envelope structure."""

    def test_success_response_format(self) -> None:
        result = success_response({"key": "value"})
        assert "data" in result
        assert result["data"] == {"key": "value"}

    def test_success_response_with_meta(self) -> None:
        result = success_response([1, 2, 3], meta={"total": 3})
        assert result["data"] == [1, 2, 3]
        assert result["meta"] == {"total": 3}

    def test_success_response_without_meta(self) -> None:
        result = success_response("hello")
        assert "meta" not in result or result.get("meta") is None


class TestErrorResponse:
    """Verify the error envelope structure."""

    def test_error_response_format(self) -> None:
        result = error_response("NOT_FOUND", "Resource not found")
        assert result["data"] is None
        assert isinstance(result["errors"], list)
        assert result["errors"][0]["code"] == "NOT_FOUND"
        assert result["errors"][0]["message"] == "Resource not found"

    def test_error_response_with_details(self) -> None:
        result = error_response("VAL", "Bad input", details={"field": "name"})
        assert result["errors"][0]["details"] == {"field": "name"}


class TestPaginatedResponse:
    """Verify the paginated envelope."""

    def test_paginated_response_format(self) -> None:
        result = paginated_response(items=[1, 2], total=10, page=1, per_page=2)
        assert result["data"] == [1, 2]
        meta = result["meta"]
        assert meta["total"] == 10
        assert meta["page"] == 1
        assert meta["per_page"] == 2
        assert meta["total_pages"] == 5

    def test_paginated_response_zero_per_page(self) -> None:
        result = paginated_response(items=[], total=0, page=1, per_page=0)
        assert result["meta"]["total_pages"] == 0


# ── Exception hierarchy ──────────────────────────────────────────────────


class TestAppErrorHierarchy:
    """All custom exceptions must carry the correct HTTP status code."""

    @pytest.mark.parametrize(
        "exc_cls, expected_code, expected_status",
        [
            (NotFoundError, "NOT_FOUND", 404),
            (ValidationError, "VALIDATION_ERROR", 422),
            (AuthenticationError, "AUTHENTICATION_ERROR", 401),
            (AuthorizationError, "AUTHORIZATION_ERROR", 403),
            (RateLimitError, "RATE_LIMIT_EXCEEDED", 429),
            (ExternalServiceError, "EXTERNAL_SERVICE_ERROR", 502),
        ],
    )
    def test_app_error_hierarchy(
        self, exc_cls: type, expected_code: str, expected_status: int
    ) -> None:
        exc = exc_cls()
        assert isinstance(exc, AppError)
        assert exc.code == expected_code
        assert exc.status_code == expected_status

    def test_base_app_error_defaults(self) -> None:
        exc = AppError("boom")
        assert exc.status_code == 500
        assert exc.code == "INTERNAL_ERROR"
        assert str(exc) == "boom"


# ── Privacy helpers ───────────────────────────────────────────────────────


class TestMaskEmail:
    """Email masking for safe logging."""

    def test_mask_email_standard(self) -> None:
        assert mask_email("user@example.com") == "u***@example.com"

    def test_mask_email_short(self) -> None:
        # Single-char local part should still show first char
        assert mask_email("a@example.com") == "a***@example.com"

    def test_mask_email_no_at(self) -> None:
        assert mask_email("not-an-email") == "***"


# ── TTL Cache ─────────────────────────────────────────────────────────────


class TestTTLCache:
    """In-memory TTL cache behaviour."""

    def test_ttl_cache_set_get(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        cache.set("k", "v")
        assert cache.get("k") == "v"

    def test_ttl_cache_expiry(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=0)  # immediate expiry
        cache.set("k", "v")
        # After TTL of 0 seconds, the next get should consider it expired
        time.sleep(0.01)
        assert cache.get("k") is None

    def test_ttl_cache_max_size(self) -> None:
        cache = TTLCache(max_size=2, ttl_seconds=60)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)  # should evict "a"
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_ttl_cache_contains(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        cache.set("x", 42)
        assert "x" in cache
        assert "y" not in cache

    def test_ttl_cache_clear(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        cache.set("a", 1)
        cache.clear()
        assert len(cache) == 0
